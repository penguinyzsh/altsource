import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================
// mock.module must run BEFORE the module under test is loaded.
// Using dynamic import (await import) ensures correct ordering,
// since static imports are hoisted above mock.module calls.

const mockReposGet = mock();
const mockListReleases = mock();
const mockGetTree = mock();

mock.module("@octokit/rest", () => ({
    Octokit: class MockOctokit {
        constructor(_opts?: unknown) {}
        repos = { get: mockReposGet, listReleases: mockListReleases };
        git = { getTree: mockGetTree };
    },
}));

const mockAppFindMany = mock();
const mockAppUpdate = mock();
const mockVersionFindMany = mock();
const mockVersionCreate = mock();
const mockVersionDeleteMany = mock();

mock.module("@/core/db", () => ({
    prisma: {
        app: { findMany: mockAppFindMany, update: mockAppUpdate },
        version: {
            findMany: mockVersionFindMany,
            create: mockVersionCreate,
            deleteMany: mockVersionDeleteMany,
        },
    },
}));

// Dynamic import — loaded AFTER mock.module takes effect
const { fetchRepoInfo, fetchReleases, refreshSingleApp, refreshAllApps } =
    await import("./github");

// ==================== Helpers ====================

const makeRepoData = (overrides = {}) => ({
    name: "my-app",
    description: "A cool app",
    default_branch: "main",
    owner: { login: "testuser", avatar_url: "https://avatar.example.com/u/1" },
    ...overrides,
});

const makeRelease = (overrides: Record<string, unknown> = {}) => ({
    id: 100,
    tag_name: "v1.0.0",
    prerelease: false,
    draft: false,
    body: "Release notes",
    published_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    assets: [
        {
            name: "App.ipa",
            browser_download_url: "https://example.com/App.ipa",
            size: 1024000,
        },
    ],
    ...overrides,
});

// ==================== Tests ====================

beforeEach(() => {
    mockReposGet.mockReset();
    mockListReleases.mockReset();
    mockGetTree.mockReset();
    mockAppFindMany.mockReset();
    mockAppUpdate.mockReset();
    mockVersionFindMany.mockReset();
    mockVersionCreate.mockReset();
    mockVersionDeleteMany.mockReset();
});

describe("fetchRepoInfo", () => {
    test("returns repo name, description, icon, developer", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({
            data: { tree: [] },
        });

        const info = await fetchRepoInfo("testuser/my-app");

        expect(info.name).toBe("my-app");
        expect(info.description).toBe("A cool app");
        expect(info.developerName).toBe("testuser");
        expect(info.iconURL).toBe("https://avatar.example.com/u/1");
    });

    test("finds AppIcon from repo tree", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({
            data: {
                tree: [
                    {
                        type: "blob",
                        path: "App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png",
                        size: 50000,
                    },
                ],
            },
        });

        const info = await fetchRepoInfo("testuser/my-app");

        expect(info.iconURL).toContain("AppIcon-1024.png");
        expect(info.iconURL).toContain("raw.githubusercontent.com");
    });

    test("prefers ios/ directory icons", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({
            data: {
                tree: [
                    { type: "blob", path: "mac/AppIcon.png", size: 80000 },
                    { type: "blob", path: "ios/Assets.xcassets/AppIcon.png", size: 40000 },
                ],
            },
        });

        const info = await fetchRepoInfo("testuser/my-app");
        expect(info.iconURL).toContain("ios/");
    });

    test("skipIconSearch uses avatar directly", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });

        const info = await fetchRepoInfo("testuser/my-app", true);

        expect(info.iconURL).toBe("https://avatar.example.com/u/1");
        expect(mockGetTree).not.toHaveBeenCalled();
    });

    test("empty description defaults to empty string", async () => {
        mockReposGet.mockResolvedValue({
            data: makeRepoData({ description: null }),
        });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });

        const info = await fetchRepoInfo("testuser/my-app");
        expect(info.description).toBe("");
    });

    test("getTree 抛出异常时回退到 avatar 图标", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockRejectedValue(new Error("Tree API 500"));

        const info = await fetchRepoInfo("testuser/my-app");

        // findAppIcon catch 捕获异常，iconURL 回退到 avatar
        expect(info.iconURL).toBe("https://avatar.example.com/u/1");
    });

    test("handles GitHub API 403 Rate Limit error", async () => {
        const origSetTimeout = globalThis.setTimeout;
        globalThis.setTimeout = ((fn: (...args: unknown[]) => void) =>
            origSetTimeout(fn, 0)) as typeof setTimeout;

        const rateLimitError = Object.assign(new Error("Rate limited"), {
            status: 403,
            response: { headers: { "x-ratelimit-reset": "1700000000" } },
        });
        mockReposGet.mockRejectedValue(rateLimitError);

        try {
            await fetchRepoInfo("testuser/my-app");
            expect(true).toBe(false); // should have thrown
        } catch (err: unknown) {
            expect(err).toHaveProperty("status", 403);
        }

        globalThis.setTimeout = origSetTimeout;
    });
});

describe("fetchReleases", () => {
    test("returns stable releases with IPA assets", async () => {
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({ id: 1, tag_name: "v1.0.0" }),
                makeRelease({ id: 2, tag_name: "v0.9.0" }),
            ],
        });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(2);
    });

    test("filters out prerelease", async () => {
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({ id: 1, prerelease: true }),
                makeRelease({ id: 2, tag_name: "v1.0.0" }),
            ],
        });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(1);
        expect(releases[0].id).toBe(2);
    });

    test("filters out draft releases", async () => {
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({ id: 1, draft: true }),
                makeRelease({ id: 2 }),
            ],
        });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(1);
    });

    test("filters out releases without IPA", async () => {
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({
                    id: 1,
                    assets: [{ name: "README.md", browser_download_url: "...", size: 100 }],
                }),
                makeRelease({ id: 2 }),
            ],
        });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(1);
        expect(releases[0].id).toBe(2);
    });

    test("returns empty array when no matching releases", async () => {
        mockListReleases.mockResolvedValue({ data: [] });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(0);
    });

    test("releases 达到分页上限（100）时正常返回", async () => {
        const releases100 = Array.from({ length: 100 }, (_, i) =>
            makeRelease({ id: i + 1, tag_name: `v${i + 1}.0.0` })
        );
        mockListReleases.mockResolvedValue({ data: releases100 });

        const releases = await fetchReleases("testuser/my-app");
        expect(releases).toHaveLength(100);
    });
});

describe("refreshSingleApp", () => {
    const baseApp = {
        id: "app-1",
        github: "testuser/my-app",
        name: null as string | null,
        developerName: null as string | null,
        localizedDescription: null as string | null,
        iconURL: null as string | null,
    };

    test("auto-fills missing fields from repo info", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });
        mockListReleases.mockResolvedValue({ data: [] });
        mockVersionFindMany.mockResolvedValue([]);

        await refreshSingleApp(baseApp);

        expect(mockAppUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "app-1" },
                data: expect.objectContaining({
                    name: "my-app",
                    developerName: "testuser",
                    localizedDescription: "A cool app",
                }),
            })
        );
    });

    test("skips update when all fields already set", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockListReleases.mockResolvedValue({ data: [] });
        mockVersionFindMany.mockResolvedValue([]);

        const appWithFields = {
            ...baseApp,
            name: "Existing",
            developerName: "Dev",
            localizedDescription: "Desc",
            iconURL: "https://icon.png",
        };

        await refreshSingleApp(appWithFields);

        expect(mockAppUpdate).not.toHaveBeenCalled();
    });

    test("creates new versions for new releases", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({ id: 100, tag_name: "v1.0.0" }),
                makeRelease({ id: 101, tag_name: "v1.1.0" }),
            ],
        });
        mockVersionFindMany
            .mockResolvedValueOnce([]) // existing versions (none)
            .mockResolvedValueOnce([   // all versions after insert
                { id: "v1", date: new Date() },
                { id: "v2", date: new Date() },
            ]);

        await refreshSingleApp(baseApp);

        expect(mockVersionCreate).toHaveBeenCalledTimes(2);
    });

    test("deduplicates by releaseId", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });
        mockListReleases.mockResolvedValue({
            data: [makeRelease({ id: 100 }), makeRelease({ id: 101 })],
        });
        mockVersionFindMany
            .mockResolvedValueOnce([{ releaseId: 100 }]) // already have release 100
            .mockResolvedValueOnce([{ id: "v1", date: new Date() }]);

        await refreshSingleApp(baseApp);

        expect(mockVersionCreate).toHaveBeenCalledTimes(1);
    });

    test("cleans up old versions beyond MAX_VERSIONS", async () => {
        process.env.MAX_VERSIONS = "2";

        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });
        mockListReleases.mockResolvedValue({ data: [] });
        mockVersionFindMany
            .mockResolvedValueOnce([]) // existing versions
            .mockResolvedValueOnce([   // all versions (3 > MAX_VERSIONS=2)
                { id: "v1", date: new Date("2026-03-01") },
                { id: "v2", date: new Date("2026-02-01") },
                { id: "v3", date: new Date("2026-01-01") },
            ]);

        await refreshSingleApp(baseApp);

        expect(mockVersionDeleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["v3"] } },
        });

        delete process.env.MAX_VERSIONS;
    });

    test("selects shortest IPA filename when multiple exist", async () => {
        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockGetTree.mockResolvedValue({ data: { tree: [] } });
        mockListReleases.mockResolvedValue({
            data: [
                makeRelease({
                    id: 200,
                    assets: [
                        { name: "App-arm64.ipa", browser_download_url: "https://long.ipa", size: 2000 },
                        { name: "App.ipa", browser_download_url: "https://short.ipa", size: 1000 },
                    ],
                }),
            ],
        });
        mockVersionFindMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: "v1", date: new Date() }]);

        await refreshSingleApp(baseApp);

        expect(mockVersionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    downloadURL: "https://short.ipa",
                }),
            })
        );
    });
});

describe("refreshAllApps", () => {
    // refreshAllApps uses cursor pagination: first call returns apps, second returns []
    test("returns success/failed counts", async () => {
        mockAppFindMany
            .mockResolvedValueOnce([
                { id: "1", github: "user/a", name: "A", developerName: "u", localizedDescription: "d", iconURL: "i" },
                { id: "2", github: "user/b", name: "B", developerName: "u", localizedDescription: "d", iconURL: "i" },
            ])
            .mockResolvedValueOnce([]); // end of pagination

        mockReposGet.mockResolvedValue({ data: makeRepoData() });
        mockListReleases.mockResolvedValue({ data: [] });
        mockVersionFindMany.mockResolvedValue([]);

        const result = await refreshAllApps();

        expect(result.success).toBe(2);
        expect(result.failed).toBe(0);
    });

    test("isolates failures — one app failing doesn't block others", async () => {
        // Speed up fetchWithRetry's setTimeout delays (1s→0, 2s→0, 3s→0)
        const origSetTimeout = globalThis.setTimeout;
        globalThis.setTimeout = ((fn: (...args: unknown[]) => void) => origSetTimeout(fn, 0)) as typeof setTimeout;

        mockAppFindMany
            .mockResolvedValueOnce([
                { id: "1", github: "user/a", name: "A", developerName: "u", localizedDescription: "d", iconURL: "i" },
                { id: "2", github: "user/fail", name: "B", developerName: "u", localizedDescription: "d", iconURL: "i" },
            ])
            .mockResolvedValueOnce([]); // end of pagination

        // Use mockImplementation to route by argument — handles concurrent calls safely
        mockReposGet.mockImplementation(({ repo }: { owner: string; repo: string }) => {
            if (repo === "fail") return Promise.reject(new Error("API error"));
            return Promise.resolve({ data: makeRepoData() });
        });

        mockListReleases.mockResolvedValue({ data: [] });
        mockVersionFindMany.mockResolvedValue([]);

        const result = await refreshAllApps();

        globalThis.setTimeout = origSetTimeout;

        expect(result.success).toBe(1);
        expect(result.failed).toBe(1);
    });

    test("returns 0/0 when no apps", async () => {
        mockAppFindMany.mockResolvedValueOnce([]); // empty first page

        const result = await refreshAllApps();

        expect(result.success).toBe(0);
        expect(result.failed).toBe(0);
    });
});
