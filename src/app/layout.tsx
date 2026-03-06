/**
 * 根布局组件
 *
 * 定义全局 HTML 结构、字体、元数据和导航栏。
 * - 使用 Inter / Geist / Geist_Mono 字体（和 shadcn 官方一致）
 * - next-themes 管理 Light/Dark 模式
 * - I18nProvider 管理多语言
 * - 导航栏提取为 SiteHeader（Client Component）
 * - 集成 Sonner 消息提示组件
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/ui/shadcn/sonner";
import { TooltipProvider } from "@/ui/shadcn/tooltip";
import { ThemeProvider } from "@/ui/layout/theme-provider";
import { I18nProvider, LOCALE_COOKIE_NAME, type Locale } from "@/ui/layout/i18n-provider";
import { SiteHeader } from "@/ui/layout/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: process.env.SITE_TITLE!,
  description: process.env.SITE_DESCRIPTION!,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const initialLocale: Locale = localeCookie === "zh-CN" ? "zh-CN" : "en";

  return (
    <html lang={initialLocale} className={inter.variable} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider serverLocale={initialLocale}>
            <TooltipProvider delay={300}>
              {/* 导航栏 */}
              <SiteHeader />

              {/* 主内容 */}
              <main className="flex-1">{children}</main>

              <Toaster richColors />
            </TooltipProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
