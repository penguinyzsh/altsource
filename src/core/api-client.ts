/**
 * 统一 API 调用层
 *
 * 封装所有管理面板的 HTTP 请求，提供：
 * - 自动附加 JWT Authorization header
 * - 统一 401 处理（清除 token + 重定向登录页）
 * - 统一响应解析和错误抛出
 *
 * 使用方式：
 *   import { apiClient } from "@/core/api-client";
 *   const apps = await apiClient.apps.list();
 *   await apiClient.apps.create({ github: "owner/repo", ... });
 */

import type { App, AddAppForm, EditAppForm } from "@/types";
import { LOCAL_STORAGE_TOKEN_KEY } from "@/core/constants";

/** API 请求错误，包含 HTTP 状态码和服务端错误信息 */
export class ApiError extends Error {
    constructor(
        public status: number,
        message: string
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/**
 * 从 localStorage 获取 JWT Token
 * 仅客户端可用，服务端环境返回 null
 */
function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY);
}

/**
 * 退出登录：清除 token（localStorage + Cookie）并跳转登录页
 *
 * 所有登录态清理逻辑的唯一收口点。
 * 先调用 DELETE /api/auth 清除 httpOnly Cookie，
 * 再清除 localStorage 中的 token。
 */
export async function logout() {
    try {
        await fetch("/api/auth", { method: "DELETE" });
    } catch {
        // 网络失败时仍然继续清理本地状态
    }
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY);
    window.location.href = "/admin/login";
}

/**
 * 通用 HTTP 请求封装
 *
 * - 自动附加 Authorization header（有 token 时）
 * - 401 响应时自动清除 token 并跳转登录页
 * - 非 2xx 响应时抛出 ApiError
 *
 * @param url - 请求路径
 * @param options - fetch 选项
 * @param skipAuth - 为 true 时跳过 Authorization header（用于登录接口）
 */
async function request<T>(
    url: string,
    options: RequestInit = {},
    skipAuth = false
): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };

    if (!skipAuth) {
        const token = getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 && !skipAuth) {
        logout();
        throw new ApiError(401, "未授权");
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(res.status, data.error || "请求失败");
    }

    return res.json();
}

/**
 * API 客户端
 *
 * 按资源分组，提供类型安全的 CRUD 方法：
 * - apiClient.apps.list() / create() / update() / delete()
 * - apiClient.refresh()
 * - apiClient.auth.login()
 */
export const apiClient = {
    /** App CRUD 操作 */
    apps: {
        /** 获取所有 App 列表 */
        list: () => request<App[]>("/api/apps"),

        /** 添加新 App */
        create: (data: AddAppForm) =>
            request<App>("/api/apps", {
                method: "POST",
                body: JSON.stringify(data),
            }),

        /** 编辑 App 信息 */
        update: (id: string, data: Partial<EditAppForm>) =>
            request<App>(`/api/apps/${id}`, {
                method: "PUT",
                body: JSON.stringify(data),
            }),

        /** 删除 App */
        delete: (id: string) =>
            request<{ success: boolean }>(`/api/apps/${id}`, {
                method: "DELETE",
            }),
    },

    /** 触发数据刷新（可选指定 appId） */
    refresh: (appId?: string) =>
        request<{ success?: number; failed?: number; message?: string }>(
            "/api/refresh",
            {
                method: "POST",
                body: JSON.stringify(appId ? { appId } : {}),
            }
        ),

    /** 认证相关 */
    auth: {
        /** 登录（不附加 Authorization header） */
        login: (password: string) =>
            request<{ token: string }>(
                "/api/auth",
                {
                    method: "POST",
                    body: JSON.stringify({ password }),
                },
                true // skipAuth: 登录接口不需要 token
            ),
    },
};
