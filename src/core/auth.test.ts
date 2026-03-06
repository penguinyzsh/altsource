import { describe, test, expect, afterAll } from "bun:test";
import type { NextRequest } from "next/server";

// 环境变量必须在 auth 模块加载前设置（TOKEN_EXPIRY_SECONDS 在模块顶层求值）
process.env.JWT_SECRET = "test-secret-key-for-unit-tests";
process.env.TOKEN_EXPIRY_SECONDS = "86400";

const { signJWT, verifyJWT, isAuthenticated, isAuthorizedRefresh } =
    await import("./auth");

// ==================== Helpers ====================

function makeRequest(headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/test", { headers }) as unknown as NextRequest;
}

// ==================== Tests ====================

describe("signJWT / verifyJWT", () => {
    test("签发的 token 可以验证通过", async () => {
        const token = await signJWT();
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3); // JWT 三段式结构

        const valid = await verifyJWT(token);
        expect(valid).toBe(true);
    });

    test("篡改的 token 验证失败", async () => {
        const token = await signJWT();
        const tampered = token.slice(0, -5) + "xxxxx";
        const valid = await verifyJWT(tampered);
        expect(valid).toBe(false);
    });

    test("空字符串验证失败", async () => {
        const valid = await verifyJWT("");
        expect(valid).toBe(false);
    });

    test("随机字符串验证失败", async () => {
        const valid = await verifyJWT("not.a.jwt");
        expect(valid).toBe(false);
    });

    test("使用错误密钥签发的 token 验证失败", async () => {
        // 用不同密钥直接签发一个 JWT（绕过模块缓存的 JWT_SECRET）
        const { SignJWT } = await import("jose");
        const wrongKey = new TextEncoder().encode("completely-different-key");
        const foreignToken = await new SignJWT({ role: "admin" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h")
            .sign(wrongKey);

        const valid = await verifyJWT(foreignToken);
        expect(valid).toBe(false);
    });
});

describe("isAuthenticated", () => {
    test("valid Bearer token returns true", async () => {
        const token = await signJWT();
        const req = makeRequest({ Authorization: `Bearer ${token}` });

        expect(await isAuthenticated(req)).toBe(true);
    });

    test("missing Authorization header returns false", async () => {
        const req = makeRequest();

        expect(await isAuthenticated(req)).toBe(false);
    });

    test("empty Bearer token returns false", async () => {
        const req = makeRequest({ Authorization: "Bearer " });

        expect(await isAuthenticated(req)).toBe(false);
    });

    test("invalid token returns false", async () => {
        const req = makeRequest({ Authorization: "Bearer invalid.token.here" });

        expect(await isAuthenticated(req)).toBe(false);
    });

    test("non-Bearer auth scheme returns false", async () => {
        const token = await signJWT();
        // Without "Bearer " prefix, replace removes nothing, but token format is wrong
        const req = makeRequest({ Authorization: `Basic ${token}` });

        expect(await isAuthenticated(req)).toBe(false);
    });
});

describe("isAuthorizedRefresh", () => {
    const savedCronSecret = process.env.CRON_SECRET;

    afterAll(() => {
        // Restore original CRON_SECRET
        if (savedCronSecret) process.env.CRON_SECRET = savedCronSecret;
        else delete process.env.CRON_SECRET;
    });

    test("valid JWT token returns true", async () => {
        const token = await signJWT();
        const req = makeRequest({ Authorization: `Bearer ${token}` });

        expect(await isAuthorizedRefresh(req)).toBe(true);
    });

    test("valid CRON_SECRET returns true", async () => {
        process.env.CRON_SECRET = "my-cron-secret";
        const req = makeRequest({ Authorization: "Bearer my-cron-secret" });

        expect(await isAuthorizedRefresh(req)).toBe(true);
    });

    test("CRON_SECRET takes priority over JWT verification", async () => {
        process.env.CRON_SECRET = "cron-123";
        // This is not a valid JWT, but matches CRON_SECRET
        const req = makeRequest({ Authorization: "Bearer cron-123" });

        expect(await isAuthorizedRefresh(req)).toBe(true);
    });

    test("missing Authorization header returns false", async () => {
        const req = makeRequest();

        expect(await isAuthorizedRefresh(req)).toBe(false);
    });

    test("invalid token without CRON_SECRET returns false", async () => {
        delete process.env.CRON_SECRET;
        const req = makeRequest({ Authorization: "Bearer not-valid" });

        expect(await isAuthorizedRefresh(req)).toBe(false);
    });
});
