/**
 * Plist 解析函数单元测试
 *
 * 测试 parseBundleId 对 XML 和二进制 plist 格式的解析。
 */

import { describe, test, expect } from "bun:test";
import { parseBundleId } from "./ipa-utils";

describe("parseBundleId", () => {
    test("解析 XML plist", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>com.example.myapp</string>
    <key>CFBundleName</key>
    <string>MyApp</string>
</dict>
</plist>`;
        const result = parseBundleId(Buffer.from(xml));
        expect(result).toBe("com.example.myapp");
    });

    test("XML plist 无 CFBundleIdentifier 时返回 null", () => {
        const xml = `<?xml version="1.0"?>
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>MyApp</string>
</dict>
</plist>`;
        const result = parseBundleId(Buffer.from(xml));
        expect(result).toBeNull();
    });

    test("XML plist key 和 string 之间有换行和空格", () => {
        const xml = `<?xml version="1.0"?>
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>org.test.app</string>
</dict>
</plist>`;
        const result = parseBundleId(Buffer.from(xml));
        expect(result).toBe("org.test.app");
    });

    test("空数据返回 null", () => {
        const result = parseBundleId(Buffer.alloc(0));
        expect(result).toBeNull();
    });

    test("无法识别的格式返回 null", () => {
        const result = parseBundleId(Buffer.from("random data here"));
        expect(result).toBeNull();
    });

    test("二进制 plist 成功解析 CFBundleIdentifier", () => {
        const header = Buffer.from("bplist00");
        const dict = Buffer.from([0xd1, 0x01, 0x02]);

        const keyStr = "CFBundleIdentifier";
        const obj1 = Buffer.concat([
            Buffer.from([0x5f, 0x10, keyStr.length]),
            Buffer.from(keyStr, "ascii"),
        ]);

        const valStr = "com.test.bp";
        const obj2 = Buffer.concat([
            Buffer.from([0x50 | valStr.length]),
            Buffer.from(valStr, "ascii"),
        ]);

        const objects = Buffer.concat([dict, obj1, obj2]);
        const objStart = header.length;

        const offsetTable = Buffer.from([
            objStart,
            objStart + dict.length,
            objStart + dict.length + obj1.length,
        ]);

        const trailer = Buffer.alloc(32);
        trailer.writeUInt8(1, 6);
        trailer.writeUInt8(1, 7);
        trailer.writeUInt32BE(3, 12);
        const offsetTableOffset = header.length + objects.length;
        trailer.writeUInt32BE(offsetTableOffset, 28);

        const bplist = Buffer.concat([header, objects, offsetTable, trailer]);
        const result = parseBundleId(bplist);
        expect(result).toBe("com.test.bp");
    });

    test("二进制 plist header 但数据损坏时返回 null", () => {
        const data = Buffer.alloc(30, 0);
        data.write("bplist00", 0, "ascii");
        const result = parseBundleId(data);
        expect(result).toBeNull();
    });
});
