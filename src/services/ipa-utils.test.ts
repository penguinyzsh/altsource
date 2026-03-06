/**
 * extractBundleIdFromIPA 集成测试
 *
 * 测试完整的 IPA Bundle ID 提取流程：
 * HTTP Range 请求 → ZIP 解析 → Plist 提取 → Bundle ID 返回
 *
 * ZIP 解析和 Plist 解析的单元测试见：
 * - zip-parser.test.ts
 * - plist-parser.test.ts
 */

import { describe, test, expect, afterEach } from "bun:test";
import { deflateRawSync } from "zlib";
import { extractBundleIdFromIPA } from "./ipa-utils";
import { buildEOCD, buildCDEntry } from "./ipa-test-utils";

// ==================== 辅助函数 ====================

/** 构造 ZIP 本地文件头 */
function buildLocalFileHeader(
    fileName: string,
    fileData: Buffer,
    compressionMethod = 0
): Buffer {
    const nameBuf = Buffer.from(fileName, "utf8");
    const buf = Buffer.alloc(30 + nameBuf.length + fileData.length);
    buf.writeUInt32LE(0x04034b50, 0);
    buf.writeUInt16LE(20, 4);
    buf.writeUInt16LE(0, 6);
    buf.writeUInt16LE(compressionMethod, 8);
    buf.writeUInt32LE(fileData.length, 18);
    buf.writeUInt32LE(fileData.length, 22);
    buf.writeUInt16LE(nameBuf.length, 26);
    buf.writeUInt16LE(0, 28);
    nameBuf.copy(buf, 30);
    fileData.copy(buf, 30 + nameBuf.length);
    return buf;
}

/** 构造包含 Info.plist 的测试 ZIP */
function buildTestZip(plistData: Buffer, compressionMethod = 0): Buffer {
    const fileName = "Payload/Test.app/Info.plist";
    const localHeader = buildLocalFileHeader(fileName, plistData, compressionMethod);
    const cdEntry = buildCDEntry(fileName, plistData.length, 0);
    const eocd = buildEOCD(localHeader.length, cdEntry.length);
    return Buffer.concat([localHeader, cdEntry, eocd]);
}

/** 配置 mock fetch 以返回 ZIP 数据 */
function mockFetchForZip(zipBuffer: Buffer) {
    const fileSize = zipBuffer.length;
    globalThis.fetch = (async (
        _input: string | URL | Request,
        init?: RequestInit
    ) => {
        if (init?.method === "HEAD") {
            return new Response(null, {
                headers: { "content-length": String(fileSize) },
            });
        }
        const hdrs = init?.headers as Record<string, string> | undefined;
        const range = hdrs?.Range;
        if (range) {
            const m = range.match(/bytes=(\d+)-(\d+)/);
            if (m) {
                const start = parseInt(m[1]);
                const end = Math.min(parseInt(m[2]), fileSize - 1);
                const slice = Buffer.from(zipBuffer.subarray(start, end + 1));
                return new Response(slice, { status: 206 });
            }
        }
        return new Response(null, { status: 400 });
    }) as typeof fetch;
}

// ==================== extractBundleIdFromIPA ====================

describe("extractBundleIdFromIPA", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    const testPlistXml = Buffer.from(
        '<?xml version="1.0"?><plist><dict>' +
            "<key>CFBundleIdentifier</key>" +
            "<string>com.test.extracted</string>" +
            "</dict></plist>"
    );

    test("成功提取 Bundle ID（Stored 无压缩）", async () => {
        const zip = buildTestZip(testPlistXml, 0);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBe("com.test.extracted");
    });

    test("成功提取 Bundle ID（Deflate 压缩）", async () => {
        const compressed = deflateRawSync(testPlistXml);
        const zip = buildTestZip(compressed, 8);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBe("com.test.extracted");
    });

    test("HEAD 请求网络异常返回 null", async () => {
        globalThis.fetch = (async () => {
            throw new Error("Network error");
        }) as typeof fetch;
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("HEAD 响应无 Content-Length 返回 null", async () => {
        globalThis.fetch = (async () => new Response(null)) as typeof fetch;
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("Range 请求返回非 206 状态码返回 null", async () => {
        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": "1000" },
                });
            }
            return new Response(null, { status: 416 });
        }) as typeof fetch;
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("无 EOCD 记录返回 null", async () => {
        const garbage = Buffer.alloc(200, 0xff);
        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": "200" },
                });
            }
            return new Response(Buffer.from(garbage), { status: 206 });
        }) as typeof fetch;
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("ZIP 中无 Info.plist 返回 null", async () => {
        const otherFile = "Payload/Test.app/SomeOther.txt";
        const data = Buffer.from("not plist");
        const localHeader = buildLocalFileHeader(otherFile, data);
        const cdEntry = buildCDEntry(otherFile, data.length, 0);
        const eocd = buildEOCD(localHeader.length, cdEntry.length);
        const zip = Buffer.concat([localHeader, cdEntry, eocd]);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("本地文件头签名不匹配返回 null", async () => {
        const zip = buildTestZip(testPlistXml);
        zip.writeUInt32LE(0x00000000, 0);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("不支持的压缩方式返回 null", async () => {
        const zip = buildTestZip(testPlistXml, 99);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("读取 Info.plist 数据的 Range 请求失败返回 null", async () => {
        const zip = buildTestZip(testPlistXml);
        const fileSize = zip.length;
        let rangeCallCount = 0;

        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": String(fileSize) },
                });
            }
            rangeCallCount++;
            if (rangeCallCount === 1) {
                const hdrs = init?.headers as Record<string, string> | undefined;
                const range = hdrs?.Range;
                if (range) {
                    const m = range.match(/bytes=(\d+)-(\d+)/);
                    if (m) {
                        const start = parseInt(m[1]);
                        const end = Math.min(parseInt(m[2]), fileSize - 1);
                        const slice = Buffer.from(zip.subarray(start, end + 1));
                        return new Response(slice, { status: 206 });
                    }
                }
            }
            return new Response(null, { status: 416 });
        }) as typeof fetch;

        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("中央目录在 tail 范围外时单独获取成功", async () => {
        const fakeFileSize = 200000;
        const tailOffset = fakeFileSize - 65536;

        const plistXml = Buffer.from(
            '<?xml version="1.0"?><plist><dict>' +
            "<key>CFBundleIdentifier</key>" +
            "<string>com.cdoutside.test</string>" +
            "</dict></plist>"
        );
        const fileName = "Payload/Test.app/Info.plist";
        const localHeader = buildLocalFileHeader(fileName, plistXml, 0);
        const cdEntry = buildCDEntry(fileName, plistXml.length, 0);

        const cdOffset = 1000;
        const eocd = buildEOCD(cdOffset, cdEntry.length);

        const tailBuf = Buffer.alloc(65536, 0);
        eocd.copy(tailBuf, 65536 - eocd.length);

        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": String(fakeFileSize) },
                });
            }
            const hdrs = init?.headers as Record<string, string> | undefined;
            const range = hdrs?.Range;
            if (range) {
                const m = range.match(/bytes=(\d+)-(\d+)/);
                if (m) {
                    const start = parseInt(m[1]);
                    if (start === tailOffset) return new Response(tailBuf, { status: 206 });
                    if (start === cdOffset) return new Response(cdEntry, { status: 206 });
                    if (start === 0) return new Response(localHeader, { status: 206 });
                }
            }
            return new Response(null, { status: 400 });
        }) as typeof fetch;

        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBe("com.cdoutside.test");
    });

    test("中央目录在 tail 范围外且获取失败返回 null", async () => {
        const fakeFileSize = 200000;
        const tailOffset = fakeFileSize - 65536;

        const cdOffset = 1000;
        const eocd = buildEOCD(cdOffset, 80);
        const tailBuf = Buffer.alloc(65536, 0);
        eocd.copy(tailBuf, 65536 - eocd.length);

        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": String(fakeFileSize) },
                });
            }
            const hdrs = init?.headers as Record<string, string> | undefined;
            const range = hdrs?.Range;
            if (range) {
                const m = range.match(/bytes=(\d+)-(\d+)/);
                if (m) {
                    const start = parseInt(m[1]);
                    if (start === tailOffset) return new Response(tailBuf, { status: 206 });
                    if (start === cdOffset) return new Response(null, { status: 416 });
                }
            }
            return new Response(null, { status: 400 });
        }) as typeof fetch;

        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("fetchRange 网络异常触发 catch 返回 null", async () => {
        globalThis.fetch = (async (
            _input: string | URL | Request,
            init?: RequestInit
        ) => {
            if (init?.method === "HEAD") {
                return new Response(null, {
                    headers: { "content-length": "1000" },
                });
            }
            throw new Error("Connection refused");
        }) as typeof fetch;

        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });

    test("Deflate 数据损坏触发外层 catch 返回 null", async () => {
        const corrupt = Buffer.from("not-valid-deflate-data");
        const zip = buildTestZip(corrupt, 8);
        mockFetchForZip(zip);
        const result = await extractBundleIdFromIPA("https://example.com/test.ipa");
        expect(result).toBeNull();
    });
});
