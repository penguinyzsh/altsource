"use client";

/**
 * 站点导航栏
 *
 * 从 layout.tsx 提取的 Client Component，用于支持 useTranslation()。
 * 包含：Logo、导航链接、GitHub 图标、语言切换、主题切换。
 */

import Link from "next/link";
import { IconBrandGithub } from "@tabler/icons-react";
import { GITHUB_REPO_URL } from "@/core/constants";
import { ThemeToggle } from "@/ui/layout/theme-toggle";
import { LanguageToggle } from "@/ui/layout/language-toggle";
import { useTranslation } from "@/ui/layout/i18n-provider";

export function SiteHeader() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-base font-semibold tracking-tight">
            {process.env.NEXT_PUBLIC_SITE_TITLE}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <nav className="flex items-center gap-0.5 mr-2">
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
            >
              {t("nav.home")}
            </Link>
            <Link
              href="/admin"
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
            >
              {t("nav.admin")}
            </Link>
          </nav>
          <div className="flex items-center gap-0.5">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
              aria-label="GitHub"
            >
              <IconBrandGithub size={16} />
            </a>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
