import type { Metadata } from "next";
import "./globals.css";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "VistaClone - Premium Social Media Management",
  description: "A beautifully crafted social media presence manager.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans suppressHydrationWarning"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-violet-500/30">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
        >
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
              <Header />
              <main className="flex-1 overflow-auto relative z-0">
                {children}
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
