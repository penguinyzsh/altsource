/**
 * 统一类型定义
 *
 * 项目中所有共享的 TypeScript 接口集中在此定义，
 * 作为 Single Source of Truth，避免多文件重复声明。
 */

/** 版本数据 */
export interface Version {
    id: string;
    version: string;
    date: string | Date;
    size: number;
    localizedDescription?: string | null;
    downloadURL?: string;
}

/** App 数据（从 API 响应或数据库映射） */
export interface App {
    id: string;
    github: string;
    slug?: string;
    bundleIdentifier: string;
    name: string | null;
    developerName: string | null;
    subtitle: string | null;
    localizedDescription: string | null;
    iconURL: string | null;
    tintColor: string | null;
    category: string;
    minOSVersion: string | null;
    updatedAt: string;
    versions: Version[];
}

/** 添加 App 表单数据 */
export interface AddAppForm {
    github: string;
    bundleIdentifier?: string; // 可选，未填写时自动从 IPA 提取 / Optional, auto-extracted from IPA if omitted
    minOSVersion?: string;     // 可选 / Optional
}

/** 编辑 App 表单数据 */
export interface EditAppForm {
    bundleIdentifier: string;
    name: string;
    developerName: string;
    subtitle: string;
    localizedDescription: string;
    iconURL: string;
    tintColor: string;
    category: string;
    minOSVersion: string;
}
