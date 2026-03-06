import { describe, test, expect } from "bun:test";

// 测试 deriveSecret 的 SHA-256 派生路径：不设置 JWT_SECRET，仅设置 ADMIN_PASSWORD
delete process.env.JWT_SECRET;
process.env.ADMIN_PASSWORD = "test-admin-password";

const { signJWT, verifyJWT } = await import("./auth");

describe("deriveSecret — SHA-256 派生路径", () => {
    test("未设置 JWT_SECRET 时从 ADMIN_PASSWORD 派生密钥，签发和验证正常", async () => {
        const token = await signJWT();
        expect(typeof token).toBe("string");
        expect(token.split(".")).toHaveLength(3);

        const valid = await verifyJWT(token);
        expect(valid).toBe(true);
    });

    test("派生密钥签发的 token 可重复验证", async () => {
        const token = await signJWT();
        // 多次验证同一 token 均应通过（密钥稳定）
        expect(await verifyJWT(token)).toBe(true);
        expect(await verifyJWT(token)).toBe(true);
    });

    test("篡改的 token 验证失败", async () => {
        const token = await signJWT();
        const tampered = token.slice(0, -5) + "zzzzz";
        expect(await verifyJWT(tampered)).toBe(false);
    });
});
