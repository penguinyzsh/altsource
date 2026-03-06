import { describe, test, expect } from "bun:test";

/**
 * 测试 SITE_URL 的 https:// 自动补全逻辑
 *
 * 由于 SITE_URL 在模块顶层求值且受模块缓存限制，
 * 这里直接复现 constants.ts 中的逻辑进行验证。
 */
function computeSiteUrl(rawSiteUrl: string): string {
    return rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;
}

describe("SITE_URL 补全逻辑", () => {
    test("无协议前缀时自动补全 https://", () => {
        expect(computeSiteUrl("example.com")).toBe("https://example.com");
    });

    test("已有 https:// 前缀时保持不变", () => {
        expect(computeSiteUrl("https://example.com")).toBe("https://example.com");
    });

    test("已有 http:// 前缀时保持不变", () => {
        expect(computeSiteUrl("http://localhost:3000")).toBe("http://localhost:3000");
    });

    test("空字符串补全为 https://", () => {
        expect(computeSiteUrl("")).toBe("https://");
    });
});
