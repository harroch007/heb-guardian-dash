import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "www.kippyai.com";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "KippyAI — הורות דיגיטלית בדרך רגועה יותר";
  const description =
    "KippyAI נבנית כדי לחבר גבולות ברורים בטלפון עם אותות בטיחות ממוקדים והכוונה לשיחה רגועה. הצטרפו לגישה המוקדמת.";

  return {
    title,
    description,
    icons: {
      icon: "/kippy-mascot.png",
      apple: "/kippy-mascot.png",
    },
    openGraph: {
      type: "website",
      locale: "he_IL",
      title,
      description,
      url: origin,
      images: [
        {
          url: `${origin}/og.png`,
          width: 1200,
          height: 630,
          alt: "KippyAI — לתת להם מרחב, לדעת מתי להיות שם",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f7f9f7",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
