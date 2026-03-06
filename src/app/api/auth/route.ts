/**
 * 认证 API 路由
 *
 * POST   /api/auth    — 登录：验证密码 → 签发 JWT + 设置 Cookie
 * DELETE /api/auth    — 退出：清除 auth-token Cookie
 *
 * 请求体 (POST): { password: string }
 * 成功响应: { token: string }（同时设置 httpOnly Cookie）
 * 失败响应: 401 { error: "密码错误" } 或 429 { error: "尝试次数过多" }
 *
 * 安全措施：
 * - 内存级 IP 限流：同一 IP 5 分钟内最多 5 次失败尝试
 * - 超限返回 429 Too Many Requests
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { signJWT, TOKEN_EXPIRY_SECONDS } from "@/core/auth";
import { AUTH_COOKIE_NAME } from "@/core/constants";

// ==================== 简易限流 ====================
//
// 注意：内存级限流在 Serverless 环境（如 Vercel Functions）中仅对
// 「热实例」有效。冷启动后计数器会重置，因此无法提供 100% 保障。
// 如需更严格的限流，建议使用 Vercel WAF / Vercel KV (Redis) 等方案。

/** 限流窗口（毫秒），默认 5 分钟 */
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "300000");
/** 窗口内最大失败次数，默认 5 次 */
const MAX_FAILURES = parseInt(process.env.RATE_LIMIT_MAX_FAILURES || "5");
/** Map 硬上限：防止内存无限增长（超出时强制淘汰最早的条目） */
const MAX_MAP_SIZE = 1000;

/** IP 级失败计数器 */
const failureMap = new Map<string, { count: number; resetAt: number }>();

/**
 * 清理过期条目
 * 每次写入时调用，确保 Map 不会无限增长
 */
function cleanupExpired() {
    const now = Date.now();
    for (const [ip, entry] of failureMap) {
        if (now >= entry.resetAt) {
            failureMap.delete(ip);
        }
    }
}

/**
 * 强制淘汰：当 Map 达到硬上限时，删除最早过期的一半条目
 * 保证即使在大规模攻击下内存也有上界
 */
function evictIfNeeded() {
    if (failureMap.size < MAX_MAP_SIZE) return;
    // 按 resetAt 升序排列，淘汰最早的一半
    const entries = [...failureMap.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const evictCount = Math.floor(entries.length / 2);
    for (let i = 0; i < evictCount; i++) {
        failureMap.delete(entries[i][0]);
    }
}

/**
 * 检查并更新限流状态
 * @returns true 表示已超限，应拒绝请求
 */
function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = failureMap.get(ip);

    // 条目不存在或已过期 → 主动删除过期条目
    if (!entry) return false;
    if (now >= entry.resetAt) {
        failureMap.delete(ip);
        return false;
    }

    return entry.count >= MAX_FAILURES;
}

/** 记录一次失败 */
function recordFailure(ip: string) {
    const now = Date.now();
    const entry = failureMap.get(ip);

    if (!entry || now >= entry.resetAt) {
        failureMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
        entry.count++;
    }

    cleanupExpired();
    evictIfNeeded();
}

/** 登录成功后清除失败计数 */
function clearFailures(ip: string) {
    failureMap.delete(ip);
}

// ==================== 路由处理 ====================

/**
 * POST /api/auth — 登录
 */
export async function POST(req: NextRequest) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";

    // 限流检查
    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: "尝试次数过多，请 5 分钟后重试" },
            { status: 429 }
        );
    }

    try {
        const { password } = await req.json();

        // 比对环境变量中的管理密码（恒定时间比较，防止时序攻击）
        const expected = process.env.ADMIN_PASSWORD!;
        const passwordValid =
            password &&
            expected &&
            password.length === expected.length &&
            timingSafeEqual(Buffer.from(password), Buffer.from(expected));
        if (!passwordValid) {
            recordFailure(ip);
            return NextResponse.json({ error: "密码错误" }, { status: 401 });
        }

        // 密码正确，签发 JWT（有效期 24h）
        clearFailures(ip);
        const token = await signJWT();

        // 构建响应：同时返回 token 和设置 Cookie（供 middleware 检查）
        const res = NextResponse.json({ token });
        res.cookies.set(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: TOKEN_EXPIRY_SECONDS,
        });

        return res;
    } catch {
        return NextResponse.json({ error: "登录失败" }, { status: 500 });
    }
}

/**
 * DELETE /api/auth — 退出登录（清除 Cookie）
 */
export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0, // 立即过期
    });
    return res;
}
