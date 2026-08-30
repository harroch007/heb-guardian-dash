import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface AuthEmailProps {
  supabase_url: string
  email_action_type: string
  redirect_to: string
  token_hash: string
  token: string
}

const ACTION_LABELS: Record<string, { subject: string; heading: string; cta: string; preview: string; description: string }> = {
  signup: {
    subject: 'ברוכים הבאים ל-KippyAI!',
    heading: 'ברוכים הבאים! 🎉',
    cta: 'אישור האימייל והפעלת החשבון',
    preview: 'אישור הרשמה ל-KippyAI',
    description: 'תודה שנרשמת ל-KippyAI! לחצו על הכפתור למטה כדי לאשר את כתובת האימייל ולהפעיל את החשבון.',
  },
  magiclink: {
    subject: 'קישור כניסה ל-KippyAI',
    heading: 'כניסה מהירה',
    cta: 'לחצו כאן להתחברות',
    preview: 'קישור כניסה ל-KippyAI',
    description: 'קיבלתם קישור כניסה מהירה. לחצו על הכפתור למטה כדי להתחבר לחשבון שלכם.',
  },
  recovery: {
    subject: 'איפוס סיסמה - KippyAI',
    heading: 'איפוס סיסמה',
    cta: 'לחצו כאן לאיפוס הסיסמה',
    preview: 'איפוס סיסמה ב-KippyAI',
    description: 'קיבלנו בקשה לאיפוס הסיסמה שלכם. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה.',
  },
  invite: {
    subject: 'הוזמנת ל-KippyAI!',
    heading: 'הוזמנת להצטרף! 🎉',
    cta: 'קבלת ההזמנה',
    preview: 'הזמנה ל-KippyAI',
    description: 'קיבלתם הזמנה להצטרף ל-KippyAI. לחצו על הכפתור למטה כדי להפעיל את החשבון.',
  },
  email_change: {
    subject: 'אישור שינוי אימייל - KippyAI',
    heading: 'שינוי כתובת אימייל',
    cta: 'אישור כתובת האימייל החדשה',
    preview: 'אישור שינוי אימייל ב-KippyAI',
    description: 'קיבלנו בקשה לשנות את כתובת האימייל שלכם. לחצו על הכפתור למטה כדי לאשר את הכתובת החדשה.',
  },
}

const LOGO_URL = 'https://kippyai.com/pwa-192x192.png'

export const AuthEmail = ({
  token,
  supabase_url,
  email_action_type,
  redirect_to,
  token_hash,
}: AuthEmailProps) => {
  const labels = ACTION_LABELS[email_action_type] || ACTION_LABELS.magiclink
  const confirmUrl = `${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

  return (
    <Html dir="rtl" lang="he">
      <Head />
      <Preview>{labels.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Img
              src={LOGO_URL}
              alt="KippyAI"
              width="120"
              style={logo}
            />
          </Section>

          {/* Main Card */}
          <Section style={card}>
            <Heading style={h1}>{labels.heading}</Heading>
            <Text style={text}>{labels.description}</Text>

            {/* CTA Button */}
            <Section style={buttonSection}>
              <Link href={confirmUrl} target="_blank" style={button}>
                {labels.cta}
              </Link>
            </Section>

            {/* OTP Code */}
            {token && (
              <>
                <Text style={orText}>או הזינו את הקוד הבא:</Text>
                <code style={code}>{token}</code>
              </>
            )}

            <Text style={disclaimer}>
              אם לא ביקשתם פעולה זו, אפשר להתעלם מהודעה זו.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footerSection}>
            <Text style={footer}>
              KippyAI — הגנה חכמה על ילדיכם ברשת
            </Text>
            <Text style={footerLinks}>
              <Link href="https://kippyai.com/privacy-policy" target="_blank" style={footerLink}>
                מדיניות פרטיות
              </Link>
              {' · '}
              <Link href="https://kippyai.com/terms-of-service" target="_blank" style={footerLink}>
                תנאי שימוש
              </Link>
              {' · '}
              <Link href="mailto:support@kippyai.com" style={footerLink}>
                support@kippyai.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default AuthEmail

// --- Styles ---
const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '20px 12px',
  maxWidth: '560px',
}

const logoSection = {
  textAlign: 'center' as const,
  padding: '24px 0 16px',
}

const logo = {
  margin: '0 auto',
}

const card = {
  backgroundColor: '#f9fafb',
  borderRadius: '12px',
  padding: '32px 24px',
  border: '1px solid #e5e7eb',
}

const h1 = {
  color: '#111827',
  fontSize: '24px',
  fontWeight: '700' as const,
  textAlign: 'center' as const,
  margin: '0 0 16px',
}

const text = {
  color: '#4b5563',
  fontSize: '15px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

const buttonSection = {
  textAlign: 'center' as const,
  margin: '0 0 24px',
}

const button = {
  backgroundColor: '#7C3AED',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600' as const,
  padding: '12px 32px',
  textDecoration: 'none',
}

const orText = {
  color: '#9ca3af',
  fontSize: '13px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}

const code = {
  display: 'block',
  textAlign: 'center' as const,
  padding: '14px',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  color: '#7C3AED',
  fontSize: '28px',
  fontWeight: '700' as const,
  letterSpacing: '6px',
  margin: '0 0 24px',
}

const disclaimer = {
  color: '#9ca3af',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0',
}

const footerSection = {
  textAlign: 'center' as const,
  padding: '24px 0 0',
}

const footer = {
  color: '#9ca3af',
  fontSize: '13px',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}

const footerLinks = {
  color: '#9ca3af',
  fontSize: '12px',
  margin: '0',
  textAlign: 'center' as const,
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}
