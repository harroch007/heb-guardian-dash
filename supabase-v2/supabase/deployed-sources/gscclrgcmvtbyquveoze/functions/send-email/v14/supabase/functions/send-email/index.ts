import React from "npm:react@18.3.1";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { AuthEmail, authEmailSubject } from "./_templates/auth-email.tsx";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  try {
    const resendApiKey = requiredEnv("RESEND_API_KEY");
    const hookSecret = normalizeHookSecret(
      requiredEnv("SEND_EMAIL_HOOK_SECRET"),
    );
    const payload = await request.text();
    const webhook = new Webhook(hookSecret);
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = webhook.verify(payload, Object.fromEntries(request.headers)) as {
      user: { email: string };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
      };
    };

    const html = await renderAsync(
      React.createElement(AuthEmail, {
        supabase_url: requiredEnv("SUPABASE_URL"),
        token,
        token_hash,
        redirect_to,
        email_action_type,
      }),
    );
    const { error } = await new Resend(resendApiKey).emails.send({
      from: "KippyAI <noreply@kippyai.com>",
      to: [user.email],
      subject: authEmailSubject(email_action_type, redirect_to),
      html,
    });
    if (error) throw error;
  } catch (error: unknown) {
    console.error(
      "SEND_EMAIL_FAILED",
      error instanceof Error ? error.name : "UnknownError",
    );
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: "email_delivery_failed" },
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  return new Response("{}", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});

function normalizeHookSecret(value: string): string {
  return value.startsWith("v1,whsec_")
    ? value.slice("v1,whsec_".length)
    : value;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}
