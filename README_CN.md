# AltSource

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000.svg)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md)

**AltSource** 将 GitHub Releases 自动转换为 [AltStore](https://altstore.io) 兼容的 JSON 源。

只需指向任何在 Release 中发布 `.ipa` 文件的 GitHub 仓库，AltSource 就会生成符合规范的源 JSON，AltStore 用户一键即可订阅。

---

## 工作原理

```mermaid
flowchart LR
    A["管理员添加<br>GitHub 仓库"] --> B["AltSource<br>抓取 Release<br>+ 提取 IPA 信息"]
    B --> C["AltStore<br>订阅 JSON 源"]
```

1. **管理员添加 GitHub 仓库**：通过管理面板 (`/admin`) 输入 `owner/repo`
2. **自动拉取仓库信息**：从 GitHub API 获取名称、描述、图标（在代码仓库中搜索 AppIcon）
3. **Bundle ID 自动提取**：使用 HTTP Range 请求只下载 ~100KB 数据，从最新 `.ipa` 的 `Info.plist` 中提取 `CFBundleIdentifier` —— 无需下载完整 IPA
4. **Release 定时同步**：每天自动刷新（Vercel Cron），也支持手动触发
5. **动态生成 AltStore JSON**：访问 `/api/source/[slug]` 时实时生成，遵循 [AltStore Classic Source 规范](https://faq.altstore.io/developers/make-a-source)
6. **用户一键订阅**：在应用详情页点击「添加到 AltStore」

---

## 技术栈

| 层         | 技术                         | 用途                      |
| ---------- | ---------------------------- | ------------------------- |
| **框架**   | Next.js 16 (App Router)      | SSR 页面 + API 路由       |
| **数据库** | Vercel Postgres (Prisma ORM) | App 和 Version 存储       |
| **样式**   | Tailwind CSS v4 + shadcn/ui  | UI 组件                   |
| **认证**   | JWT (jose) + httpOnly Cookie | 管理后台认证              |
| **GitHub** | Octokit REST                 | 获取仓库、Release、文件树 |
| **调度**   | Vercel Cron                  | 每日自动刷新              |
| **部署**   | Vercel (Hobby)               | 零配置托管                |

---

## 项目结构

```
altsource/
├── prisma/
│   └── schema.prisma              # 数据库模型（App, Version）
├── src/
│   ├── app/
│   │   ├── page.tsx               # 首页 — 应用展示卡片
│   │   ├── not-found.tsx          # 自定义 404 页面
│   │   ├── error.tsx              # 全局错误边界
│   │   ├── apps/[id]/page.tsx     # 应用详情 — 版本历史、订阅按钮
│   │   ├── admin/
│   │   │   ├── login/page.tsx     # 管理员登录
│   │   │   └── page.tsx           # 管理面板（增删改查）
│   │   └── api/
│   │       ├── auth/route.ts      # POST 登录 / DELETE 退出（含限流）
│   │       ├── apps/route.ts      # GET 列表 / POST 添加
│   │       ├── apps/[id]/route.ts # PUT 编辑 / DELETE 删除
│   │       ├── refresh/route.ts   # POST 手动刷新 / GET 定时刷新
│   │       └── source/[slug]/route.ts  # 公开 AltStore JSON 源
│   ├── modules/                   # 页面模块（按页面隔离）
│   │   ├── home/                  # 首页 UI
│   │   ├── app-detail/            # 详情页 UI
│   │   └── admin/                 # 管理界面（表格、对话框、骨架屏）
│   ├── services/
│   │   ├── github.ts              # GitHub API 集成（重试、Rate Limit 感知）
│   │   ├── ipa-utils.ts           # IPA Bundle ID 提取（HTTP Range）
│   │   ├── source-generator.ts    # AltStore JSON 组装
│   │   └── release-parser.ts      # 版本号提取、Changelog 清洗
│   ├── core/
│   │   ├── api-client.ts          # 前端类型安全 API 客户端
│   │   ├── auth.ts                # JWT 签发/验证
│   │   ├── db.ts                  # 数据库连接（Prisma）
│   │   ├── utils.ts               # 工具函数
│   │   └── constants.ts           # 共享常量
│   ├── ui/
│   │   ├── shadcn/                # shadcn/ui 基础组件
│   │   └── layout/                # 布局组件（导航栏、主题、多语言）
│   ├── i18n/                      # 翻译字典（zh-CN、en）
│   ├── types/index.ts             # 统一 TypeScript 类型定义
│   └── proxy.ts                   # 路由守卫（admin 认证检查）
├── next.config.ts
├── vercel.json                    # Cron 定时任务配置
└── .env.example                   # 环境变量模板
```

---

## API 端点

| 方法      | 端点                     | 认证     | 说明                                             |
| --------- | ------------------------ | -------- | ------------------------------------------------ |
| `POST`    | `/api/auth`              | —        | 登录（密码 → JWT + Cookie）                      |
| `DELETE`  | `/api/auth`              | —        | 退出（清除 Cookie）                              |
| `GET`     | `/api/apps`              | JWT      | 获取所有 App                                     |
| `POST`    | `/api/apps`              | JWT      | 添加 App（自动拉取 GitHub 信息 + IPA Bundle ID） |
| `PUT`     | `/api/apps/[id]`         | JWT      | 编辑 App 信息                                    |
| `DELETE`  | `/api/apps/[id]`         | JWT      | 删除 App（级联删除版本）                         |
| `POST`    | `/api/refresh`           | JWT/Cron | 刷新指定或全部 App                               |
| `GET`     | `/api/refresh`           | Cron     | Vercel Cron 每日触发                             |
| **`GET`** | **`/api/source/[slug]`** | **公开** | **AltStore JSON 源**（CDN 缓存 24h）             |

---

## 数据模型

```mermaid
erDiagram
    App ||--o{ Version : "has many"
    App {
        string id PK
        string github UK
        string slug UK
        string bundleIdentifier
        string name
        string developerName
        string subtitle
        string localizedDescription
        string iconURL
        string tintColor
        string category
        string minOSVersion
        datetime createdAt
        datetime updatedAt
    }
    Version {
        string id PK
        string appId FK
        string version
        datetime date
        string localizedDescription
        string downloadURL
        int size
        int releaseId UK "去重 key"
        datetime createdAt
    }
```

- **Slug**：从仓库名自动生成，用于公开源 URL（`/api/source/pikapika`）
- **releaseId**：GitHub Release ID，防止重复导入版本
- **版本保留策略**：仅保留最近 N 个版本（通过 `MAX_VERSIONS` 配置）

---

## 安全措施

| 措施         | 实现方式                                          |
| ------------ | ------------------------------------------------- |
| 管理认证     | JWT (HS256, 24h 有效期)，使用 `jose` 库           |
| 路由守卫     | `proxy.ts` 检查 `/admin` 路径的 httpOnly Cookie   |
| API 认证     | `Authorization: Bearer <token>` 请求头验证        |
| 暴力破解保护 | IP 级限流（5 分钟内最多 5 次失败）                |
| Cron 认证    | `CRON_SECRET` 验证 Vercel Cron 请求               |
| Cookie 安全  | `httpOnly`、`secure`（生产环境）、`sameSite: lax` |

---

## 快速开始

### 前置条件

- [Bun](https://bun.sh)（或 Node.js 18+）
- [Docker](https://www.docker.com/)（本地 PostgreSQL，推荐 [OrbStack](https://orbstack.dev/)）

### 本地开发

1. 安装依赖
2. 启动本地开发数据库（需要 Docker）
3. 复制 `.env.development` 为 `.env`，填写 GitHub Token
4. 生成 Prisma Client 并同步数据库
5. 启动开发服务器

> 生产环境使用 Vercel + Vercel Postgres，不使用 Docker。

### 环境变量

复制 `.env.example` 到 `.env` 并填写必填项。部分变量为可选，未设置时使用合理的默认值。

#### 数据库

| 变量                       | 说明                                                   |
| -------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`             | PostgreSQL 连接字符串（Prisma Postgres / Neon）         |

> 本地开发：`postgresql://altsource:altsource@localhost:5432/altsource?schema=public`

#### GitHub

| 变量           | 说明                                                 |
| -------------- | ---------------------------------------------------- |
| `GITHUB_TOKEN` | GitHub Personal Access Token（提供 5000 次/小时额度）|

> 生成地址：Settings → Developer settings → Personal access tokens → Fine-grained tokens（public repo 只读即可）

#### 认证

| 变量             | 说明             |
| ---------------- | ---------------- |
| `ADMIN_PASSWORD` | 管理后台登录密码 |

#### 认证与安全（可选）

以下变量为**可选项**，未设置时自动使用默认值。

| 变量                      | 默认值     | 说明                                                              |
| ------------------------- | ---------- | ----------------------------------------------------------------- |
| `JWT_SECRET`              | 自动生成   | JWT 签名密钥。未设置时启动时自动生成（每次冷启动不同）。多实例部署建议显式设置 |
| `CRON_SECRET`             | —          | Cron 认证密钥。Vercel 部署时自动注入。未设置时 Cron 端点回退为仅 JWT 认证    |
| `TOKEN_EXPIRY_SECONDS`    | `86400`    | JWT Token 过期时间（秒），默认 24 小时                             |
| `RATE_LIMIT_WINDOW_MS`    | `300000`   | 认证限流窗口（毫秒），默认 5 分钟                                  |
| `RATE_LIMIT_MAX_FAILURES` | `5`        | 限流窗口内最大失败次数                                             |

#### 站点

| 变量                     | 说明                                              |
| ------------------------ | ------------------------------------------------- |
| `SITE_URL`               | 站点完整 URL，如 `https://alt.example.com`        |
| `SITE_TITLE`             | 站点标题（HTML meta 和首页展示）                  |
| `SITE_DESCRIPTION`       | 站点描述（HTML meta 和首页展示）                  |
| `NEXT_PUBLIC_SITE_TITLE` | 客户端组件站点标题（导航栏展示）                  |
| `NEXT_PUBLIC_GITHUB_REPO_URL` | 导航栏 GitHub 仓库链接                       |

#### AltStore 源

| 变量                       | 说明                                            |
| -------------------------- | ----------------------------------------------- |
| `SOURCE_IDENTIFIER_PREFIX` | 源标识符前缀，如 `com.altsource.`               |
| `MAX_VERSIONS`             | 每个 App 保留的版本数量，如 `3`                  |

#### 刷新

| 变量                | 说明                                          |
| ------------------- | --------------------------------------------- |
| `CONCURRENCY`       | GitHub API 每批并发请求数，如 `3`              |
| `REFRESH_PAGE_SIZE` | 刷新时每批处理的 App 数量，如 `10`             |

---

## 部署

1. 部署到 Vercel
2. 在生产数据库执行 Prisma 迁移

Vercel 会自动：
- 构建并部署 Next.js 应用
- 注入 `POSTGRES_*` 和 `CRON_SECRET` 环境变量
- 每天 UTC 0:00 执行 Cron 任务（配置在 `vercel.json`）

---

## UI 主题

基于 [shadcn/ui](https://ui.shadcn.com) 构建，使用 Teal + Gray 色彩方案：

[查看主题配置](https://ui.shadcn.com/create?base=base&theme=teal&baseColor=gray&style=maia&iconLibrary=tabler&radius=large)

---

## 许可证

[MIT](LICENSE)
