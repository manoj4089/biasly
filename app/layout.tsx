import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import PostHogIdentifier from "@/components/PostHogIdentifier";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skew — Balanced News Coverage",
  description: "Balanced news coverage, powered by AI.",
};

const THEME_INIT_SCRIPT = `(function(){try{var pref=localStorage.getItem("biasly-theme")||"auto";var resolved=pref==="auto"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):pref;document.documentElement.setAttribute("data-theme",resolved)}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ClerkProvider dynamic>
          <PostHogIdentifier />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
