import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { AuthEmail } from './_templates/auth-email.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

const ACTION_SUBJECTS: Record<string, string> = {
  signup: 'ברוכים הבאים ל-KippyAI!',
  magiclink: 'קישור כניסה ל-KippyAI',
  recovery: 'איפוס סיסמה - KippyAI',
  invite: 'הוזמנת ל-KippyAI!',
  email_change: 'אישור שינוי אימייל - KippyAI',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)
  const wh = new Webhook(hookSecret)

  try {
    const {
      user,
      email_data: { token, token_hash, redirect_to, email_action_type },
    } = wh.verify(payload, headers) as {
      user: { email: string }
      email_data: {
        token: string
        token_hash: string
        redirect_to: string
        email_action_type: string
        site_url: string
        token_new: string
        token_hash_new: string
      }
    }

    const html = await renderAsync(
      React.createElement(AuthEmail, {
        supabase_url: Deno.env.get('SUPABASE_URL') ?? '',
        token,
        token_hash,
        redirect_to,
        email_action_type,
      })
    )

    const subject = ACTION_SUBJECTS[email_action_type] || 'הודעה מ-KippyAI'

    const { error } = await resend.emails.send({
      from: 'KippyAI <noreply@kippyai.com>',
      to: [user.email],
      subject,
      html,
    })

    if (error) {
      throw error
    }
  } catch (error: unknown) {
    console.error('Error sending email:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
