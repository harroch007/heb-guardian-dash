import React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import {
  AuthEmail,
  authEmailSubject,
  isChildInstallRedirect,
} from "./auth-email.tsx";

Deno.test("child install email renders one six digit OTP without parent CTA", async () => {
  const marker = "123456";
  const redirectTo = "https://kippyai.com/?kippy_flow=child_install";
  const html = await renderAsync(
    React.createElement(AuthEmail, {
      supabase_url: "https://example.invalid",
      email_action_type: "magiclink",
      redirect_to: redirectTo,
      token_hash: "synthetic-token-hash",
      token: marker,
    }),
  );

  assert(isChildInstallRedirect(redirectTo));
  assertEquals(countOccurrences(html, marker), 1);
  assertIncludes(html, "בתוקף ל־10 דקות");
  assertNotIncludes(html, "לחצו כאן להתחברות");
  assertEquals(
    authEmailSubject("magiclink", redirectTo),
    "קוד לחיבור מכשיר הילד ל-KippyAI",
  );
});

Deno.test("ordinary magic link email keeps its parent login CTA", async () => {
  const html = await renderAsync(
    React.createElement(AuthEmail, {
      supabase_url: "https://example.invalid",
      email_action_type: "magiclink",
      redirect_to: "https://kippyai.com/",
      token_hash: "synthetic-token-hash",
      token: "123456",
    }),
  );

  assertIncludes(html, "לחצו כאן להתחברות");
});

function countOccurrences(value: string, marker: string): number {
  return value.split(marker).length - 1;
}

function assert(condition: boolean): asserts condition {
  if (!condition) throw new Error("assertion_failed");
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertIncludes(value: string, marker: string): void {
  assert(value.includes(marker));
}

function assertNotIncludes(value: string, marker: string): void {
  assert(!value.includes(marker));
}
