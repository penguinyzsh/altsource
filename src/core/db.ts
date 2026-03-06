/**
 * 数据库连接模块
 *
 * 使用 Prisma Client 单例模式管理数据库连接。
 * 在开发环境下通过 globalThis 缓存实例，
 * 避免 Next.js 热重载时创建多个数据库连接。
 */

import { PrismaClient } from "@prisma/client";

/** 在全局对象上挂载 Prisma 实例，防止热重载时重复创建 */
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

/** 导出的 Prisma Client 单例 */
export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// 开发环境下将实例缓存到全局对象
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

// 进程退出时释放数据库连接池，防止连接泄漏
function handleExit() {
    prisma.$disconnect();
}
process.on("beforeExit", handleExit);
process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
