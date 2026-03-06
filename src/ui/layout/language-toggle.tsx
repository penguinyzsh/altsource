"use client";

/**
 * 语言切换按钮
 *
 * 与 ThemeToggle 并排放置在导航栏右侧。
 * 当前中文时显示 "EN"，当前英文时显示 "中"。
 */

import { useSyncExternalStore } from "react";
import { Button } from "@/ui/shadcn/button";
import { useTranslation } from "@/ui/layout/i18n-provider";

const subscribe = () => () => {};

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation();

  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon-sm" aria-label="Toggle language">
        <span className="text-xs font-semibold">EN</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setLocale(locale === "zh-CN" ? "en" : "zh-CN")}
      aria-label={t("nav.toggleLanguage")}
    >
      <span className="text-xs font-semibold">
        {locale === "zh-CN" ? "EN" : "中"}
      </span>
    </Button>
  );
}
