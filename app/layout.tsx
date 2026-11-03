import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { AppThemeSync } from "@/components/ui/AppThemeSync";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import AgentationGate from "@/components/dev/AgentationGate";
import { FullScreenLoader } from "@/components/loaders/full-screen-loader";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Site-wide SEO metadata. Per-page layouts override `title` via the
// template ("Page Name | Fabix") while inheriting description/OG/etc.
// Copy uses plain hyphens only (no em or en dashes) and short
// declarative sentences so the writing reads as human-authored.
export const metadata: Metadata = {
  title: {
    default: "Fabix - Make AI work. Make every action count.",
    template: "%s | Fabix",
  },
  description:
    "Connect your AI agents, execute workflows efficiently, and understand everything happening across your AI ecosystem, all from one platform.",
  applicationName: "Fabix",
  keywords: [
    "MCP",
    "AI agents",
    "AI agent workspaces",
    "AI agent memory",
    "Claude Code",
    "Cursor",
    "developer tools",
  ],
  authors: [{ name: "Fabix" }],
  creator: "Fabix",
  publisher: "Fabix",
  openGraph: {
    type: "website",
    siteName: "Fabix",
    title: "Fabix - Make AI work. Make every action count.",
    description:
      "Connect your AI agents, execute workflows efficiently, and understand everything happening across your AI ecosystem.",
    locale: "en_US",
    images: [{ url: "/fabix-logo.png", width: 529, height: 160, alt: "Fabix" }],
  },
  twitter: {
    card: "summary",
    title: "Fabix - Make AI work. Make every action count.",
    description:
      "Connect your AI agents, execute workflows efficiently, and understand everything happening across your AI ecosystem.",
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full ${geist.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} ${manrope.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* FOUC-prevention: applies dashboard chrome state BEFORE React
            hydrates so the first paint already shows the user's saved
            preferences (dark theme + collapsed sidebar). Without this,
            users would see a flash of default-light-expanded layout
            for one frame before hydration corrects it.

            Reads `aegis_theme` and `aegis_sidebar_collapsed` from
            localStorage and writes the matching dataset attributes on
            <html>.

            Theme applies to /dashboard AND /workspaces: the workspace
            room is full-bleed and lives outside the dashboard shell, so
            without this it would render light for a user who chose dark.
            Sidebar-collapsed stays dashboard-only because only the
            dashboard has that sidebar. Auth/onboarding keep default
            chrome by design.

            Inline + sync because it has to run before any CSS paints.
            Wrapped in try/catch because localStorage may throw in
            embedded contexts (iframes with cookies disabled, etc.). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=location.pathname;var onAuth=p.startsWith('/auth');var onDash=p.startsWith('/dashboard');var onOnboard=p.startsWith('/onboarding');var onWorkspace=p.startsWith('/workspaces');if(!onAuth&&!onDash&&!onOnboard&&!onWorkspace)return;if(onAuth||p.startsWith('/dashboard/inbox')||p.startsWith('/dashboard/memory')||p.startsWith('/dashboard/prompts')||p.startsWith('/dashboard/connectors')||p.startsWith('/dashboard/workspaces')){document.documentElement.dataset.theme='dark';}else if(onDash||onWorkspace){if(localStorage.getItem('aegis_theme')!=='light')document.documentElement.dataset.theme='dark';}if(onDash){if(localStorage.getItem('aegis_sidebar_collapsed')==='true')document.documentElement.dataset.sidebarCollapsed='true';}var d=localStorage.getItem('aegis_demo');var url=new URLSearchParams(location.search);if(url.get('real')==='1')return;if(url.get('demo')==='1'||url.get('preview')==='1'||d==='true')document.documentElement.dataset.demo='true';}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(sessionStorage.getItem('fabix_platform_intro')==='1')document.documentElement.dataset.platformIntro='seen';}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-strong)] antialiased">
        <AppThemeSync />
        <SmoothScroll />
        <ToastProvider>{children}</ToastProvider>
        {/* Floating annotation toolbar — dev-only. AgentationGate is
            a thin client wrapper that does the next/dynamic + NODE_ENV
            gate so the `agentation` library never enters prod bundles.
            Mounted ONCE here at the root so annotations work on every
            route (auth, onboarding, dashboard, email previews). */}
        <AgentationGate />
        <FullScreenLoader />
      </body>
    </html>
  );
}
