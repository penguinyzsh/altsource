import { describe, test, expect } from "bun:test";
import { ApiError } from "./api-client";

// ==================== Tests ====================
// 仅测试可在 Bun test 中运行的部分。
// getToken/logout/request 依赖 DOM (localStorage/window.location)，在 Bun 中不可测。

describe("ApiError", () => {
    test("携带 status 和 message", () => {
        const err = new ApiError(401, "未授权");

        expect(err.status).toBe(401);
        expect(err.message).toBe("未授权");
        expect(err.name).toBe("ApiError");
    });

    test("是 Error 的子类", () => {
        const err = new ApiError(500, "服务器错误");

        expect(err).toBeInstanceOf(Error);
        expect(err).toBeInstanceOf(ApiError);
    });

    test("可被 try/catch 捕获并检查 status", () => {
        try {
            throw new ApiError(404, "Not Found");
        } catch (e) {
            expect(e).toBeInstanceOf(ApiError);
            expect((e as ApiError).status).toBe(404);
        }
    });
});
