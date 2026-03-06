import { describe, test, expect } from "bun:test";
import { proxy, config } from "./proxy";

// ==================== Helpers ====================

function makeRequest(path: string, cookie?: string) {
    const url = `http://localhost${path}`;
    const headers: Record<string, string> = {};
    if (cookie) {
        headers["cookie"] = cookie;
    }
    const req = new Request(url, { headers });

    // NextRequest wraps Request and adds cookies accessor
    // Simulate the cookies API that NextRequest provides
    return {
        ...req,
        url,
        cookies: {
            get: (name: string) => {
                if (!cookie) return undefined;
                const pairs = cookie.split(";").map((p) => p.trim());
                for (const pair of pairs) {
                    const [k, v] = pair.split("=");
                    if (k === name) return { value: v };
                }
                return undefined;
            },
        },
    } as unknown as import("next/server").NextRequest;
}

// ==================== Tests ====================

describe("proxy", () => {
    test("redirects to /admin/login when no auth-token cookie", () => {
        const req = makeRequest("/admin");
        const res = proxy(req);

        expect(res.status).toBe(307);
        const location = res.headers.get("location");
        expect(location).toContain("/admin/login");
    });

    test("allows access when auth-token cookie exists", () => {
        const req = makeRequest("/admin", "auth-token=some-jwt-token");
        const res = proxy(req);

        // NextResponse.next() returns a response that passes through
        expect(res.status).toBe(200);
    });

    test("redirects /admin subpaths when no cookie", () => {
        const req = makeRequest("/admin/dashboard");
        const res = proxy(req);

        expect(res.status).toBe(307);
    });

    test("allows /admin subpaths when cookie exists", () => {
        const req = makeRequest("/admin/settings", "auth-token=valid");
        const res = proxy(req);

        expect(res.status).toBe(200);
    });
});

describe("config", () => {
    test("matcher includes /admin", () => {
        expect(config.matcher).toContain("/admin");
    });

    test("matcher includes /admin sub-paths pattern (excluding login)", () => {
        // The second matcher pattern excludes /admin/login
        expect(config.matcher.length).toBeGreaterThanOrEqual(2);
        const subPathMatcher = config.matcher[1];
        expect(subPathMatcher).toContain("admin");
        expect(subPathMatcher).toContain("login");
    });
});
