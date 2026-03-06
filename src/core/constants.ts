/**
 * 项目共享常量
 *
 * 集中管理跨文件使用的硬编码值，避免重复和不一致。
 * 单文件内使用的常量仍留在各自文件中。
 */

// ===== 站点 =====

/** 站点 URL（自动补全协议前缀，防止被当作相对路径） */
const rawSiteUrl = process.env.SITE_URL || "";
export const SITE_URL = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;

/** 项目 GitHub 仓库 URL */
export const GITHUB_REPO_URL = process.env.NEXT_PUBLIC_GITHUB_REPO_URL!;

// ===== 品牌/源标识 =====

/** 源标识符前缀（如 com.altsource.pikapika） */
export const SOURCE_IDENTIFIER_PREFIX = process.env.SOURCE_IDENTIFIER_PREFIX!;
/** 源名称后缀（如 "pikapika Source"） */
export const SOURCE_NAME_SUFFIX = " Source";
/** AltStore 默认主题色（iOS 系统蓝） */
export const DEFAULT_TINT_COLOR = "#007AFF";

// ===== localStorage Key =====

/** 客户端 localStorage 中存储 JWT Token 的键名 */
export const LOCAL_STORAGE_TOKEN_KEY = "token";

// ===== GitHub 基础 URL =====

/** GitHub 站点基础 URL */
export const GITHUB_BASE_URL = "https://github.com";
/** GitHub Raw 文件基础 URL */
export const GITHUB_RAW_URL = "https://raw.githubusercontent.com";

// ===== 业务默认值 =====

/** 默认开发者名称（未从 GitHub 获取到时的 fallback） */
export const DEFAULT_DEVELOPER_NAME = "Unknown";

/** 默认应用分类 */
export const DEFAULT_CATEGORY = "other";

// ===== 认证 =====

/** 认证 Cookie 名称 */
export const AUTH_COOKIE_NAME = "auth-token";

// ===== 文件类型 =====

/** IPA 文件扩展名 */
export const IPA_FILE_EXTENSION = ".ipa";
