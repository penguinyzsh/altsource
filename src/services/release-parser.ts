/**
 * Release 解析工具模块
 *
 * 包含两个核心功能：
 * - extractVersion()：从 tag 名称中提取纯版本号
 * - cleanReleaseBody()：清洗 GitHub Release 的 body 内容，
 *   去掉免责声明、赞助链接等无关信息，只保留版本更新日志
 */

// ==================== 解析配置 ====================

/** 版本号 tag 前缀模式（匹配 v 或 V） */
const VERSION_TAG_PREFIX = /^[vV]/;

/** Markdown 水平线分隔符（---、-----、***、___ 等） */
const HR_SEPARATOR = /^(?:[-*_]){3,}$/m;

/** 通用样板检测模式（覆盖各类仓库常见的非 changelog 内容） */
const BOILERPLATE_PATTERNS = [
    // 赞助/捐赠
    /sponsor|donat|support\s.*(?:contribut|develop)|buy\s+me\s+a\s+coffee|patreon|ko-?fi/i,
    // 免责声明
    /disclaimer|the author will not|liability|warrant(?:y|ies)/i,
    // 安装/验证提示（非更新内容）
    /please enter the above|how to install|installation guide/i,
    // GitHub 自动生成的 "Full Changelog" 链接
    /\*\*Full Changelog\*\*/i,
];

/** GitHub 自动生成的 Full Changelog 链接行 */
const FULL_CHANGELOG_LINE = /^.*\*\*Full Changelog\*\*.*$/gim;

function isBoilerplate(section: string): boolean {
    return BOILERPLATE_PATTERNS.some((p) => p.test(section));
}

// ==================== 核心函数 ====================

/**
 * 从 tag 名称中提取纯版本号
 *
 * 兼容 "v1.8.19" 和 "1.8.17" 两种 tag 格式，
 * 统一去掉前缀 v/V，返回纯数字版本号。
 *
 * @param tagName - GitHub Release 的 tag 名称
 * @returns 去掉 v 前缀后的版本号字符串
 *
 * @example
 * extractVersion("v1.8.19") // "1.8.19"
 * extractVersion("1.8.17")  // "1.8.17"
 */
export function extractVersion(tagName: string): string {
    return tagName.replace(VERSION_TAG_PREFIX, "");
}

/**
 * 清洗 GitHub Release body 内容
 *
 * 使用通用模式匹配识别并移除常见的非 changelog 内容：
 * - 赞助/捐赠信息
 * - 免责声明
 * - 安装/验证提示
 * - GitHub 自动生成的 Full Changelog 链接
 *
 * 按 Markdown 水平线分段，过滤样板段落，
 * 并从有效段中移除 Full Changelog 链接行。
 *
 * @param body - GitHub Release 的 body 原始文本
 * @returns 清洗后的版本更新日志
 */
export function cleanReleaseBody(body: string): string {
    if (!body) return "";

    // 按 Markdown 水平线分段
    const sections = body
        .split(HR_SEPARATOR)
        .map((s) => s.trim())
        .filter(Boolean);

    // 从每个段中移除 Full Changelog 链接行，再判断是否为样板
    const cleaned = sections
        .map((s) => s.replace(FULL_CHANGELOG_LINE, "").trim())
        .filter(Boolean)
        .filter((s) => !isBoilerplate(s));

    return cleaned[0] || "";
}
