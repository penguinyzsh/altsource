import { mock, describe, test, expect } from "bun:test";

// 限流相关环境变量在 route.ts 模块顶层求值，必须在 import 前设置
process.env.RATE_LIMIT_WINDOW_MS = "300000";  // 5 分钟
process.env.RATE_LIMIT_MAX_FAILURES = "5";
process.env.ADMIN_PASSWORD = "correct-password";

// Mock signJWT before importing the route
const mockSignJWT = mock(() => Promise.resolve("mock.jwt.token"));

mock.module("@/core/auth", () => ({
    signJWT: mockSignJWT,
    verifyJWT: mock(),
    isAuthenticated: mock(),
    isAuthorizedRefresh: mock(),
    TOKEN_EXPIRY_SECONDS: 86400,
}));

// 动态 import 确保 mock.module 和 process.env 均已生效
const { POST, DELETE } = await import("./route");

// ==================== Helpers ====================

function makeRequest(body: object, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
    }) as unknown as import("next/server").NextRequest;
}

function makeRequestWithIP(body: object, ip: string) {
    return makeRequest(body, { "x-forwarded-for": ip });
}

// ==================== Tests ====================

describe("POST /api/auth — login", () => {
    test("correct password returns 200 with token", async () => {
        const req = makeRequestWithIP({ password: "correct-password" }, "10.0.0.1");
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.token).toBe("mock.jwt.token");
    });

    test("correct password sets auth-token cookie", async () => {
        const req = makeRequestWithIP({ password: "correct-password" }, "10.0.0.2");
        const res = await POST(req);

        const setCookie = res.headers.get("set-cookie");
        expect(setCookie).toContain("auth-token=mock.jwt.token");
        expect(setCookie).toContain("HttpOnly");
        expect(setCookie).toContain("Path=/");
    });

    test("wrong password returns 401", async () => {
        const req = makeRequestWithIP({ password: "wrong" }, "10.0.0.3");
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe("密码错误");
    });

    test("empty password returns 401", async () => {
        const req = makeRequestWithIP({ password: "" }, "10.0.0.4");
        const res = await POST(req);

        expect(res.status).toBe(401);
    });

    test("rate limiting: 429 after 5 failed attempts from same IP", async () => {
        const ip = "10.0.0.100";

        // 5 failed attempts
        for (let i = 0; i < 5; i++) {
            const req = makeRequestWithIP({ password: "wrong" }, ip);
            const res = await POST(req);
            expect(res.status).toBe(401);
        }

        // 6th attempt should be rate limited
        const req = makeRequestWithIP({ password: "wrong" }, ip);
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(429);
        expect(data.error).toContain("尝试次数过多");
    });

    test("rate limiting is per-IP — different IPs are independent", async () => {
        // Exhaust IP A
        for (let i = 0; i < 5; i++) {
            const req = makeRequestWithIP({ password: "wrong" }, "10.0.0.200");
            await POST(req);
        }

        // IP B should still work
        const req = makeRequestWithIP({ password: "correct-password" }, "10.0.0.201");
        const res = await POST(req);
        expect(res.status).toBe(200);
    });

    test("successful login clears rate limit counter", async () => {
        const ip = "10.0.0.50";

        // 3 failures
        for (let i = 0; i < 3; i++) {
            await POST(makeRequestWithIP({ password: "wrong" }, ip));
        }

        // Successful login
        const res = await POST(makeRequestWithIP({ password: "correct-password" }, ip));
        expect(res.status).toBe(200);

        // Should be able to fail again without hitting limit
        const res2 = await POST(makeRequestWithIP({ password: "wrong" }, ip));
        expect(res2.status).toBe(401); // 401, not 429
    });

    test("uses x-real-ip when x-forwarded-for is absent", async () => {
        const req = makeRequest({ password: "correct-password" }, {
            "x-real-ip": "10.0.0.60",
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
    });

    test("missing password field returns 401 (AUTH-04)", async () => {
        const req = makeRequestWithIP({}, "10.0.0.70");
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe("密码错误");
    });

    test("non-JSON body returns 500 (AUTH-05)", async () => {
        const req = new Request("http://localhost/api/auth", {
            method: "POST",
            headers: { "x-forwarded-for": "10.0.0.80" },
            body: "not json",
        }) as unknown as import("next/server").NextRequest;
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(500);
        expect(data.error).toBe("登录失败");
    });

    test("evictIfNeeded: Map 达到 1000 条时强制淘汰一半", async () => {
        // 生成 1000 个不同 IP 各失败一次，填满 failureMap
        for (let i = 0; i < 1000; i++) {
            const a = (i >> 16) & 0xff;
            const b = (i >> 8) & 0xff;
            const c = i & 0xff;
            await POST(makeRequestWithIP({ password: "wrong" }, `99.${a}.${b}.${c}`));
        }

        // 第 1001 个 IP 触发 evictIfNeeded（淘汰最早一半），不应崩溃
        const res = await POST(makeRequestWithIP({ password: "wrong" }, "99.255.255.255"));
        expect(res.status).toBe(401);
    });

    test("rate limit resets after window expires (AUTH-08)", async () => {
        const ip = "10.0.0.150";
        const origDateNow = Date.now;

        try {
            for (let i = 0; i < 5; i++) {
                await POST(makeRequestWithIP({ password: "wrong" }, ip));
            }

            let res = await POST(makeRequestWithIP({ password: "wrong" }, ip));
            expect(res.status).toBe(429);

            // Advance time past the 5-minute window
            Date.now = () => origDateNow() + 5 * 60 * 1000 + 1;

            res = await POST(makeRequestWithIP({ password: "wrong" }, ip));
            expect(res.status).toBe(401); // wrong password, not 429
        } finally {
            Date.now = origDateNow;
        }
    });
});

describe("DELETE /api/auth — logout", () => {
    test("returns success and clears cookie", async () => {
        const res = await DELETE();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);

        const setCookie = res.headers.get("set-cookie");
        expect(setCookie).toContain("auth-token=");
        expect(setCookie).toContain("Max-Age=0");
    });
});
