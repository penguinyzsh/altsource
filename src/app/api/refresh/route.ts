/**
 * 数据刷新 API 路由
 *
 * POST /api/refresh — 手动触发刷新（支持全部或单个 App）
 * GET  /api/refresh — Vercel Cron 定时触发全量刷新
 *
 * 鉴权方式：
 * - Vercel Cron 请求携带 CRON_SECRET
 * - 管理员手动触发携带 JWT Token
 *
 * 请求体（POST，可选）：
 * { appId?: string } — 指定 appId 则只刷新该 App，否则全部刷新
 */

import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRefresh } from "@/core/auth";
import { refreshAllApps, refreshSingleApp } from "@/services/github";
import { prisma } from "@/core/db";

/**
 * POST /api/refresh — 手动触发数据刷新
 *
 * 支持两种模式：
 * 1. 指定 appId → 只刷新该 App
 * 2. 不指定 → 全量刷新所有 App
 */
export async function POST(req: NextRequest) {
    const authed = await isAuthorizedRefresh(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        // 尝试从请求体读取 appId（可选参数）
        let appId: string | null = null;
        try {
            const body = await req.json();
            appId = body.appId || null;
        } catch {
            // 请求体为空或解析失败，执行全部刷新
        }

        // 单个 App 刷新
        if (appId) {
            const app = await prisma.app.findUnique({ where: { id: appId } });
            if (!app) {
                return NextResponse.json({ error: "App 不存在" }, { status: 404 });
            }
            await refreshSingleApp(app);
            return NextResponse.json({ success: true, message: `${app.github} 刷新完成` });
        }

        // 全量刷新
        const result = await refreshAllApps();
        return NextResponse.json(result);
    } catch (err) {
        console.error("刷新失败:", err);
        return NextResponse.json({ error: "刷新失败" }, { status: 500 });
    }
}

/**
 * GET /api/refresh — Vercel Cron 定时触发
 *
 * Vercel Cron 使用 GET 方法调用此端点，
 * 配合 vercel.json 中的 crons 配置实现每天自动刷新。
 */
export async function GET(req: NextRequest) {
    const authed = await isAuthorizedRefresh(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const result = await refreshAllApps();
        return NextResponse.json(result);
    } catch (err) {
        console.error("刷新失败:", err);
        return NextResponse.json({ error: "刷新失败" }, { status: 500 });
    }
}
