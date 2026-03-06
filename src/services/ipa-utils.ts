/**
 * IPA 文件解析工具
 *
 * 使用 HTTP Range 请求高效提取 IPA 文件中的 Bundle Identifier，
 * 无需下载完整的 IPA 文件（通常只需下载 ~100KB）。
 *
 * IPA 文件本质上是 ZIP 包，结构：
 *   Payload/*.app/Info.plist  ← 包含 CFBundleIdentifier
 *
 * 流程：
 * 1. HEAD 请求获取文件大小
 * 2. Range 请求读取 ZIP 中央目录（文件末尾 ~64KB）
 * 3. 在中央目录中找到 Info.plist 的偏移位置
 * 4. Range 请求只读取 Info.plist 数据
 * 5. 解析 plist（二进制或 XML 格式）提取 CFBundleIdentifier
 *
 * 优势：
 * - 不消耗 GitHub API 配额（直接访问 CDN 下载链接）
 * - 无论 IPA 多大，只下载 ~100KB 数据
 * - 完全免费，适合 Vercel Hobby 计划
 */

import { inflateRawSync } from "zlib";
import bplist from "bplist-parser";

// ==================== ZIP 格式常量 ====================

/** ZIP 中央目录结束记录签名 */
export const EOCD_SIGNATURE = 0x06054b50;
/** ZIP 中央目录文件头签名 */
export const CD_SIGNATURE = 0x02014b50;
/** ZIP 本地文件头签名 */
const LOCAL_HEADER_SIGNATURE = 0x04034b50;
/** 读取中央目录时的最大缓冲区大小（64KB，涵盖大多数 IPA 的目录区） */
const EOCD_MAX_SIZE = 65536;

// ==================== 核心函数 ====================

/**
 * 从 IPA 下载链接中高效提取 Bundle Identifier
 *
 * 使用 HTTP Range 请求，只下载必要的字节：
 * - 中央目录约 ~64KB
 * - Info.plist 文件约 ~2-10KB
 * - 总计约 ~100KB，无论 IPA 有多大
 *
 * @param ipaUrl - IPA 文件的直接下载 URL（支持 GitHub Release Assets）
 * @returns Bundle Identifier 字符串，失败返回 null
 */
export async function extractBundleIdFromIPA(
    ipaUrl: string
): Promise<string | null> {
    try {
        // 步骤 1：获取 IPA 文件大小
        const fileSize = await getFileSize(ipaUrl);
        if (!fileSize) {
            console.warn("[IPA] 无法获取文件大小，跳过自动提取");
            return null;
        }

        // 步骤 2-4：读取并定位 ZIP 中央目录
        const cdBuffer = await readCentralDirectory(ipaUrl, fileSize);
        if (!cdBuffer) return null;

        // 步骤 5：在中央目录中查找 Info.plist 文件
        const plistEntry = findInfoPlist(cdBuffer);
        if (!plistEntry) {
            console.warn("[IPA] 在 ZIP 中未找到 Info.plist");
            return null;
        }

        // 步骤 6-7：读取并解压 Info.plist 数据
        const plistData = await readAndDecompressEntry(ipaUrl, plistEntry, fileSize);
        if (!plistData) return null;

        // 步骤 8：解析 plist 提取 CFBundleIdentifier
        return parseBundleId(plistData);
    } catch (err) {
        console.error("[IPA] 提取 Bundle ID 失败:", err);
        return null;
    }
}

/**
 * 读取 ZIP 中央目录
 *
 * 通过 Range 请求读取文件末尾，定位 EOCD 记录，
 * 然后获取完整的中央目录数据。
 */
async function readCentralDirectory(
    ipaUrl: string,
    fileSize: number
): Promise<Buffer | null> {
    // 读取 ZIP 末尾
    const tailSize = Math.min(fileSize, EOCD_MAX_SIZE);
    const tailOffset = fileSize - tailSize;
    const tailBuffer = await fetchRange(ipaUrl, tailOffset, fileSize - 1);
    if (!tailBuffer) {
        console.warn("[IPA] Range 请求失败，跳过自动提取");
        return null;
    }

    // 找到中央目录结束记录（EOCD）
    const eocdOffset = findEOCD(tailBuffer);
    if (eocdOffset === -1) {
        console.warn("[IPA] 无法找到 ZIP EOCD 记录");
        return null;
    }

    // 从 EOCD 中读取中央目录的偏移和大小
    const cdOffset = tailBuffer.readUInt32LE(eocdOffset + 16);
    const cdSize = tailBuffer.readUInt32LE(eocdOffset + 12);

    // 如果中央目录在已读取的尾部缓冲区内，直接切片
    if (cdOffset >= tailOffset) {
        return tailBuffer.subarray(cdOffset - tailOffset);
    }

    // 否则单独读取中央目录
    const cdData = await fetchRange(ipaUrl, cdOffset, cdOffset + cdSize - 1);
    if (!cdData) {
        console.warn("[IPA] 无法读取中央目录");
        return null;
    }
    return cdData;
}

/**
 * 读取 ZIP 本地文件头并解压文件数据
 *
 * 支持 Stored（无压缩）和 Deflate 两种压缩方式。
 */
async function readAndDecompressEntry(
    ipaUrl: string,
    entry: CDEntry,
    fileSize: number
): Promise<Buffer | null> {
    // 读取本地文件头 + 压缩数据
    const localHeaderEnd = entry.localHeaderOffset + 30 + entry.fileNameLength + 256 + entry.compressedSize;
    const localData = await fetchRange(
        ipaUrl,
        entry.localHeaderOffset,
        Math.min(localHeaderEnd, fileSize - 1)
    );
    if (!localData) {
        console.warn("[IPA] 无法读取 Info.plist 数据");
        return null;
    }

    // 验证本地文件头签名
    if (localData.readUInt32LE(0) !== LOCAL_HEADER_SIGNATURE) {
        console.warn("[IPA] 本地文件头签名不匹配");
        return null;
    }

    // 从本地文件头提取实际参数（可能与中央目录不同）
    const compressionMethod = localData.readUInt16LE(8);
    const compressedSize = localData.readUInt32LE(18);
    const fileNameLength = localData.readUInt16LE(26);
    const extraFieldLength = localData.readUInt16LE(28);
    const dataStart = 30 + fileNameLength + extraFieldLength;
    const compressedData = localData.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
        return compressedData; // 无压缩（Stored）
    } else if (compressionMethod === 8) {
        return inflateRawSync(compressedData); // Deflate
    }

    console.warn(`[IPA] 不支持的压缩方式: ${compressionMethod}`);
    return null;
}

// ==================== HTTP 辅助函数 ====================

/** 单次 HTTP 请求超时（30 秒），防止 fetch 挂起导致内存无法回收 */
const FETCH_TIMEOUT_MS = 30_000;

/**
 * 通过 HEAD 请求获取文件大小
 * 自动跟随重定向以获取最终 URL 的 Content-Length
 */
async function getFileSize(url: string): Promise<number | null> {
    try {
        const res = await fetch(url, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        const length = res.headers.get("content-length");
        return length ? parseInt(length, 10) : null;
    } catch {
        return null;
    }
}

/**
 * 使用 HTTP Range 请求获取文件的指定字节范围
 *
 * @param url - 文件 URL
 * @param start - 起始字节（含）
 * @param end - 结束字节（含）
 * @returns 请求的字节数据，失败返回 null
 */
async function fetchRange(
    url: string,
    start: number,
    end: number
): Promise<Buffer | null> {
    try {
        const res = await fetch(url, {
            headers: { Range: `bytes=${start}-${end}` },
            redirect: "follow",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

        // 206 Partial Content 表示 Range 请求成功
        // 200 表示服务器忽略了 Range 头但返回了完整内容（回退处理）
        if (res.status !== 206 && res.status !== 200) {
            return null;
        }

        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch {
        return null;
    }
}

// ==================== ZIP 解析函数 ====================

/**
 * 在缓冲区中查找 ZIP EOCD（中央目录结束记录）的偏移位置
 * 从缓冲区末尾向前搜索 EOCD 签名
 */
export function findEOCD(buffer: Buffer): number {
    // EOCD 最小 22 字节，从末尾开始反向搜索
    for (let i = buffer.length - 22; i >= 0; i--) {
        if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
            return i;
        }
    }
    return -1;
}

/** 中央目录中 Info.plist 文件的条目信息 */
export interface CDEntry {
    /** 本地文件头在 ZIP 中的偏移 */
    localHeaderOffset: number;
    /** 压缩后大小 */
    compressedSize: number;
    /** 文件名长度 */
    fileNameLength: number;
}

/**
 * 在 ZIP 中央目录中查找 Payload/*.app/Info.plist
 *
 * IPA 中的 Info.plist 路径格式：Payload/AppName.app/Info.plist
 * 匹配规则：路径以 "Payload/" 开头，以 ".app/Info.plist" 结尾
 */
export function findInfoPlist(cdBuffer: Buffer): CDEntry | null {
    let offset = 0;

    while (offset + 46 <= cdBuffer.length) {
        // 验证中央目录文件头签名
        if (cdBuffer.readUInt32LE(offset) !== CD_SIGNATURE) break;

        const compressedSize = cdBuffer.readUInt32LE(offset + 20);
        const fileNameLength = cdBuffer.readUInt16LE(offset + 28);
        const extraFieldLength = cdBuffer.readUInt16LE(offset + 30);
        const commentLength = cdBuffer.readUInt16LE(offset + 32);
        const localHeaderOffset = cdBuffer.readUInt32LE(offset + 42);

        // 读取文件名
        const fileName = cdBuffer
            .subarray(offset + 46, offset + 46 + fileNameLength)
            .toString("utf8");

        // 匹配 Payload/*.app/Info.plist
        if (
            fileName.startsWith("Payload/") &&
            fileName.endsWith(".app/Info.plist") &&
            fileName.split("/").length === 3 // 确保只有三级路径
        ) {
            return { localHeaderOffset, compressedSize, fileNameLength };
        }

        // 移动到下一个条目
        offset += 46 + fileNameLength + extraFieldLength + commentLength;
    }

    return null;
}

// ==================== Plist 解析函数 ====================

/**
 * 从 plist 数据中提取 CFBundleIdentifier
 *
 * 支持两种格式：
 * - 二进制 plist（bplist00 开头）：使用 bplist-parser 解析
 * - XML plist（<?xml 开头）：使用正则表达式提取
 */
export function parseBundleId(plistData: Buffer): string | null {
    // 判断是否为二进制 plist
    if (plistData.subarray(0, 6).toString("ascii") === "bplist") {
        return parseBinaryPlist(plistData);
    }

    // 尝试 XML plist 解析
    return parseXmlPlist(plistData.toString("utf8"));
}

/**
 * 解析二进制 plist 格式的 Info.plist
 * 使用 bplist-parser 库
 */
function parseBinaryPlist(data: Buffer): string | null {
    try {
        const parsed = bplist.parseBuffer(data);
        if (parsed && parsed[0]) {
            const dict = parsed[0] as Record<string, unknown>;
            if (typeof dict.CFBundleIdentifier === "string") {
                return dict.CFBundleIdentifier;
            }
        }
    } catch (err) {
        console.error("[IPA] 解析二进制 plist 失败:", err);
    }
    return null;
}

/**
 * 解析 XML plist 格式的 Info.plist
 * 使用正则表达式快速提取 CFBundleIdentifier
 */
function parseXmlPlist(xml: string): string | null {
    // XML plist 中 CFBundleIdentifier 的格式：
    // <key>CFBundleIdentifier</key>
    // <string>com.example.app</string>
    const match = xml.match(
        /<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/
    );
    return match ? match[1] : null;
}
