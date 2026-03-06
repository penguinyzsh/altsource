/**
 * 认证工具模块
 *
 * 提供 JWT 签发与验证功能，用于管理后台的登录鉴权。
 * - signJWT()：签发 24 小时有效期的 JWT
 * - verifyJWT()：验证 JWT 是否有效
 * - isAuthenticated()：从请求头提取并验证管理员 JWT
 * - isAuthorizedRefresh()：刷新端点专用鉴权，同时支持 Cron Secret 和 JWT
 */

import { SignJWT, jwtVerify } from "jose";
import { createHash, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

/** Token/Cookie 有效期（秒），默认 24 小时 */
export const TOKEN_EXPIRY_SECONDS = parseInt(process.env.TOKEN_EXPIRY_SECONDS || "86400");
/** Token 有效期（jose 格式），从 TOKEN_EXPIRY_SECONDS 推导 */
const TOKEN_EXPIRY_JOSE = `${TOKEN_EXPIRY_SECONDS}s`;

/**
 * JWT 签名密钥
 * 优先使用 JWT_SECRET 环境变量；未设置时从 ADMIN_PASSWORD 派生，
 * 保证所有 serverless 实例使用同一密钥，无需额外配置。
 */
function deriveSecret(): Uint8Array {
    if (process.env.JWT_SECRET) {
        return new TextEncoder().encode(process.env.JWT_SECRET);
    }
    const source = process.env.ADMIN_PASSWORD;
    if (!source) {
        throw new Error("JWT_SECRET 或 ADMIN_PASSWORD 至少需要设置一个");
    }
    return createHash("sha256").update(`altsource-jwt:${source}`).digest();
}
const SECRET = deriveSecret();

/**
 * 签发 JWT Token
 * @returns 签发的 JWT 字符串，有效期 24 小时
 */
export async function signJWT(): Promise<string> {
    return new SignJWT({ role: "admin" })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime(TOKEN_EXPIRY_JOSE)
        .setIssuedAt()
        .sign(SECRET);
}

/**
 * 验证 JWT Token 是否有效
 * @param token - 待验证的 JWT 字符串
 * @returns 验证通过返回 true，否则返回 false
 */
export async function verifyJWT(token: string): Promise<boolean> {
    try {
        await jwtVerify(token, SECRET);
        return true;
    } catch {
        return false;
    }
}

/**
 * 从请求头中提取 JWT 并验证是否为已认证的管理员
 * 要求请求头包含 Authorization: Bearer <token>
 * @param req - Next.js 请求对象
 * @returns 认证通过返回 true，否则返回 false
 */
export async function isAuthenticated(req: NextRequest): Promise<boolean> {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return false;
    return verifyJWT(token);
}

/**
 * 刷新端点的鉴权逻辑
 *
 * 同时支持两种认证方式：
 * 1. Vercel Cron 定时任务的 CRON_SECRET
 * 2. 管理员的 JWT Token
 *
 * @param req - Next.js 请求对象
 * @returns 认证通过返回 true，否则返回 false
 */
export async function isAuthorizedRefresh(req: NextRequest): Promise<boolean> {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return false;

    // 优先检查 Vercel Cron 请求携带的 CRON_SECRET（恒定时间比较，防止时序攻击）
    // 未配置 CRON_SECRET 时跳过此检查，仅依赖 JWT 验证
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && token.length === cronSecret.length &&
        timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))) return true;

    // 其次验证管理员 JWT
    return verifyJWT(token);
}
