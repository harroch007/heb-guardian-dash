import {
  hashDeviceCredential,
  requiredString,
  serviceClient,
} from "../_shared/auth.ts";
import {
  handleError,
  HttpError,
  jsonResponse,
  readJsonObject,
} from "../_shared/http.ts";
import { webCorsPreflight, withWebCors } from "../_shared/web_cors.ts";
import { childAppLaunchIntent } from "../_shared/child_install_links.ts";

Deno.serve(async (request) => {
  const preflight = webCorsPreflight(request);
  if (preflight) return preflight;

  try {
    if (request.method !== "GET" && request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed");
    }
    const body = request.method === "GET"
      ? {
        activation_token: new URL(request.url).searchParams.get(
          "activation_token",
        ),
      }
      : await readJsonObject(request, 2_048);
    const activationToken = requiredString(
      body.activation_token,
      "invalid_activation_token",
      256,
    );
    const tokenHash = await hashDeviceCredential(activationToken);
    const client = serviceClient();

    const { data, error } = await client.rpc(
      "v2_activate_child_install_session_service",
      { supplied_activation_token_hash: tokenHash },
    );
    if (error) throw error;

    const session = data?.[0];
    if (!session) {
      throw new HttpError(410, "install_link_expired_or_used");
    }

    const shouldSendOtp = session.should_send_otp === true;
    const reservationAt = parseReservationAt(session.otp_reservation_at);
    if (
      !reservationAt || (!shouldSendOtp && !isRecentReservation(reservationAt))
    ) {
      throw new HttpError(503, "otp_delivery_state_invalid");
    }

    if (shouldSendOtp) {
      try {
        const { data: guardian, error: guardianError } = await client.auth.admin
          .getUserById(session.guardian_user_id);
        const email = guardian?.user?.email;
        if (guardianError || !email) {
          throw new HttpError(503, "guardian_email_unavailable");
        }
        await requestGuardianOtp(email);
      } catch (error) {
        const released = await releaseOtpReservation(
          client,
          session.install_session_id,
          reservationAt,
        );
        if (!released) {
          throw new HttpError(503, "otp_delivery_recovery_failed");
        }
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, "otp_delivery_failed");
      }
    }

    const playStoreUrl =
      "https://play.google.com/store/apps/details?id=com.kippy.safety.core";
    if (request.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: {
          "cache-control": "no-store",
          "location": childAppLaunchIntent(playStoreUrl),
          "referrer-policy": "no-referrer",
        },
      });
    }

    return withWebCors(
      request,
      jsonResponse(200, {
        activated: true,
        otp_sent: shouldSendOtp,
        otp_delivery: shouldSendOtp ? "requested" : "recent_request_exists",
        expires_at: session.expires_at,
        play_store_url: playStoreUrl,
      }),
    );
  } catch (error) {
    return withWebCors(request, handleError(error));
  }
});

async function requestGuardianOtp(email: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publicWebUrl = Deno.env.get("KIPPY_PUBLIC_WEB_URL")
    ?.replace(/\/+$/, "");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (
    !supabaseUrl ||
    !publicWebUrl?.startsWith("https://") ||
    !publishableKey
  ) {
    throw new HttpError(503, "otp_delivery_configuration_missing");
  }

  let response: Response;
  try {
    const otpUrl = new URL("/auth/v1/otp", `${supabaseUrl}/`);
    const redirectUrl = new URL("/", `${publicWebUrl}/`);
    redirectUrl.searchParams.set("kippy_flow", "child_install");
    otpUrl.searchParams.set("redirect_to", redirectUrl.toString());
    response = await fetch(otpUrl, {
      method: "POST",
      headers: {
        "apikey": publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        create_user: false,
      }),
    });
  } catch {
    throw new HttpError(502, "otp_delivery_failed");
  }
  if (!response.ok) {
    if (response.status === 429) {
      throw new HttpError(429, "otp_delivery_rate_limited");
    }
    throw new HttpError(502, "otp_delivery_failed");
  }
}

function parseReservationAt(value: unknown): string | null {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    return null;
  }
  return value;
}

function isRecentReservation(value: string): boolean {
  const ageMs = Date.now() - Date.parse(value);
  return ageMs >= -5_000 && ageMs <= 65_000;
}

async function releaseOtpReservation(
  client: ReturnType<typeof serviceClient>,
  installSessionId: unknown,
  reservationAt: string,
): Promise<boolean> {
  if (typeof installSessionId !== "string" || installSessionId.length === 0) {
    return false;
  }

  const { data, error } = await client.rpc(
    "v2_release_child_install_otp_reservation_service",
    {
      target_install_session_id: installSessionId,
      expected_otp_reservation_at: reservationAt,
    },
  );
  return !error && data === true;
}
