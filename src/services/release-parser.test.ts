import { describe, test, expect } from "bun:test";
import { extractVersion, cleanReleaseBody } from "./release-parser";

// ==================== extractVersion ====================

describe("extractVersion", () => {
    test("去掉小写 v 前缀", () => {
        expect(extractVersion("v1.8.19")).toBe("1.8.19");
    });

    test("去掉大写 V 前缀", () => {
        expect(extractVersion("V2.0.0")).toBe("2.0.0");
    });

    test("无前缀时原样返回", () => {
        expect(extractVersion("1.8.17")).toBe("1.8.17");
    });

    test("只去掉第一个 v", () => {
        expect(extractVersion("v1.0.0-v2")).toBe("1.0.0-v2");
    });

    test("空字符串", () => {
        expect(extractVersion("")).toBe("");
    });

    test("复杂 tag 格式", () => {
        expect(extractVersion("v3.0.0-beta.1")).toBe("3.0.0-beta.1");
    });
});

// ==================== cleanReleaseBody ====================

describe("cleanReleaseBody", () => {
    test("空字符串返回空", () => {
        expect(cleanReleaseBody("")).toBe("");
    });

    test("无分隔符时返回原文（trim 后）", () => {
        expect(cleanReleaseBody("Bug fixes and improvements")).toBe(
            "Bug fixes and improvements"
        );
    });

    test("过滤包含免责声明的段落", () => {
        const body = [
            "Fixed crash on launch",
            "-----",
            "The author will not publish any harmful content",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Fixed crash on launch");
    });

    test("过滤包含赞助链接的段落", () => {
        const body = [
            "New features added",
            "-----",
            "Support & contribute to this project",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("New features added");
    });

    test("过滤包含 Please enter 关键词的段落", () => {
        const body = [
            "Updated UI",
            "-----",
            "Please enter the above content to verify",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Updated UI");
    });

    test("多段过滤后返回第一个有效段", () => {
        const body = [
            "The author will not publish bad stuff",
            "-----",
            "Actual changelog here",
            "-----",
            "Support & contribute",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Actual changelog here");
    });

    test("所有段落都被过滤时返回空", () => {
        const body = [
            "The author will not publish",
            "-----",
            "Support & contribute",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("");
    });

    // ==================== 通用场景 ====================

    test("过滤 sponsor 段落", () => {
        const body = [
            "Bug fixes",
            "---",
            "Sponsor this project on GitHub",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Bug fixes");
    });

    test("过滤 donate 段落", () => {
        const body = [
            "New feature",
            "***",
            "Donate to keep this project alive",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("New feature");
    });

    test("过滤 buy me a coffee 段落", () => {
        const body = [
            "Performance improvements",
            "___",
            "Buy me a coffee if you like this app",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Performance improvements");
    });

    test("过滤 Patreon 段落", () => {
        const body = [
            "v2.0 release",
            "---",
            "Support me on Patreon",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("v2.0 release");
    });

    test("过滤 Ko-fi 段落", () => {
        const body = [
            "Changelog here",
            "---",
            "Support on Ko-fi: https://ko-fi.com/dev",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Changelog here");
    });

    test("过滤 disclaimer 段落", () => {
        const body = [
            "Fixed login issue",
            "---",
            "Disclaimer: Use at your own risk.",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Fixed login issue");
    });

    test("过滤 warranty 段落", () => {
        const body = [
            "Updated dependencies",
            "---",
            "This software comes with no warranties.",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Updated dependencies");
    });

    test("过滤 installation guide 段落", () => {
        const body = [
            "Added dark mode",
            "---",
            "Installation guide: download and install",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Added dark mode");
    });

    test("移除内联 Full Changelog 链接", () => {
        const body = [
            "### What's Changed",
            "* Fix bug by @dev",
            "",
            "**Full Changelog**: https://github.com/org/repo/compare/v1.0...v2.0",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe(
            "### What's Changed\n* Fix bug by @dev"
        );
    });

    test("Full Changelog 单独成段时被过滤", () => {
        const body = [
            "Release notes",
            "---",
            "**Full Changelog**: https://github.com/org/repo/compare/v1...v2",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Release notes");
    });

    test("支持 *** 分隔符", () => {
        const body = [
            "Changelog",
            "***",
            "The author will not publish harmful content",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Changelog");
    });

    test("支持 ___ 分隔符", () => {
        const body = [
            "Release info",
            "___",
            "Please enter the above content to verify",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Release info");
    });

    test("支持 --- 三字符分隔符", () => {
        const body = [
            "Short changelog",
            "---",
            "Support & contribute to development",
        ].join("\n");

        expect(cleanReleaseBody(body)).toBe("Short changelog");
    });
});
