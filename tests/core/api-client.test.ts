import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { ApiError } from "@/core/api-client";

// ==================== ApiError ====================

describe("ApiError", () => {
    test("包含 status 和 message", () => {
        const err = new ApiError(404, "Not found");
        expect(err.status).toBe(404);
        expect(err.message).toBe("Not found");
        expect(err.name).toBe("ApiError");
    });

    test("是 Error 的实例", () => {
        const err = new ApiError(500, "Server error");
        expect(err instanceof Error).toBe(true);
        expect(err instanceof ApiError).toBe(true);
    });
});

// ==================== request() 行为（通过 apiClient 间接测试）====================

// 模拟浏览器环境
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

function setupBrowserMocks() {
    // 模拟 localStorage
    const store = new Map<string, string>();
    const mockStorage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (_index: number) => null,
    } as Storage;

    Object.defineProperty(globalThis, "localStorage", {
        value: mockStorage,
        writable: true,
        configurable: true,
    });

    // 模拟 window.location
    if (typeof globalThis.window === "undefined") {
        Object.defineProperty(globalThis, "window", {
            value: { location: { href: "" } },
            writable: true,
            configurable: true,
        });
    }

    return { store, mockStorage };
}

function teardownBrowserMocks() {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
        // @ts-expect-error cleanup
        delete globalThis.window;
    }
    if (originalLocalStorage === undefined) {
        // @ts-expect-error cleanup
        delete globalThis.localStorage;
    }
}

describe("apiClient.apps.list()", () => {
    beforeEach(() => {
        setupBrowserMocks();
    });

    afterEach(() => {
        teardownBrowserMocks();
    });

    test("成功请求返回数据", async () => {
        const mockApps = [{ id: "1", name: "TestApp" }];
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(JSON.stringify(mockApps), { status: 200 }))
        );

        // 重新导入以使用新的 mock 环境
        const { apiClient } = await import("@/core/api-client");
        const result = await apiClient.apps.list();
        expect(result).toEqual(mockApps);
    });

    test("附加 Authorization header（有 token 时）", async () => {
        localStorage.setItem("token", "test-jwt-token");
        let capturedHeaders: Record<string, string> = {};

        globalThis.fetch = mock((url: string, options: RequestInit) => {
            capturedHeaders = options.headers as Record<string, string>;
            return Promise.resolve(new Response("[]", { status: 200 }));
        });

        const { apiClient } = await import("@/core/api-client");
        await apiClient.apps.list();
        expect(capturedHeaders["Authorization"]).toBe("Bearer test-jwt-token");
    });

    test("非 2xx 响应抛出 ApiError", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response(
                JSON.stringify({ error: "Forbidden" }),
                { status: 403 }
            ))
        );

        const { apiClient } = await import("@/core/api-client");
        try {
            await apiClient.apps.list();
            expect(true).toBe(false); // 不应到这里
        } catch (err) {
            expect(err instanceof ApiError).toBe(true);
            expect((err as ApiError).status).toBe(403);
            expect((err as ApiError).message).toBe("Forbidden");
        }
    });

    test("响应 JSON 解析失败时使用默认错误消息", async () => {
        globalThis.fetch = mock(() =>
            Promise.resolve(new Response("not json", { status: 500 }))
        );

        const { apiClient } = await import("@/core/api-client");
        try {
            await apiClient.apps.list();
            expect(true).toBe(false);
        } catch (err) {
            expect(err instanceof ApiError).toBe(true);
            expect((err as ApiError).status).toBe(500);
            expect((err as ApiError).message).toBe("请求失败");
        }
    });
});

describe("apiClient.apps.create()", () => {
    beforeEach(() => {
        setupBrowserMocks();
    });

    afterEach(() => {
        teardownBrowserMocks();
    });

    test("发送正确的 method 和 body", async () => {
        let capturedMethod = "";
        let capturedBody = "";

        globalThis.fetch = mock((_url: string, options: RequestInit) => {
            capturedMethod = options.method || "";
            capturedBody = options.body as string;
            return Promise.resolve(
                new Response(JSON.stringify({ id: "new" }), { status: 200 })
            );
        });

        const { apiClient } = await import("@/core/api-client");
        await apiClient.apps.create({ github: "owner/repo" });
        expect(capturedMethod).toBe("POST");
        expect(JSON.parse(capturedBody)).toEqual({ github: "owner/repo" });
    });
});

describe("apiClient.auth.login()", () => {
    beforeEach(() => {
        setupBrowserMocks();
    });

    afterEach(() => {
        teardownBrowserMocks();
    });

    test("不附加 Authorization header（skipAuth）", async () => {
        let capturedHeaders: Record<string, string> = {};
        localStorage.setItem("token", "existing-token");

        globalThis.fetch = mock((_url: string, options: RequestInit) => {
            capturedHeaders = options.headers as Record<string, string>;
            return Promise.resolve(
                new Response(JSON.stringify({ token: "new-jwt" }), { status: 200 })
            );
        });

        const { apiClient } = await import("@/core/api-client");
        const result = await apiClient.auth.login("password123");
        expect(result.token).toBe("new-jwt");
        expect(capturedHeaders["Authorization"]).toBeUndefined();
    });
});

describe("apiClient.refresh()", () => {
    beforeEach(() => {
        setupBrowserMocks();
    });

    afterEach(() => {
        teardownBrowserMocks();
    });

    test("无 appId 时发送空对象", async () => {
        let capturedBody = "";

        globalThis.fetch = mock((_url: string, options: RequestInit) => {
            capturedBody = options.body as string;
            return Promise.resolve(
                new Response(JSON.stringify({ success: 3, failed: 0 }), { status: 200 })
            );
        });

        const { apiClient } = await import("@/core/api-client");
        await apiClient.refresh();
        expect(JSON.parse(capturedBody)).toEqual({});
    });

    test("有 appId 时发送 { appId }", async () => {
        let capturedBody = "";

        globalThis.fetch = mock((_url: string, options: RequestInit) => {
            capturedBody = options.body as string;
            return Promise.resolve(
                new Response(JSON.stringify({ message: "ok" }), { status: 200 })
            );
        });

        const { apiClient } = await import("@/core/api-client");
        await apiClient.refresh("app-123");
        expect(JSON.parse(capturedBody)).toEqual({ appId: "app-123" });
    });
});
