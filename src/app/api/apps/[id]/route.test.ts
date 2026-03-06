import { mock, describe, test, expect, beforeEach } from "bun:test";

// ==================== Mock Setup ====================

const mockIsAuthenticated = mock();

mock.module("@/core/auth", () => ({
    isAuthenticated: mockIsAuthenticated,
    signJWT: mock(),
    verifyJWT: mock(),
    isAuthorizedRefresh: mock(),
}));

const mockAppUpdate = mock();
const mockAppDelete = mock();

mock.module("@/core/db", () => ({
    prisma: {
        app: {
            update: mockAppUpdate,
            delete: mockAppDelete,
        },
    },
}));

// Mock Prisma error class
class MockPrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, meta: { code: string }) {
        super(message);
        this.code = meta.code;
        this.name = "PrismaClientKnownRequestError";
    }
}

mock.module("@prisma/client", () => ({
    Prisma: {
        PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    },
    PrismaClient: class {},
}));

import { PUT, DELETE } from "./route";

// ==================== Helpers ====================

function makeRequest(method: string, body?: object) {
    return new Request(`http://localhost/api/apps/test-id`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid-token",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    }) as unknown as import("next/server").NextRequest;
}

function makeParams(id = "test-id") {
    return { params: Promise.resolve({ id }) };
}

const fullApp = {
    id: "test-id",
    github: "user/repo",
    name: "Updated App",
    versions: [{ version: "1.0.0" }],
};

// ==================== Tests ====================

beforeEach(() => {
    mockIsAuthenticated.mockReset();
    mockAppUpdate.mockReset();
    mockAppDelete.mockReset();
});

describe("PUT /api/apps/[id]", () => {
    test("returns 401 when not authenticated", async () => {
        mockIsAuthenticated.mockResolvedValue(false);

        const res = await PUT(makeRequest("PUT", { name: "New" }), makeParams());

        expect(res.status).toBe(401);
    });

    test("updates allowed fields", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppUpdate.mockResolvedValue(fullApp);

        const updateBody = {
            name: "New Name",
            subtitle: "New Subtitle",
            tintColor: "#FF0000",
        };

        const res = await PUT(makeRequest("PUT", updateBody), makeParams());
        await res.json();

        expect(res.status).toBe(200);
        expect(mockAppUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "test-id" },
                data: expect.objectContaining({
                    name: "New Name",
                    subtitle: "New Subtitle",
                    tintColor: "#FF0000",
                }),
            })
        );
    });

    test("ignores non-whitelisted fields (id, github, slug)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppUpdate.mockResolvedValue(fullApp);

        const res = await PUT(
            makeRequest("PUT", {
                name: "OK",
                id: "hacked-id",
                github: "hacked/repo",
                slug: "hacked-slug",
                createdAt: "2020-01-01",
            }),
            makeParams()
        );

        expect(res.status).toBe(200);
        const updateCall = mockAppUpdate.mock.calls[0][0];
        expect(updateCall.data).not.toHaveProperty("id");
        expect(updateCall.data).not.toHaveProperty("github");
        expect(updateCall.data).not.toHaveProperty("slug");
        expect(updateCall.data).not.toHaveProperty("createdAt");
        expect(updateCall.data.name).toBe("OK");
    });

    test("returns 404 when app not found (P2025)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppUpdate.mockRejectedValue(
            new MockPrismaClientKnownRequestError("Not found", { code: "P2025" })
        );

        const res = await PUT(makeRequest("PUT", { name: "New" }), makeParams("nonexistent"));
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("App 不存在");
    });

    test("returns 500 on unexpected error", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppUpdate.mockRejectedValue(new Error("DB connection failed"));

        const res = await PUT(makeRequest("PUT", { name: "New" }), makeParams());

        expect(res.status).toBe(500);
    });
});

describe("DELETE /api/apps/[id]", () => {
    test("returns 401 when not authenticated", async () => {
        mockIsAuthenticated.mockResolvedValue(false);

        const res = await DELETE(makeRequest("DELETE"), makeParams());

        expect(res.status).toBe(401);
    });

    test("deletes app and returns success", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppDelete.mockResolvedValue({ id: "test-id" });

        const res = await DELETE(makeRequest("DELETE"), makeParams());
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockAppDelete).toHaveBeenCalledWith({ where: { id: "test-id" } });
    });

    test("returns 404 when app not found (P2025)", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppDelete.mockRejectedValue(
            new MockPrismaClientKnownRequestError("Not found", { code: "P2025" })
        );

        const res = await DELETE(makeRequest("DELETE"), makeParams("nonexistent"));
        const data = await res.json();

        expect(res.status).toBe(404);
        expect(data.error).toBe("App 不存在");
    });

    test("returns 500 on unexpected error", async () => {
        mockIsAuthenticated.mockResolvedValue(true);
        mockAppDelete.mockRejectedValue(new Error("DB error"));

        const res = await DELETE(makeRequest("DELETE"), makeParams());

        expect(res.status).toBe(500);
    });
});
