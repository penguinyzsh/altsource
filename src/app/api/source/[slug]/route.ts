/**
 * AltStore 源 JSON 公开端点
 *
 * GET /api/source/[slug] — 返回指定 App 的 AltStore 源 JSON
 *
 * 这是唯一的公开端点（无需认证），供 AltStore 客户端订阅。
 * 使用人类可读的 slug 作为 URL 标识，如 /api/source/pikapika
 *
 * 响应头设置：
 * - CORS: 允许所有来源访问
 * - Cache-Control: CDN 缓存 24 小时（与 Cron 每日刷新对齐）
 * - stale-while-revalidate: 过期后 1 小时内仍返回旧数据
 */

import { NextRequest, NextResponse } from "next/server";
import { generateSourceJSON } from "@/services/source-generator";

/** CDN 缓存时长（秒）：24 小时，与 Cron 每日刷新对齐 */
const CDN_MAX_AGE = 86400;
/** 过期后仍返回旧数据的时长（秒）：1 小时 */
const STALE_WHILE_REVALIDATE = 3600;

/**
 * GET /api/source/[slug] — 生成并返回 AltStore 源 JSON
 *
 * AltStore 客户端通过此 URL 订阅和刷新应用源。
 * 每个 App 独立生成源 JSON，用户按需单独订阅。
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const sourceJson = await generateSourceJSON(slug);

        // App 不存在时返回 404
        if (!sourceJson) {
            return NextResponse.json({ error: "App 不存在" }, { status: 404 });
        }

        // 返回 JSON 并设置缓存和 CORS 头
        return new NextResponse(JSON.stringify(sourceJson, null, 2), {
            headers: {
                "Content-Type": "application/json",
                // CDN 缓存 24 小时，过期后 1 小时内 stale-while-revalidate
                "Cache-Control": `s-maxage=${CDN_MAX_AGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
                // 允许所有来源的跨域请求
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
            },
        });
    } catch (err) {
        console.error("生成源 JSON 失败:", err);
        return NextResponse.json(
            { error: "生成失败" },
            { status: 500 }
        );
    }
}

