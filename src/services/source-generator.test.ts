import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================

const mockAppFindUnique = mock();

mock.module("@/core/db", () => ({
    prisma: {
        app: { findUnique: mockAppFindUnique },
    },
}));

// constants.ts 的导出值在模块加载时固化，可能被其他测试文件先加载导致值为 undefined
// 必须通过 mock.module 提供测试值
mock.module("@/core/constants", () => ({
    SITE_URL: "https://alt.example.com",
    SOURCE_IDENTIFIER_PREFIX: "com.altsource.",
    SOURCE_NAME_SUFFIX: " Source",
    DEFAULT_TINT_COLOR: "#007AFF",
    DEFAULT_DEVELOPER_NAME: "Unknown",
    DEFAULT_CATEGORY: "other",
    GITHUB_BASE_URL: "https://github.com",
    GITHUB_RAW_URL: "https://raw.githubusercontent.com",
    LOCAL_STORAGE_TOKEN_KEY: "token",
    AUTH_COOKIE_NAME: "auth-token",
    IPA_FILE_EXTENSION: ".ipa",
    GITHUB_REPO_URL: "",
}));

// Dynamic import to ensure mock.module takes effect
const { generateNews, generateSourceJSON } = await import("./source-generator");
type AppWithVersions = import("./source-generator").AppWithVersions;

// ==================== Test Data ====================

const mockApp: AppWithVersions = {
    id: "test-id",
    slug: "myapp",
    bundleIdentifier: "com.example.myapp",
    name: "MyApp",
    developerName: "Dev",
    subtitle: "A cool app",
    localizedDescription: "Description",
    iconURL: "https://example.com/icon.png",
    tintColor: "#FF0000",
    category: "utilities",
    minOSVersion: "14.0",
    versions: [],
};

const mockVersion = {
    version: "1.2.3",
    date: new Date("2026-03-01T12:00:00Z"),
    localizedDescription: "Bug fixes",
    downloadURL: "https://example.com/app.ipa",
    size: 1024 * 1024 * 50,
};

// ==================== Tests ====================

beforeEach(() => {
    mockAppFindUnique.mockReset();
});

describe("generateNews", () => {
    test("生成正确的 News 结构", () => {
        const news = generateNews(mockApp, mockVersion);

        expect(news.title).toBe("MyApp v1.2.3 Released");
        expect(news.identifier).toBe("MyApp-1.2.3");
        expect(news.caption).toBe("MyApp has been updated to 1.2.3");
        expect(news.date).toBe("2026-03-01");
        expect(news.tintColor).toBe("#FF0000");
        expect(news.notify).toBe(true);
        expect(news.appID).toBe("com.example.myapp");
    });

    test("tintColor 为 null 时使用默认值", () => {
        const appNoTint = { ...mockApp, tintColor: null };
        const news = generateNews(appNoTint, mockVersion);
        expect(news.tintColor).toBe("#007AFF");
    });

    test("日期格式为 YYYY-MM-DD", () => {
        const version = { ...mockVersion, date: new Date("2025-12-25T23:59:59Z") };
        const news = generateNews(mockApp, version);
        expect(news.date).toBe("2025-12-25");
    });

    test("name 为 null 时 fallback 到 slug", () => {
        const appNoName = { ...mockApp, name: null };
        const news = generateNews(appNoName, mockVersion);
        expect(news.title).toBe("myapp v1.2.3 Released");
        expect(news.identifier).toBe("myapp-1.2.3");
        expect(news.caption).toBe("myapp has been updated to 1.2.3");
    });
});

describe("generateSourceJSON", () => {
    // DB returns full App model (includes `github` field not in AppWithVersions)
    const dbApp = {
        ...mockApp,
        github: "testuser/my-app",
        versions: [
            {
                version: "1.2.0",
                date: new Date("2026-03-01"),
                localizedDescription: "New features",
                downloadURL: "https://dl.example.com/v1.2.0.ipa",
                size: 52428800,
            },
            {
                version: "1.1.0",
                date: new Date("2026-02-01"),
                localizedDescription: "Bug fixes",
                downloadURL: "https://dl.example.com/v1.1.0.ipa",
                size: 50000000,
            },
        ],
    };

    test("returns null for non-existent slug", async () => {
        mockAppFindUnique.mockResolvedValue(null);

        const result = await generateSourceJSON("nonexistent");

        expect(result).toBeNull();
    });

    test("generates correct top-level structure", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");

        expect(result).not.toBeNull();
        expect(result!.name).toBe("MyApp Source");
        expect(result!.identifier).toBe("com.altsource.myapp");
        expect(result!.sourceURL).toBe("https://alt.example.com/api/source/myapp");
    });

    test("generates correct app entry", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");
        const app = result!.apps[0];

        expect(app.name).toBe("MyApp");
        expect(app.bundleIdentifier).toBe("com.example.myapp");
        expect(app.developerName).toBe("Dev");
        expect(app.subtitle).toBe("A cool app");
        expect(app.tintColor).toBe("#FF0000");
        expect(app.category).toBe("utilities");
        expect(app.screenshots).toEqual([]);
    });

    test("maps versions with correct fields", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");
        const versions = result!.apps[0].versions;

        expect(versions).toHaveLength(2);
        expect(versions[0].version).toBe("1.2.0");
        expect(versions[0].buildVersion).toBe("1.2.0");
        expect(versions[0].date).toBe("2026-03-01");
        expect(versions[0].downloadURL).toBe("https://dl.example.com/v1.2.0.ipa");
        expect(versions[0].size).toBe(52428800);
    });

    test("includes minOSVersion in versions when set", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");
        const version = result!.apps[0].versions[0];

        expect(version.minOSVersion).toBe("14.0");
    });

    test("omits minOSVersion when null", async () => {
        mockAppFindUnique.mockResolvedValue({ ...dbApp, minOSVersion: null });

        const result = await generateSourceJSON("myapp");
        const version = result!.apps[0].versions[0];

        expect(version).not.toHaveProperty("minOSVersion");
    });

    test("generates news array from versions", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");

        expect(result!.news).toHaveLength(2);
        expect(result!.news[0].title).toBe("MyApp v1.2.0 Released");
        expect(result!.news[1].title).toBe("MyApp v1.1.0 Released");
    });

    test("uses fallback values for nullable fields", async () => {
        mockAppFindUnique.mockResolvedValue({
            ...dbApp,
            name: null,
            developerName: null,
            subtitle: null,
            localizedDescription: null,
            iconURL: null,
            tintColor: null,
        });

        const result = await generateSourceJSON("myapp");
        const app = result!.apps[0];

        expect(app.name).toBe("testuser/my-app"); // falls back to github
        expect(app.developerName).toBe("Unknown");
        expect(app.subtitle).toBe("");
        expect(app.localizedDescription).toBe("");
        expect(app.iconURL).toBe("");
        expect(app.tintColor).toBe("#007AFF");
    });

    test("uses SITE_URL env for sourceURL", async () => {
        mockAppFindUnique.mockResolvedValue(dbApp);

        const result = await generateSourceJSON("myapp");

        expect(result!.sourceURL).toContain("alt.example.com");
    });

    test("passes slug to prisma query", async () => {
        mockAppFindUnique.mockResolvedValue(null);

        await generateSourceJSON("pikapika");

        expect(mockAppFindUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { slug: "pikapika" },
            })
        );
    });
});
