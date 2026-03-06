"use client";

/**
 * 多语言 Context Provider
 *
 * 提供 locale 状态和 t() 翻译函数：
 * - 初始化优先级：localStorage → navigator.language → 默认 "en"
 * - 切换语言时同步 localStorage 和 <html lang>
 * - 支持 {variable} 插值语法
 * - 使用 useSyncExternalStore 避免 hydration 不匹配
 */

import { createContext, useContext, useEffect, useCallback, useSyncExternalStore, type ReactNode } from "react";
import zhCN from "@/i18n/zh-CN";
import en from "@/i18n/en";

export type Locale = "zh-CN" | "en";

/** 递归地将所有叶子值宽化为 string */
type DeepStringify<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

type Dictionary = DeepStringify<typeof zhCN>;

const dictionaries: Record<Locale, Dictionary> = {
  "zh-CN": zhCN,
  en: en,
};

const STORAGE_KEY = "language";
export const LOCALE_COOKIE_NAME = "locale";

/** 写入 locale cookie（1 年有效期） */
function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;max-age=31536000`;
}

/** 检测浏览器语言偏好 */
function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "zh-CN" || stored === "en") return stored;
  const browserLang = navigator.language;
  return browserLang.startsWith("zh") ? "zh-CN" : "en";
}

// ===== 外部状态管理（供 useSyncExternalStore 使用）=====

let currentLocale: Locale = "en";
let initialServerLocale: Locale = "en";
const listeners = new Set<() => void>();

// 客户端初始化：模块加载时检测语言并同步 cookie
if (typeof window !== "undefined") {
  currentLocale = detectLocale();
  setLocaleCookie(currentLocale);
}

function subscribeToLocale(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

function getLocaleSnapshot(): Locale {
  return currentLocale;
}

/** SSR 和 hydration 期间返回服务端传入的 locale，避免闪烁 */
function getServerLocaleSnapshot(): Locale {
  return initialServerLocale;
}

/** 更新语言并通知所有订阅者 */
function setLocaleExternal(newLocale: Locale) {
  currentLocale = newLocale;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, newLocale);
    setLocaleCookie(newLocale);
    document.documentElement.lang = newLocale;
  }
  listeners.forEach(l => l());
}

// ===== Context =====

/** 从嵌套对象中按点分隔路径取值 */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children, serverLocale }: { children: ReactNode; serverLocale?: Locale }) {
  // 将服务端传入的 locale 同步到模块变量，供 getServerLocaleSnapshot 使用
  if (serverLocale) {
    initialServerLocale = serverLocale;
  }

  // useSyncExternalStore 保证 hydration 安全：
  // SSR/hydration 用 getServerLocaleSnapshot（返回 cookie 中的 locale），hydration 后切换到 getLocaleSnapshot
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot
  );

  // 同步 <html lang> 属性
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleExternal(newLocale);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = dictionaries[locale];
      let text = getNestedValue(dict as unknown as Record<string, unknown>, key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replaceAll(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/** 获取当前语言和翻译函数 */
export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useTranslation must be used within I18nProvider");
  }
  return context;
}
