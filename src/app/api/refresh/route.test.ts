import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================

const mockIsAuthorizedRefresh = mock();

mock.module("@/core/auth", () => ({
    isAuthenticated: mock(),
    isAuthorizedRefresh: mockIsAuthorizedRefresh,
    signJWT: mock(),
    verifyJWT: mock(),
}));

const mockAppFindUnique = mock();

mock.module("@/core/db", () => ({
    prisma: {
        app: { findUnique: mockAppFindUnique },
    },
}));

const mockRefreshAllApps = mock();
const mockRefreshSingleApp = mock();

mock.module("@/services/github", () => ({
    refreshAllApps: mockRefreshAllApps,
    refreshSingleApp: mockRefreshSingleApp,
    fetchRepoInfo: mock(),
    fetchReleases: mock(),
}));

import { POST, GET } from "./route";

// ==================== Helpers ====================

function makePostRequest(body?: object) {
    return new Request("http://localhost/api/refresh", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    }) as unknown as import("next/server").NextRequest;
}

function makeGetRequest(auth = true) {
    return new Request("http://localhost/api/refresh", {
        method: "GET",
        headers: auth ? { Authorization: "Bearer cron-secret" } : {},
    }) as unknown as import("next/server").NextRequest;
}

// ==================== Tests ====================

beforeEach(() => {
    mockIsAuthorizedRefresh.mockReset();
    mockAppFindUnique.mockReset();
    mockRefreshAllApps.mockReset();
    mockRefreshSingleApp.mockReset();
});

describe("POST /api/refresh", () => {
    test("returns 401 when not authorized", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(false);

        const res = await POST(makePostRequest());

        expect(res.status).toBe(401);
    });

    test("refreshes single app when appId provided", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        const app = { id: "app-1", github: "user/repo" };
        mockAppFindUnique.mockResolvedValue(app);
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(makePostRequest({ appId: "app-1" }));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toContain("user/repo");
        expect(mockRefreshSingleApp).toHaveBeenCalledWith(app);
    });

    test("returns 404 when appId not found", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValue(null);

        const res = await POST(makePostRequest({ appId: "nonexistent" }));
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("App 不存在");
    });

    test("refreshes all apps when no appId", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockRefreshAllApps.mockResolvedValue({ success: 5, failed: 1 });

        const res = await POST(makePostRequest({}));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(5);
        expect(data.failed).toBe(1);
    });

    test("refreshes all apps when body is empty", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockRefreshAllApps.mockResolvedValue({ success: 3, failed: 0 });

        // Send request without body
        const req = new Request("http://localhost/api/refresh", {
            method: "POST",
            headers: { Authorization: "Bearer valid-token" },
        }) as unknown as import("next/server").NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(3);
    });

    test("returns 500 on refresh error", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockRefreshAllApps.mockRejectedValue(new Error("Network error"));

        const res = await POST(makePostRequest({}));

        expect(res.status).toBe(500);
    });
});

describe("GET /api/refresh — Cron", () => {
    test("returns 401 when not authorized", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(false);

        const res = await GET(makeGetRequest(false));

        expect(res.status).toBe(401);
    });

    test("refreshes all apps when authorized", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockRefreshAllApps.mockResolvedValue({ success: 10, failed: 0 });

        const res = await GET(makeGetRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(10);
        expect(data.failed).toBe(0);
    });

    test("returns 500 on error", async () => {
        mockIsAuthorizedRefresh.mockResolvedValue(true);
        mockRefreshAllApps.mockRejectedValue(new Error("DB timeout"));

        const res = await GET(makeGetRequest());

        expect(res.status).toBe(500);
    });
});
