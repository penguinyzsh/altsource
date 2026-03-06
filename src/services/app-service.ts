/**
 * App 业务逻辑服务层
 *
 * 将 App 创建的核心业务逻辑从路由处理器中分离，
 * 包括去重检查、GitHub 信息获取、Bundle ID 提取、slug 生成等。
 */

import { prisma } from "@/core/db";
import { DEFAULT_CATEGORY, IPA_FILE_EXTENSION } from "@/core/constants";
import { fetchRepoInfo, fetchReleases, refreshSingleApp } from "@/services/github";
import { extractBundleIdFromIPA } from "@/services/ipa-utils";

/** 创建 App 的输入参数 */
interface CreateAppInput {
    github: string;
    bundleIdentifier?: string;
    minOSVersion?: string;
    name?: string;
    developerName?: string;
    localizedDescription?: string;
    iconURL?: string;
    subtitle?: string;
    tintColor?: string;
    category?: string;
}

/** 业务逻辑错误，携带 HTTP 状态码 */
export class AppServiceError extends Error {
    constructor(
        message: string,
        public statusCode: number
    ) {
        super(message);
    }
}

/**
 * 创建新 App
 *
 * 流程：检查重复 → 获取仓库信息 → 提取 Bundle ID → 生成 slug → 创建记录 → 初始刷新
 * @throws {AppServiceError} 业务逻辑错误（重复、无 Release、提取失败等）
 */
export async function createApp(input: CreateAppInput) {
    const { github } = input;
    // 空字符串视为未填写，触发自动提取
    let bundleIdentifier: string | null = input.bundleIdentifier?.trim() || "";

    // 检查是否已存在（同一仓库不能重复添加）
    const existing = await prisma.app.findUnique({ where: { github } });
    if (existing) {
        throw new AppServiceError("该仓库已添加", 409);
    }

    // 从 GitHub API 获取仓库信息用于自动填充
    const repoInfo = await fetchRepoInfo(github);

    // 如果没有提供 bundleIdentifier，自动从最新 IPA 提取
    if (!bundleIdentifier) {
        bundleIdentifier = await extractBundleIdFromRelease(github);
    }

    // 生成唯一 slug
    const slug = await generateUniqueSlug(github);

    // 创建 App 记录（管理员提供的值优先，否则使用 GitHub 自动值）
    const app = await prisma.app.create({
        data: {
            github,
            slug,
            bundleIdentifier,
            minOSVersion: input.minOSVersion || null,
            name: input.name || repoInfo.name,
            developerName: input.developerName || repoInfo.developerName,
            localizedDescription:
                input.localizedDescription || repoInfo.description,
            iconURL: input.iconURL || repoInfo.iconURL,
            subtitle: input.subtitle || null,
            tintColor: input.tintColor || null,
            category: input.category || DEFAULT_CATEGORY,
        },
    });

    // 立即触发一次数据抓取（获取版本信息）
    try {
        await refreshSingleApp(app);
    } catch (err) {
        console.error("初始数据抓取失败:", err);
        // 抓取失败不影响 App 创建，下次刷新会重试
    }

    // 重新获取包含版本的完整数据返回
    return prisma.app.findUnique({
        where: { id: app.id },
        include: {
            versions: { orderBy: { date: "desc" } },
        },
    });
}

/**
 * 从仓库最新 Release 的 IPA 文件中自动提取 Bundle Identifier
 */
async function extractBundleIdFromRelease(github: string): Promise<string> {
    console.log(`[自动提取] 正在从 ${github} 的最新 IPA 中提取 Bundle ID...`);

    const releases = await fetchReleases(github);
    if (releases.length === 0) {
        throw new AppServiceError(
            "该仓库没有包含 .ipa 文件的 Release，无法自动提取 Bundle Identifier",
            400
        );
    }

    // 取最新 Release 的第一个 IPA 文件（优先选短文件名）
    const latestRelease = releases[0];
    const ipaAsset = latestRelease.assets
        .filter((a) => a.name.endsWith(IPA_FILE_EXTENSION))
        .sort((a, b) => a.name.length - b.name.length)[0];

    let bundleId: string | null = null;
    if (ipaAsset) {
        bundleId = await extractBundleIdFromIPA(ipaAsset.browser_download_url);
        if (bundleId) {
            console.log(`[自动提取] 成功提取 Bundle ID: ${bundleId}`);
        }
    }

    if (!bundleId) {
        throw new AppServiceError("无法自动提取 Bundle Identifier，请手动填写", 400);
    }

    return bundleId;
}

/**
 * 从仓库名生成唯一的 URL 友好 slug
 */
async function generateUniqueSlug(github: string): Promise<string> {
    const repoName = github.split("/").pop() || github;
    const baseSlug = repoName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    let slug = baseSlug;
    let suffix = 1;
    while (await prisma.app.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${suffix}`;
        suffix++;
    }

    return slug;
}
