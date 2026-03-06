import { describe, test, expect } from "bun:test";
import en from "@/i18n/en";
import zhCN from "@/i18n/zh-CN";

// ==================== 辅助函数 ====================

/** 递归收集所有嵌套 key（点分隔路径） */
function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            keys.push(...collectKeys(v as Record<string, unknown>, path));
        } else {
            keys.push(path);
        }
    }
    return keys.sort();
}

/** 从嵌套对象中按点分隔路径取值（复刻 i18n-provider 中的逻辑） */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
        if (current == null || typeof current !== "object") return path;
        current = (current as Record<string, unknown>)[key];
    }
    return typeof current === "string" ? current : path;
}

/** 模拟 t() 函数（复刻 i18n-provider 中的逻辑，避免依赖 React Context） */
function t(
    dict: Record<string, unknown>,
    key: string,
    params?: Record<string, string | number>
): string {
    let text = getNestedValue(dict, key) as string;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}

// ==================== 字典 key 一致性 ====================

describe("i18n 字典一致性", () => {
    const enKeys = collectKeys(en as unknown as Record<string, unknown>);
    const zhKeys = collectKeys(zhCN as unknown as Record<string, unknown>);

    test("en 和 zh-CN 拥有相同的 key 集合", () => {
        expect(enKeys).toEqual(zhKeys);
    });

    test("所有 value 都是非空字符串", () => {
        for (const key of enKeys) {
            const val = getNestedValue(en as unknown as Record<string, unknown>, key);
            expect(typeof val).toBe("string");
            expect((val as string).length).toBeGreaterThan(0);
        }
        for (const key of zhKeys) {
            const val = getNestedValue(zhCN as unknown as Record<string, unknown>, key);
            expect(typeof val).toBe("string");
            expect((val as string).length).toBeGreaterThan(0);
        }
    });

    test("插值占位符一致（en 和 zh-CN 中的 {xxx} 应相同）", () => {
        const placeholderRegex = /\{(\w+)\}/g;
        for (const key of enKeys) {
            const enVal = getNestedValue(en as unknown as Record<string, unknown>, key) as string;
            const zhVal = getNestedValue(zhCN as unknown as Record<string, unknown>, key) as string;
            const enPlaceholders = [...enVal.matchAll(placeholderRegex)].map(m => m[1]).sort();
            const zhPlaceholders = [...zhVal.matchAll(placeholderRegex)].map(m => m[1]).sort();
            expect(enPlaceholders).toEqual(zhPlaceholders);
        }
    });
});

// ==================== t() 插值逻辑 ====================

describe("t() 插值", () => {
    test("无参数直接返回原文", () => {
        expect(t(en as unknown as Record<string, unknown>, "nav.home")).toBe("Home");
        expect(t(zhCN as unknown as Record<string, unknown>, "nav.home")).toBe("首页");
    });

    test("单个占位符替换", () => {
        expect(
            t(en as unknown as Record<string, unknown>, "admin.subtitle", { count: 5 })
        ).toBe("Manage apps and data refresh · 5 apps total");
    });

    test("多个不同占位符替换", () => {
        expect(
            t(en as unknown as Record<string, unknown>, "admin.refreshResult", { success: 3, failed: 1 })
        ).toBe("Refresh done: 3 succeeded, 1 failed");
    });

    test("同一占位符出现两次时都被替换（replaceAll）", () => {
        const mockDict = { test: { msg: "Hello {name}, welcome {name}!" } };
        expect(t(mockDict as Record<string, unknown>, "test.msg", { name: "Alice" }))
            .toBe("Hello Alice, welcome Alice!");
    });

    test("不存在的 key 返回 key 本身", () => {
        expect(t(en as unknown as Record<string, unknown>, "nonexistent.key")).toBe("nonexistent.key");
    });

    test("嵌套路径正确解析", () => {
        expect(t(en as unknown as Record<string, unknown>, "editDialog.save")).toBe("Save");
        expect(t(zhCN as unknown as Record<string, unknown>, "editDialog.save")).toBe("保存");
    });
});
