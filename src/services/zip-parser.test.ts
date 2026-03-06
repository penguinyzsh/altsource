/**
 * ZIP 解析函数单元测试
 *
 * 测试 findEOCD 和 findInfoPlist 的 ZIP 格式解析逻辑。
 */

import { describe, test, expect } from "bun:test";
import { findEOCD, findInfoPlist } from "./ipa-utils";
import { buildEOCD, buildCDEntry } from "./ipa-test-utils";

// ==================== findEOCD ====================

describe("findEOCD", () => {
    test("在缓冲区末尾找到 EOCD", () => {
        const eocd = buildEOCD(0, 0);
        const offset = findEOCD(eocd);
        expect(offset).toBe(0);
    });

    test("EOCD 前面有其他数据", () => {
        const padding = Buffer.alloc(100, 0);
        const eocd = buildEOCD(0, 0);
        const buffer = Buffer.concat([padding, eocd]);
        const offset = findEOCD(buffer);
        expect(offset).toBe(100);
    });

    test("缓冲区太小（小于 22 字节）", () => {
        const buffer = Buffer.alloc(10, 0);
        expect(findEOCD(buffer)).toBe(-1);
    });

    test("无 EOCD 签名", () => {
        const buffer = Buffer.alloc(100, 0);
        expect(findEOCD(buffer)).toBe(-1);
    });

    test("多个疑似签名时返回最后一个（最靠近末尾）", () => {
        const eocd1 = buildEOCD(0, 0);
        const padding = Buffer.alloc(50, 0);
        const eocd2 = buildEOCD(100, 50);
        const buffer = Buffer.concat([eocd1, padding, eocd2]);
        const offset = findEOCD(buffer);
        expect(offset).toBe(22 + 50);
    });
});

// ==================== findInfoPlist ====================

describe("findInfoPlist", () => {
    test("找到标准 IPA 路径 Payload/App.app/Info.plist", () => {
        const entry = buildCDEntry("Payload/MyApp.app/Info.plist", 1024, 500);
        const result = findInfoPlist(entry);
        expect(result).not.toBeNull();
        expect(result!.compressedSize).toBe(1024);
        expect(result!.localHeaderOffset).toBe(500);
    });

    test("忽略非 Payload 路径", () => {
        const entry = buildCDEntry("Other/MyApp.app/Info.plist", 1024, 0);
        const result = findInfoPlist(entry);
        expect(result).toBeNull();
    });

    test("忽略非 .app/Info.plist 后缀", () => {
        const entry = buildCDEntry("Payload/MyApp.app/SomeOther.plist", 1024, 0);
        const result = findInfoPlist(entry);
        expect(result).toBeNull();
    });

    test("忽略嵌套过深的路径（4 级）", () => {
        const entry = buildCDEntry(
            "Payload/MyApp.app/SubDir/Info.plist",
            1024,
            0
        );
        const result = findInfoPlist(entry);
        expect(result).toBeNull();
    });

    test("多个条目中找到 Info.plist", () => {
        const entry1 = buildCDEntry("Payload/MyApp.app/Assets.car", 5000, 0);
        const entry2 = buildCDEntry("Payload/MyApp.app/Info.plist", 2048, 5000);
        const cdBuffer = Buffer.concat([entry1, entry2]);
        const result = findInfoPlist(cdBuffer);
        expect(result).not.toBeNull();
        expect(result!.compressedSize).toBe(2048);
        expect(result!.localHeaderOffset).toBe(5000);
    });

    test("空缓冲区", () => {
        const result = findInfoPlist(Buffer.alloc(0));
        expect(result).toBeNull();
    });

    test("缓冲区太小（不足一个条目头）", () => {
        const result = findInfoPlist(Buffer.alloc(20));
        expect(result).toBeNull();
    });
});
