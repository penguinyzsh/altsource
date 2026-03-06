/**
 * Next.js Proxy — 管理后台路由保护
 *
 * 拦截 /admin 路径（不含 /admin/login）的请求：
 * - 检查 Cookie 中的 auth-token 是否存在
 * - 缺少时重定向到 /admin/login
 *
 * 注意：这只是前端路由保护（检查 Cookie 存在性），
 * 实际的 JWT 验证由 API 路由层完成。
 *
 * Next.js 16 使用 proxy.ts 替代了 middleware.ts。
 */

import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/core/constants";

export function proxy(req: NextRequest) {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
        const loginUrl = new URL("/admin/login", req.url);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

/** 匹配 /admin 及其所有子路由，排除 /admin/login */
export const config = {
    matcher: ["/admin", "/admin/((?!login).*)"],
};
