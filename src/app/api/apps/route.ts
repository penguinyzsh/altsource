/**
 * App 管理 API 路由
 *
 * GET  /api/apps      — 获取所有 App 列表（需认证）
 * POST /api/apps      — 添加新 App（需认证）
 *
 * POST 负责认证和输入验证，业务逻辑委托给 app-service.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/db";
import { isAuthenticated } from "@/core/auth";
import { createApp, AppServiceError } from "@/services/app-service";

/** GitHub 仓库格式校验（owner/repo） */
const GITHUB_REPO_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

/**
 * GET /api/apps — 获取所有 App 列表
 * 返回所有 App 及其最新版本信息，按更新时间倒序
 */
export async function GET(req: NextRequest) {
    const authed = await isAuthenticated(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const apps = await prisma.app.findMany({
            include: {
                versions: {
                    orderBy: { date: "desc" },
                    take: 1, // 只取最新的一个版本
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return NextResponse.json(apps);
    } catch (err) {
        console.error("获取 App 列表失败:", err);
        return NextResponse.json(
            { error: "获取失败" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/apps — 添加新 App
 *
 * 请求体：
 * {
 *   github: "owner/repo",          // 必填
 *   bundleIdentifier?: "com.x.app",// 可选，未填写时自动从 IPA 提取
 *   minOSVersion?: "14.0",         // 可选
 *   name?: string,                 // 可选覆盖值
 *   ...其他覆盖字段
 * }
 */
export async function POST(req: NextRequest) {
    const authed = await isAuthenticated(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const body = await req.json() as Record<string, string | undefined>;
        const github = body.github;

        // 验证必填字段及格式（owner/repo）
        if (!github || !GITHUB_REPO_PATTERN.test(github)) {
            return NextResponse.json(
                { error: "github 格式错误，应为 owner/repo" },
                { status: 400 }
            );
        }

        const fullApp = await createApp({
            github,
            bundleIdentifier: body.bundleIdentifier,
            minOSVersion: body.minOSVersion,
            name: body.name,
            developerName: body.developerName,
            localizedDescription: body.localizedDescription,
            iconURL: body.iconURL,
            subtitle: body.subtitle,
            tintColor: body.tintColor,
            category: body.category,
        });

        return NextResponse.json(fullApp, { status: 201 });
    } catch (err) {
        if (err instanceof AppServiceError) {
            return NextResponse.json(
                { error: err.message },
                { status: err.statusCode }
            );
        }
        console.error("添加 App 失败:", err);
        return NextResponse.json(
            { error: "添加失败" },
            { status: 500 }
        );
    }
}

