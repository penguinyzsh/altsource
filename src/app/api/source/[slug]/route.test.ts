import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================

const mockGenerateSourceJSON = mock();

mock.module("@/services/source-generator", () => ({
    generateSourceJSON: mockGenerateSourceJSON,
}));

import { GET } from "./route";

// ==================== Helpers ====================

function makeRequest(slug = "myapp") {
    return new Request(`http://localhost/api/source/${slug}`, {
        method: "GET",
    }) as unknown as import("next/server").NextRequest;
}

function makeParams(slug = "myapp") {
    return { params: Promise.resolve({ slug }) };
}

const mockSourceJSON = {
    name: "MyApp Source",
    identifier: "com.altsource.myapp",
    sourceURL: "http://localhost:3000/api/source/myapp",
    apps: [
        {
            name: "MyApp",
            bundleIdentifier: "com.example.myapp",
            versions: [{ version: "1.0.0", date: "2026-01-01" }],
        },
    ],
    news: [],
};

// ==================== Tests ====================

beforeEach(() => {
    mockGenerateSourceJSON.mockReset();
});

describe("GET /api/source/[slug]", () => {
    test("returns source JSON for existing app", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        const res = await GET(makeRequest(), makeParams());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.name).toBe("MyApp Source");
        expect(data.apps).toHaveLength(1);
        expect(data.apps[0].bundleIdentifier).toBe("com.example.myapp");
    });

    test("sets correct Content-Type header", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        const res = await GET(makeRequest(), makeParams());

        expect(res.headers.get("Content-Type")).toBe("application/json");
    });

    test("sets CORS headers for cross-origin access", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        const res = await GET(makeRequest(), makeParams());

        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
        expect(res.headers.get("Access-Control-Allow-Methods")).toBe("GET");
    });

    test("sets Cache-Control header for CDN caching", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        const res = await GET(makeRequest(), makeParams());
        const cacheControl = res.headers.get("Cache-Control");

        expect(cacheControl).toContain("s-maxage=86400");
        expect(cacheControl).toContain("stale-while-revalidate=3600");
    });

    test("returns 404 for non-existent app", async () => {
        mockGenerateSourceJSON.mockResolvedValue(null);

        const res = await GET(makeRequest("unknown"), makeParams("unknown"));
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("App 不存在");
    });

    test("returns 500 on internal error", async () => {
        mockGenerateSourceJSON.mockRejectedValue(new Error("DB error"));

        const res = await GET(makeRequest(), makeParams());
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe("生成失败");
    });

    test("passes slug parameter to generateSourceJSON", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        await GET(makeRequest("pikapika"), makeParams("pikapika"));

        expect(mockGenerateSourceJSON).toHaveBeenCalledWith("pikapika");
    });

    test("no authentication required (public endpoint)", async () => {
        mockGenerateSourceJSON.mockResolvedValue(mockSourceJSON);

        // Request without any auth headers
        const req = new Request("http://localhost/api/source/myapp", {
            method: "GET",
        }) as unknown as import("next/server").NextRequest;

        const res = await GET(req, makeParams());

        expect(res.status).toBe(200);
    });
});
