/**
 * 单个 App 管理 API 路由
 *
 * PUT    /api/apps/[id] — 编辑 App 信息（需认证）
 * DELETE /api/apps/[id] — 删除 App 及其所有版本（需认证，级联删除）
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/core/db";
import { isAuthenticated } from "@/core/auth";

/**
 * PUT /api/apps/[id] — 编辑 App 信息
 *
 * 允许修改除 id 和 github 之外的所有字段。
 * 请求体中的 id、github、createdAt、updatedAt、versions 字段会被忽略。
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authed = await isAuthenticated(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const { id } = await params;
        const body = await req.json();

        // 白名单模式：只允许修改这些字段，防止 slug 等敏感字段被篡改
        const allowedFields = [
            "bundleIdentifier", "name", "developerName", "subtitle",
            "localizedDescription", "iconURL", "tintColor", "category", "minOSVersion",
        ] as const;
        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) {
            if (field in body) updateData[field] = body[field];
        }

        const app = await prisma.app.update({
            where: { id },
            data: updateData,
            include: {
                versions: {
                    orderBy: { date: "desc" },
                },
            },
        });

        return NextResponse.json(app);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            return NextResponse.json({ error: "App 不存在" }, { status: 404 });
        }
        console.error("编辑 App 失败:", err);
        return NextResponse.json({ error: "编辑失败" }, { status: 500 });
    }
}

/**
 * DELETE /api/apps/[id] — 删除 App
 *
 * 删除后，关联的 Version 记录会通过 Prisma 的 onDelete: Cascade 自动级联删除。
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authed = await isAuthenticated(req);
    if (!authed) {
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    try {
        const { id } = await params;
        await prisma.app.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
            return NextResponse.json({ error: "App 不存在" }, { status: 404 });
        }
        console.error("删除 App 失败:", err);
        return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }
}
