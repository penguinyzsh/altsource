import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化文件大小为人类可读格式
 * @example formatSize(1048576) // "1.0 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 格式化日期为可读格式（根据 locale 自动调整）
 * @example formatDate(new Date(), "zh-CN") // "2026年3月3日"
 * @example formatDate(new Date(), "en")    // "March 3, 2026"
 */
export function formatDate(date: Date | string, locale: string = "zh-CN"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
