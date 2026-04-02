import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RingPhase =
  | "idle"
  | "sending"
  | "ringing"
  | "child_stopped"
  | "timeout"
  | "failed"
  | "completed_legacy";

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 2 * 60 * 1000;

/**
 * Maps only proven DB statuses (PENDING, ACKNOWLEDGED, COMPLETED, EXPIRED)
 * plus the `result` field for COMPLETED differentiation.
 */
function derivePhase(status: string | null, result: string | null, elapsed: number): RingPhase | null {
  if (!status) return null;
  switch (status) {
    case "PENDING":
      return elapsed > POLL_TIMEOUT ? "failed" : "sending";
    case "ACKNOWLEDGED":
      return "ringing";
    case "COMPLETED":
      if (result === "CHILD_STOPPED") return "child_stopped";
      if (result === "RING_TIMEOUT") return "timeout";
      if (result === "RING_FAILED") return "failed";
      return "completed_legacy"; // null result = old agent
    case "EXPIRED":
      return "failed";
    default:
      // Unknown status — treat as still pending
      return "sending";
  }
}

export function useRingCommand(deviceId: string | null) {
  const [phase, setPhase] = useState<RingPhase>("idle");
  const [commandId, setCommandId] = useState<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (resetTimerRef.current) { clearTimeout(resetTimerRef.current); resetTimerRef.current = null; }
  }, []);

  // Auto-reset terminal states after 5s
  useEffect(() => {
    if (phase === "child_stopped" || phase === "timeout" || phase === "completed_legacy") {
      resetTimerRef.current = setTimeout(() => setPhase("idle"), 5000);
      return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
    }
  }, [phase]);

  // Polling loop
  useEffect(() => {
    if (!commandId || phase === "idle") return;

    const poll = async () => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > POLL_TIMEOUT) {
        setPhase("failed");
        setCommandId(null);
        return;
      }
      const { data } = await supabase
        .from("device_commands")
        .select("status, result")
        .eq("id", commandId)
        .single();

      if (!data) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL);
        return;
      }

      const derived = derivePhase(data.status, data.result, elapsed);
      if (derived) setPhase(derived);

      // Terminal statuses — stop polling
      if (["COMPLETED", "EXPIRED"].includes(data.status)) {
        setCommandId(null);
        return;
      }

      timerRef.current = setTimeout(poll, POLL_INTERVAL);
    };

    poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [commandId, phase]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const sendRing = useCallback(async (): Promise<boolean> => {
    if (!deviceId) return false;
    cleanup();
    setPhase("sending");
    startTimeRef.current = Date.now();

    const { data, error } = await supabase
      .from("device_commands")
      .insert({ device_id: deviceId, command_type: "RING_DEVICE", status: "PENDING" })
      .select("id")
      .single();

    if (error || !data) {
      setPhase("failed");
      return false;
    }

    setCommandId(data.id);
    return true;
  }, [deviceId, cleanup]);

  const retry = useCallback(() => {
    setPhase("idle");
    setCommandId(null);
    sendRing();
  }, [sendRing]);

  return { phase, sendRing, retry };
}
