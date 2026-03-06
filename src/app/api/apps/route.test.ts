import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================

const mockIsAuthenticated = mock();

mock.module("@/core/auth", () => ({
    isAuthenticated: mockIsAuthenticated,
    signJWT: mock(),
    verifyJWT: mock(),
    isAuthorizedRefresh: mock(),
}));

const mockAppFindMany = mock();
const mockAppFindUnique = mock();
const mockAppCreate = mock();

mock.module("@/core/db", () => ({
    prisma: {
        app: {
            findMany: mockAppFindMany,
            findUnique: mockAppFindUnique,
            create: mockAppCreate,
        },
    },
}));

const mockFetchRepoInfo = mock();
const mockFetchReleases = mock();
const mockRefreshSingleApp = mock();

mock.module("@/services/github", () => ({
    fetchRepoInfo: mockFetchRepoInfo,
    fetchReleases: mockFetchReleases,
    refreshSingleApp: mockRefreshSingleApp,
}));

const mockExtractBundleId = mock();

mock.module("@/services/ipa-utils", () => ({
    extractBundleIdFromIPA: mockExtractBundleId,
}));

import { GET, POST } from "./route";

// ==================== Helpers ====================

function makeGetRequest(auth = true) {
    const req = new Request("http://localhost/api/apps", {
        method: "GET",
        headers: auth ? { Authorization: "Bearer valid-token" } : {},
    });
    return req as unknown as import("next/server").NextRequest;
}

function makePostRequest(body: object) {
    const req = new Request("http://localhost/api/apps", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
        },
        body: JSON.stringify(body),
    });
    return req as unknown as import("next/server").NextRequest;
}

const mockRepoInfo = {
    name: "my-app",
    description: "A cool app",
    iconURL: "https://icon.example.com/icon.png",
    developerName: "testuser",
};

// ==================== Tests ====================

beforeEach(() => {
    mockIsAuthenticated.mockReset();
    mockAppFindMany.mockReset();
    mockAppFindUnique.mockReset();
    mockAppCreate.mockReset();
    mockFetchRepoInfo.mockReset();
    mockFetchReleases.mockReset();
    mockRefreshSingleApp.mockReset();
    mockExtractBundleId.mockReset();
});

describe("GET /api/apps", () => {
    test("returns 401 when not authenticated", async () => {
        mockIsAuthenticated.mockResolvedValue(false);

        const res = await GET(makeGetRequest(false));
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe("未授权");
    });

    test("returns apps list when authenticated", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        const apps = [
            { id: "1", github: "user/app1", name: "App1", versions: [] },
            { id: "2", github: "user/app2", name: "App2", versions: [{ version: "1.0" }] },
        ];
        mockAppFindMany.mockResolvedValue(apps);

        const res = await GET(makeGetRequest());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data).toHaveLength(2);
        expect(data[0].name).toBe("App1");
    });

    test("returns 500 on database error", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindMany.mockRejectedValue(new Error("DB connection error"));

        const res = await GET(makeGetRequest());
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe("获取失败");
    });
});

describe("POST /api/apps", () => {
    test("returns 401 when not authenticated", async () => {
        mockIsAuthenticated.mockResolvedValue(false);

        const res = await POST(makePostRequest({ github: "user/repo" }));

        expect(res.status).toBe(401);
    });

    test("returns 400 for invalid github format", async () => {
        mockIsAuthenticated.mockResolvedValue(true);

        const cases = [
            { github: "" },
            { github: "noslash" },
            { github: "too/many/slashes" },
            { github: "has spaces/repo" },
        ];

        for (const body of cases) {
            const res = await POST(makePostRequest(body));
            const data = await res.json();
            expect(res.status).toBe(400);
            expect(data.error).toContain("github 格式错误");
        }
    });

    test("returns 409 for duplicate github repo", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValueOnce({ id: "existing" }); // findUnique by github

        const res = await POST(makePostRequest({ github: "user/repo" }));
        const data = await res.json();

        expect(res.status).toBe(409);
        expect(data.error).toBe("该仓库已添加");
    });

    test("creates app with provided bundleIdentifier", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)  // not duplicate
            .mockResolvedValueOnce(null)  // slug not taken
            .mockResolvedValueOnce({ id: "new-id", github: "user/repo", versions: [] }); // final fetch

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(
            makePostRequest({
                github: "user/repo",
                bundleIdentifier: "com.example.app",
            })
        );

        expect(res.status).toBe(201);
        expect(mockAppCreate).toHaveBeenCalledTimes(1);
        expect(mockExtractBundleId).not.toHaveBeenCalled();
    });

    test("auto-extracts bundleIdentifier from IPA when not provided", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)  // not duplicate
            .mockResolvedValueOnce(null)  // slug not taken
            .mockResolvedValueOnce({ id: "new-id", versions: [] }); // final fetch

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockFetchReleases.mockResolvedValue([
            {
                id: 1,
                assets: [
                    { name: "App.ipa", browser_download_url: "https://dl.example.com/App.ipa", size: 1000 },
                ],
            },
        ]);
        mockExtractBundleId.mockResolvedValue("com.auto.extracted");
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(makePostRequest({ github: "user/repo" }));

        expect(res.status).toBe(201);
        expect(mockExtractBundleId).toHaveBeenCalledWith("https://dl.example.com/App.ipa");
    });

    test("returns 400 when auto-extract fails (no releases with IPA)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValueOnce(null);
        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockFetchReleases.mockResolvedValue([]);

        const res = await POST(makePostRequest({ github: "user/repo" }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain("没有包含 .ipa");
    });

    test("returns 400 when bundle ID extraction returns null", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValueOnce(null);
        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockFetchReleases.mockResolvedValue([
            {
                id: 1,
                assets: [
                    { name: "App.ipa", browser_download_url: "https://dl.example.com/App.ipa", size: 1000 },
                ],
            },
        ]);
        mockExtractBundleId.mockResolvedValue(null);

        const res = await POST(makePostRequest({ github: "user/repo" }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain("无法自动提取");
    });

    test("generates unique slug from repo name", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)   // not duplicate
            .mockResolvedValueOnce({ id: "taken" }) // slug "repo" taken
            .mockResolvedValueOnce(null)   // slug "repo-1" available
            .mockResolvedValueOnce({ id: "new-id", versions: [] }); // final fetch

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(
            makePostRequest({
                github: "user/repo",
                bundleIdentifier: "com.test.app",
            })
        );

        expect(res.status).toBe(201);
        // Verify slug generation attempted "repo", found taken, used "repo-1"
        expect(mockAppCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ slug: "repo-1" }),
            })
        );
    });

    test("initial refresh failure does not block app creation", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "new-id", versions: [] });

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockRejectedValue(new Error("refresh failed"));

        const res = await POST(
            makePostRequest({
                github: "user/repo",
                bundleIdentifier: "com.test.app",
            })
        );

        // Still returns 201 despite refresh failure
        expect(res.status).toBe(201);
    });

    test("returns 500 on unexpected error (e.g., fetchRepoInfo throws)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValueOnce(null);
        mockFetchRepoInfo.mockRejectedValue(new Error("GitHub API down"));

        const res = await POST(
            makePostRequest({
                github: "user/repo",
                bundleIdentifier: "com.test.app",
            })
        );

        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe("添加失败");
    });

    test("多个 IPA 文件时 extractBundleIdFromRelease 选择文件名最短的", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)  // not duplicate
            .mockResolvedValueOnce(null)  // slug not taken
            .mockResolvedValueOnce({ id: "new-id", versions: [] }); // final fetch

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockFetchReleases.mockResolvedValue([
            {
                id: 1,
                assets: [
                    { name: "MyApp-unsigned-debug.ipa", browser_download_url: "https://dl.example.com/long.ipa", size: 2000 },
                    { name: "App.ipa", browser_download_url: "https://dl.example.com/short.ipa", size: 1000 },
                    { name: "MyApp-Release.ipa", browser_download_url: "https://dl.example.com/medium.ipa", size: 1500 },
                ],
            },
        ]);
        mockExtractBundleId.mockResolvedValue("com.test.app");
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(makePostRequest({ github: "user/repo" }));

        expect(res.status).toBe(201);
        // 应选择文件名最短的 "App.ipa"
        expect(mockExtractBundleId).toHaveBeenCalledWith("https://dl.example.com/short.ipa");
    });

    test("release 有资源但无 .ipa 文件时返回 400", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique.mockResolvedValueOnce(null);
        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockFetchReleases.mockResolvedValue([
            {
                id: 1,
                assets: [
                    { name: "source.zip", browser_download_url: "https://dl.example.com/src.zip", size: 500 },
                ],
            },
        ]);

        const res = await POST(makePostRequest({ github: "user/repo" }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toContain("无法自动提取");
    });

    test("custom fields override GitHub auto-fill values (APPS-POST-08)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppFindUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: "new-id", versions: [] });

        mockFetchRepoInfo.mockResolvedValue(mockRepoInfo);
        mockAppCreate.mockResolvedValue({ id: "new-id", github: "user/repo" });
        mockRefreshSingleApp.mockResolvedValue(undefined);

        const res = await POST(
            makePostRequest({
                github: "user/repo",
                bundleIdentifier: "com.custom.app",
                name: "自定义名称",
                developerName: "自定义开发者",
                localizedDescription: "自定义描述",
                iconURL: "https://custom.icon/img.png",
                subtitle: "自定义副标题",
                tintColor: "#FF0000",
                category: "games",
            })
        );

        expect(res.status).toBe(201);
        expect(mockAppCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    name: "自定义名称",
                    developerName: "自定义开发者",
                    localizedDescription: "自定义描述",
                    iconURL: "https://custom.icon/img.png",
                    subtitle: "自定义副标题",
                    tintColor: "#FF0000",
                    category: "games",
                }),
            })
        );
    });
});
