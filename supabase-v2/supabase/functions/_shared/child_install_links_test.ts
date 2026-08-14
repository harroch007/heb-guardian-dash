import {
  childAppLaunchIntent,
  childInstallActivationUrl,
} from "./child_install_links.ts";

Deno.test("QR activation URL bypasses the Guardian web application", () => {
  const url = childInstallActivationUrl(
    "https://example.supabase.co",
    "synthetic-activation-token",
  );

  assertEquals(
    url,
    "https://example.supabase.co/functions/v1/" +
      "v2-activate-child-install?activation_token=synthetic-activation-token",
  );
});

Deno.test("Android launch intent opens Kippy with a Play Store fallback", () => {
  const playStore =
    "https://play.google.com/store/apps/details?id=com.kippy.safety.core";
  const intent = childAppLaunchIntent(playStore);

  assert(intent.startsWith("intent://open-child-app#Intent;scheme=kippy;"));
  assert(intent.includes("package=com.kippy.safety.core;"));
  assert(
    intent.includes(`S.browser_fallback_url=${encodeURIComponent(playStore)};`),
  );
  assert(intent.endsWith(";end"));
});

function assert(condition: boolean): asserts condition {
  if (!condition) throw new Error("assertion_failed");
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}
