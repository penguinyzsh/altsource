/**
 * AltStore 源 JSON 生成器
 *
 * 根据数据库中的 App 和 Version 数据，生成符合
 * AltStore Classic 规范的 JSON 源文件。
 *
 * 主要功能：
 * - generateSourceJSON()：生成完整的源 JSON 结构
 * - generateNews()：从版本信息动态生成 AltStore News 通知
 *
 * 生成的 JSON 结构遵循 AltStore Classic Source 规范：
 * @see https://faq.altstore.io/developers/make-a-source
 */

import { prisma } from "@/core/db";
import {
    SITE_URL,
    DEFAULT_DEVELOPER_NAME,
    DEFAULT_TINT_COLOR,
    SOURCE_IDENTIFIER_PREFIX,
    SOURCE_NAME_SUFFIX,
} from "@/core/constants";

/** App 及其关联版本数据的类型定义 */
export interface AppWithVersions {
    id: string;
    slug: string;
    bundleIdentifier: string;
    name: string | null;
    developerName: string | null;
    subtitle: string | null;
    localizedDescription: string | null;
    iconURL: string | null;
    tintColor: string | null;
    category: string;
    minOSVersion: string | null;
    versions: {
        version: string;
        date: Date;
        localizedDescription: string | null;
        downloadURL: string;
        size: number;
    }[];
}

/**
 * 动态生成 AltStore News 项
 *
 * 为每个版本生成一条 News 通知，推送到 AltStore 客户端。
 * News 无需持久化到数据库，而是在生成源 JSON 时动态组装。
 *
 * @param app - App 数据（包含名称、主题色、bundleIdentifier）
 * @param version - 版本数据（包含版本号和日期）
 * @returns AltStore News 对象
 */
export function generateNews(
    app: AppWithVersions,
    version: AppWithVersions["versions"][0]
) {
    const name = app.name || app.slug;
    return {
        title: `${name} v${version.version} Released`,
        identifier: `${name}-${version.version}`,
        caption: `${name} has been updated to ${version.version}`,
        date: version.date.toISOString().split("T")[0], // 格式：YYYY-MM-DD
        tintColor: app.tintColor || DEFAULT_TINT_COLOR,
        notify: true,
        appID: app.bundleIdentifier, // AltStore 规范使用 appID 字段名
    };
}

/**
 * 将 Date 对象格式化为 YYYY-MM-DD 字符串（AltStore 规范格式）
 *
 * 注意：此格式化与 lib/utils.ts 中的中文日期格式 formatDate 语义不同，
 * 这里是 ISO 格式用于 JSON 输出，因此保持独立。
 */
function formatDateISO(date: Date): string {
    return date.toISOString().split("T")[0];
}

/**
 * 生成单个 App 的 AltStore 源 JSON
 *
 * 流程：
 * 1. 从数据库按 slug 读取 App 及其所有 Version
 * 2. Version 按发布日期倒序排列（最新在前，AltStore 规范要求）
 * 3. 组装为 AltStore 源 JSON 格式
 * 4. 动态生成 News 数组
 *
 * @param slug - App 的 URL 友好标识符（如 "pikapika"）
 * @returns 符合 AltStore 规范的源 JSON 对象，App 不存在时返回 null
 */
export async function generateSourceJSON(slug: string) {
    // 按 slug 查询 App 及其版本数据（按日期倒序）
    const app = await prisma.app.findUnique({
        where: { slug },
        include: {
            versions: {
                orderBy: { date: "desc" },
            },
        },
    });

    if (!app) return null;

    const siteUrl = SITE_URL;

    // 组装 AltStore 源 JSON 结构
    const sourceJson = {
        /** 源名称 */
        name: `${app.name || app.github}${SOURCE_NAME_SUFFIX}`,
        /** 源唯一标识符（使用 slug 避免与 bundleIdentifier 形成 com.altsource.com.x.y 的冗余格式） */
        identifier: `${SOURCE_IDENTIFIER_PREFIX}${app.slug}`,
        /** 源 URL（用于 AltStore 刷新，使用 slug 生成人类可读链接） */
        sourceURL: `${siteUrl}/api/source/${app.slug}`,
        /** 应用列表（每个源包含一个 App） */
        apps: [
            {
                name: app.name || app.github,
                bundleIdentifier: app.bundleIdentifier,
                developerName: app.developerName || DEFAULT_DEVELOPER_NAME,
                subtitle: app.subtitle || "",
                localizedDescription: app.localizedDescription || "",
                iconURL: app.iconURL || "",
                tintColor: app.tintColor || DEFAULT_TINT_COLOR,
                category: app.category,
                screenshots: [],
                /** 版本列表（倒序，最新在前） */
                versions: app.versions.map((v) => ({
                    version: v.version,
                    buildVersion: v.version, // buildVersion 复制 version 值
                    date: formatDateISO(v.date),
                    localizedDescription: v.localizedDescription || "",
                    downloadURL: v.downloadURL,
                    size: v.size,
                    ...(app.minOSVersion ? { minOSVersion: app.minOSVersion } : {}),
                })),
                appPermissions: {},
            },
        ],
        /** News 通知列表（从版本数据动态生成） */
        news: app.versions.map((v) => generateNews(app, v)),
    };

    return sourceJson;
}

