/**
 * IPA 测试共享辅助函数
 *
 * 构造 ZIP 格式的测试数据，供 zip-parser / ipa-utils 测试共用。
 */

import { EOCD_SIGNATURE, CD_SIGNATURE } from "./ipa-utils";

export { EOCD_SIGNATURE, CD_SIGNATURE };

/** 构造一个最小化的 EOCD 记录（22 字节） */
export function buildEOCD(cdOffset: number, cdSize: number): Buffer {
    const buf = Buffer.alloc(22);
    buf.writeUInt32LE(EOCD_SIGNATURE, 0);
    buf.writeUInt16LE(0, 4);
    buf.writeUInt16LE(0, 6);
    buf.writeUInt16LE(1, 8);
    buf.writeUInt16LE(1, 10);
    buf.writeUInt32LE(cdSize, 12);
    buf.writeUInt32LE(cdOffset, 16);
    buf.writeUInt16LE(0, 20);
    return buf;
}

/** 构造一个中央目录文件头条目 */
export function buildCDEntry(
    fileName: string,
    compressedSize: number,
    localHeaderOffset: number
): Buffer {
    const nameBytes = Buffer.from(fileName, "utf8");
    const buf = Buffer.alloc(46 + nameBytes.length);
    buf.writeUInt32LE(CD_SIGNATURE, 0);
    buf.writeUInt16LE(20, 4);
    buf.writeUInt16LE(20, 6);
    buf.writeUInt16LE(0, 8);
    buf.writeUInt16LE(8, 10);
    buf.writeUInt16LE(0, 12);
    buf.writeUInt16LE(0, 14);
    buf.writeUInt32LE(0, 16);
    buf.writeUInt32LE(compressedSize, 20);
    buf.writeUInt32LE(compressedSize, 24);
    buf.writeUInt16LE(nameBytes.length, 28);
    buf.writeUInt16LE(0, 30);
    buf.writeUInt16LE(0, 32);
    buf.writeUInt16LE(0, 34);
    buf.writeUInt16LE(0, 36);
    buf.writeUInt32LE(0, 38);
    buf.writeUInt32LE(localHeaderOffset, 42);
    nameBytes.copy(buf, 46);
    return buf;
}
