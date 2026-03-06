import { describe, test, expect } from "bun:test";
import { formatSize, formatDate } from "./utils";

// ==================== formatSize ====================

describe("formatSize", () => {
    test("字节级别", () => {
        expect(formatSize(0)).toBe("0 B");
        expect(formatSize(512)).toBe("512 B");
        expect(formatSize(1023)).toBe("1023 B");
    });

    test("KB 级别", () => {
        expect(formatSize(1024)).toBe("1.0 KB");
        expect(formatSize(1536)).toBe("1.5 KB");
        expect(formatSize(1024 * 1023)).toBe("1023.0 KB");
    });

    test("MB 级别", () => {
        expect(formatSize(1024 * 1024)).toBe("1.0 MB");
        expect(formatSize(1024 * 1024 * 150)).toBe("150.0 MB");
        expect(formatSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
    });
});

// ==================== formatDate ====================

describe("formatDate", () => {
    test("Date 对象输入", () => {
        const date = new Date("2026-03-04T00:00:00Z");
        const result = formatDate(date);
        // zh-CN locale: "2026年3月4日"
        expect(result).toContain("2026");
        expect(result).toContain("3");
        expect(result).toContain("4");
    });

    test("ISO 字符串输入", () => {
        const result = formatDate("2025-12-25T00:00:00Z");
        expect(result).toContain("2025");
        expect(result).toContain("12");
        expect(result).toContain("25");
    });

    test("en locale 格式", () => {
        const date = new Date("2026-03-04T00:00:00Z");
        const result = formatDate(date, "en");
        // en locale: "March 4, 2026"
        expect(result).toContain("March");
        expect(result).toContain("2026");
    });
});
