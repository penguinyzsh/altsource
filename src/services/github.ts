/**
 * GitHub API 交互模块
 *
 * 负责与 GitHub REST API 通信，实现以下功能：
 * - fetchRepoInfo()：获取仓库基本信息（名称、描述、图标、开发者）
 * - fetchReleases()：获取仓库的 Releases，筛选含 .ipa 文件的稳定版本
 * - refreshSingleApp()：完整刷新单个 App 的版本数据
 * - refreshAllApps()：批量刷新所有 App（容错机制，单个失败不影响其他）
 *
 * 所有 API 请求均使用 GITHUB_TOKEN 认证（5000 次/小时配额），
 * 并包含带指数退避的重试机制。
 */

import { Octokit } from "@octokit/rest";
import { prisma } from "@/core/db";
import { extractVersion, cleanReleaseBody } from "./release-parser";
import { IPA_FILE_EXTENSION, GITHUB_RAW_URL } from "@/core/constants";

/** GitHub API 每页最大 Release 数量 */
const RELEASES_PER_PAGE = 100;
/** GitHub API 最大重试次数 */
const MAX_RETRIES = 3;
/** 重试基础延迟（毫秒），实际延迟 = BASE_DELAY * (重试次数) */
const RETRY_BASE_DELAY_MS = 1000;
/** 应用图标搜索模式（匹配 Xcode Asset Catalog 中的 AppIcon PNG） */
const ICON_SEARCH_PATTERN = /AppIcon.*\.png$/i;
/** 图标搜索优先目录前缀（优先 iOS 平台图标） */
const ICON_PREFERRED_PREFIX = "ios/";

/** 初始化 Octokit 实例，使用环境变量中的 GitHub Token 认证 */
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN!,
});

/**
 * 带重试的请求包装器
 *
 * 对 GitHub API 调用添加自动重试机制：
 * - 最多重试 3 次
 * - 递增延迟（1s, 2s, 3s）
 * - 遇到 403（Rate Limit）时记录重置时间警告
 *
 * @param fn - 需要执行的异步函数
 * @param retries - 最大重试次数，默认 3
 * @returns 函数执行结果
 */
async function fetchWithRetry<T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES
): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err: unknown) {
            // 安全地提取错误信息，兼容 Octokit 错误和普通 Error
            const status = err instanceof Object && "status" in err ? (err as { status: number }).status : undefined;

            // Rate Limit 用尽（HTTP 403），记录重置时间
            if (status === 403) {
                const headers = err instanceof Object && "response" in err
                    ? (err as { response?: { headers?: Record<string, string> } }).response?.headers
                    : undefined;
                const resetTime = headers?.["x-ratelimit-reset"];
                console.warn(`GitHub API Rate Limit，重置时间: ${resetTime}`);
            }

            // 最后一次重试仍失败，抛出错误
            if (i === retries - 1) throw err;

            // 递增延迟重试（1s, 2s, 3s）
            await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * (i + 1)));
        }
    }
    throw new Error("unreachable");
}

/**
 * 解析 "owner/repo" 格式的 GitHub 仓库地址
 * @param github - "owner/repo" 格式字符串
 * @returns { owner, repo } 对象
 */
function parseGithub(github: string) {
    const [owner, repo] = github.split("/");
    return { owner, repo };
}

/**
 * 在仓库文件树中搜索 App 图标
 *
 * 使用 GitHub Tree API 一次性获取整个仓库的文件树（1 次 API 调用），
 * 搜索 Xcode Asset Catalog 中的 AppIcon PNG 文件。
 *
 * 搜索模式：匹配 `AppIcon*.png`，覆盖以下常见路径：
 * - *\/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png
 * - *\/Images.xcassets/AppIcon.appiconset/AppIcon~ios-marketing.png
 * - 其他自定义位置的 AppIcon*.png
 *
 * 选择策略：按文件大小降序排序，最大的文件通常是最高分辨率（1024x1024）。
 *
 * @param owner - 仓库所有者
 * @param repo - 仓库名
 * @param defaultBranch - 默认分支名（如 main/master）
 * @returns 图标的 raw.githubusercontent.com 直链 URL，找不到返回 null
 */
async function findAppIcon(
    owner: string,
    repo: string,
    defaultBranch: string
): Promise<string | null> {
    try {
        // 一次 API 调用获取完整文件树（递归模式）
        const { data: tree } = await fetchWithRetry(() =>
            octokit.git.getTree({
                owner,
                repo,
                tree_sha: defaultBranch,
                recursive: "1",
            })
        );

        // 在文件树中搜索 AppIcon PNG 文件
        const iconFiles = tree.tree.filter(
            (item) =>
                item.type === "blob" &&
                item.path &&
                ICON_SEARCH_PATTERN.test(item.path) &&
                item.size !== undefined &&
                item.size > 0
        );

        if (iconFiles.length === 0) return null;

        // 选择策略：优先 ios 目录，然后按文件大小降序（最大 = 最高分辨率）
        // 避免选到 macOS/windows 等其他平台的图标
        const iosIcons = iconFiles.filter((f) => f.path?.startsWith(ICON_PREFERRED_PREFIX));
        const candidates = iosIcons.length > 0 ? iosIcons : iconFiles;
        candidates.sort((a, b) => (b.size || 0) - (a.size || 0));

        const bestIcon = candidates[0];
        if (!bestIcon.path) return null;

        // 构造 raw.githubusercontent.com 直链
        const iconURL = `${GITHUB_RAW_URL}/${owner}/${repo}/${defaultBranch}/${encodeURI(bestIcon.path)}`;
        console.log(
            `[${owner}/${repo}] 找到应用图标: ${bestIcon.path} (${bestIcon.size} bytes)`
        );

        return iconURL;
    } catch (err) {
        // 搜索失败不影响主流程，静默回退
        console.warn(`[${owner}/${repo}] 搜索应用图标失败:`, err);
        return null;
    }
}

/**
 * 获取 GitHub 仓库的基本信息
 *
 * 从仓库元数据中提取用于 App 自动填充的字段：
 * - name：仓库名称（可被管理员覆盖）
 * - description：仓库描述
 * - iconURL：优先用仓库中的 AppIcon，找不到时 fallback 到 owner 头像
 * - developerName：仓库 owner 的用户名
 *
 * @param github - "owner/repo" 格式的仓库地址
 * @param skipIconSearch - 为 true 时跳过图标搜索（已有图标时节省 API 调用）
 * @returns 仓库基本信息对象
 */
export async function fetchRepoInfo(github: string, skipIconSearch = false) {
    const { owner, repo } = parseGithub(github);
    const { data } = await fetchWithRetry(() =>
        octokit.repos.get({ owner, repo })
    );

    // 仅在未跳过时搜索图标（节省 GitHub Tree API 调用）
    let iconURL = data.owner.avatar_url;
    if (!skipIconSearch) {
        const appIconURL = await findAppIcon(owner, repo, data.default_branch);
        iconURL = appIconURL || data.owner.avatar_url;
    }

    return {
        name: data.name,
        description: data.description || "",
        iconURL,
        developerName: data.owner.login,
    };
}

/**
 * 获取仓库的 Releases 列表，筛选含 .ipa 的稳定版本
 *
 * 过滤规则：
 * 1. 跳过 prerelease（预发布）和 draft（草稿）
 * 2. 只保留包含 .ipa 文件的 Release
 * 3. 每页请求 100 条，通常已足够（仅保留最近 N 个版本）
 *
 * @param github - "owner/repo" 格式的仓库地址
 * @returns 筛选后的 Release 列表
 */
export async function fetchReleases(github: string) {
    const { owner, repo } = parseGithub(github);
    const { data: releases } = await fetchWithRetry(() =>
        octokit.repos.listReleases({ owner, repo, per_page: RELEASES_PER_PAGE })
    );

    // 达到分页上限时发出警告
    if (releases.length === RELEASES_PER_PAGE) {
        console.warn(
            `[${owner}/${repo}] Release 数量达到分页上限，可能存在遗漏`
        );
    }

    // 第一步过滤：跳过预发布和草稿
    const stableReleases = releases.filter((r) => !r.prerelease && !r.draft);

    // 第二步过滤：只保留含 .ipa 文件的 Release
    const ipaReleases = stableReleases.filter((r) =>
        r.assets.some((a) => a.name.endsWith(IPA_FILE_EXTENSION))
    );

    return ipaReleases;
}

/**
 * 刷新单个 App 的版本数据
 *
 * 完整流程：
 * 1. 获取仓库信息，回填 App 的自动字段（名称、描述、图标等）
 * 2. 获取 Releases 列表
 * 3. 用 Release ID 去重，只写入新版本
 * 4. 对每个新 Release 提取 .ipa 文件信息，写入 Version 表
 * 5. 清理超出保留数量的旧版本
 *
 * @param app - 数据库中的 App 记录
 */
export async function refreshSingleApp(app: {
    id: string;
    github: string;
    name: string | null;
    developerName: string | null;
    localizedDescription: string | null;
    iconURL: string | null;
}) {
    const { owner, repo } = parseGithub(app.github);
    const maxVersions = parseInt(process.env.MAX_VERSIONS || "3");

    // 步骤 1：获取仓库信息，回填尚未设置的自动字段
    await autoFillAppInfo(app);

    // 步骤 2：获取含 .ipa 的 Releases 并插入新版本
    const releases = await fetchReleases(app.github);
    await insertNewVersions(app.id, releases);

    // 步骤 3：版本保留策略 — 只保留最近 N 个版本
    const versionCount = await trimOldVersions(app.id, maxVersions);

    console.log(
        `[${owner}/${repo}] 刷新完成，当前 ${versionCount} 个版本`
    );
}

/**
 * 回填 App 中尚未设置的自动字段（名称、描述、图标等）
 * 已有图标时跳过 Tree API 搜索，节省 API 调用
 */
async function autoFillAppInfo(app: {
    id: string;
    github: string;
    name: string | null;
    developerName: string | null;
    localizedDescription: string | null;
    iconURL: string | null;
}) {
    const repoInfo = await fetchRepoInfo(app.github, !!app.iconURL);
    const autoFill: Record<string, string> = {};
    if (!app.name && repoInfo.name) autoFill.name = repoInfo.name;
    if (!app.developerName && repoInfo.developerName) autoFill.developerName = repoInfo.developerName;
    if (!app.localizedDescription && repoInfo.description) autoFill.localizedDescription = repoInfo.description;
    if (!app.iconURL && repoInfo.iconURL) autoFill.iconURL = repoInfo.iconURL;

    // 仅在有需要回填的字段时才写库，避免无效更新刷新 updatedAt
    if (Object.keys(autoFill).length > 0) {
        await prisma.app.update({
            where: { id: app.id },
            data: autoFill,
        });
    }
}

/**
 * 插入新版本，跳过已存在的 Release（基于 releaseId 去重）
 */
async function insertNewVersions(
    appId: string,
    releases: Awaited<ReturnType<typeof fetchReleases>>
) {
    const existingVersions = await prisma.version.findMany({
        where: { appId },
        select: { releaseId: true },
    });
    const existingReleaseIds = new Set(existingVersions.map((v) => v.releaseId));

    for (const release of releases) {
        if (existingReleaseIds.has(release.id)) continue;

        // 查找 .ipa 文件（若有多个，取文件名最短的，通常是通用版本）
        const ipaAssets = release.assets.filter((a) => a.name.endsWith(IPA_FILE_EXTENSION));
        if (ipaAssets.length === 0) continue;
        const ipaAsset = ipaAssets.sort(
            (a, b) => a.name.length - b.name.length
        )[0];

        await prisma.version.create({
            data: {
                appId,
                version: extractVersion(release.tag_name),
                date: new Date(release.published_at || release.created_at),
                localizedDescription: cleanReleaseBody(release.body || ""),
                downloadURL: ipaAsset.browser_download_url,
                size: ipaAsset.size,
                releaseId: release.id,
            },
        });
    }
}

/**
 * 版本保留策略 — 只保留最近 maxVersions 个版本，删除多余的
 * @returns 保留后的版本数量
 */
async function trimOldVersions(appId: string, maxVersions: number): Promise<number> {
    const allVersions = await prisma.version.findMany({
        where: { appId },
        orderBy: { date: "desc" },
    });

    if (allVersions.length > maxVersions) {
        const toDelete = allVersions.slice(maxVersions);
        await prisma.version.deleteMany({
            where: { id: { in: toDelete.map((v) => v.id) } },
        });
    }

    return Math.min(allVersions.length, maxVersions);
}

/** 分批并发处理的批次大小（控制 GitHub API 并发请求数） */
const CONCURRENCY = parseInt(process.env.CONCURRENCY || "3");
/** 游标分页每次取的数量 */
const PAGE_SIZE = parseInt(process.env.REFRESH_PAGE_SIZE || "10");

/**
 * 批量刷新所有已收录的 App
 *
 * 使用游标分页 + 分批并发策略，避免一次性加载全部 App 到内存：
 * - 每次从数据库取 PAGE_SIZE 条，处理完再取下一页
 * - 每页内按 CONCURRENCY 并发，平衡速度与 GitHub API 限额
 * - 每个 App 独立处理，单个 App 失败不影响其他 App
 * - 失败的 App 记录错误日志，下次 Cron 触发时自动重试
 *
 * @returns { success: number, failed: number } 刷新结果统计
 */
export async function refreshAllApps(): Promise<{
    success: number;
    failed: number;
}> {
    let success = 0;
    let failed = 0;
    let cursor: string | undefined;

    // 游标分页：每次取 PAGE_SIZE 条，减少内存占用
    while (true) {
        const apps = await prisma.app.findMany({
            take: PAGE_SIZE,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: "asc" },
        });

        if (apps.length === 0) break;
        cursor = apps[apps.length - 1].id;

        // 分批并发：每批 CONCURRENCY 个 App 同时刷新
        for (let i = 0; i < apps.length; i += CONCURRENCY) {
            const batch = apps.slice(i, i + CONCURRENCY);
            const results = await Promise.allSettled(
                batch.map((app) => refreshSingleApp(app))
            );

            for (const result of results) {
                if (result.status === "fulfilled") {
                    success++;
                } else {
                    failed++;
                    console.error("刷新失败:", result.reason);
                }
            }
        }
    }

    return { success, failed };
}
