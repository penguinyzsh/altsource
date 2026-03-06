# AltSource

[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000.svg)](https://vercel.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[中文文档](README_CN.md)

**AltSource** turns GitHub Releases into [AltStore](https://altstore.io)-compatible JSON source feeds — automatically.

Point it at any GitHub repo that publishes `.ipa` files in its releases, and AltSource will generate a standards-compliant source JSON that AltStore users can subscribe to with one tap.

---

## How It Works

```mermaid
flowchart LR
    A["Admin adds<br>GitHub repo"] --> B["AltSource<br>fetches releases<br>+ extracts IPA"]
    B --> C["AltStore<br>subscribes to<br>JSON feed"]
```

1. **Admin adds a GitHub repo** via the management dashboard (`/admin`)
2. **AltSource fetches repo info** from the GitHub API (name, description, icon)
3. **Bundle ID auto-extraction**: Downloads only ~100KB of the latest `.ipa` using HTTP Range requests to extract `CFBundleIdentifier` from `Info.plist` — no full download needed
4. **Releases are synced** on a daily schedule (Vercel Cron) or manually triggered
5. **AltStore JSON is generated** on-the-fly at `/api/source/[slug]`, following the [AltStore Classic Source spec](https://faq.altstore.io/developers/make-a-source)
6. **Users subscribe** by tapping "Add to AltStore" on the app detail page

---

## Tech Stack

| Layer          | Technology                   | Purpose                           |
| -------------- | ---------------------------- | --------------------------------- |
| **Framework**  | Next.js 16 (App Router)      | SSR pages + API routes            |
| **Database**   | Vercel Postgres (Prisma ORM) | App & Version storage             |
| **Styling**    | Tailwind CSS v4 + shadcn/ui  | UI components                     |
| **Auth**       | JWT (jose) + httpOnly Cookie | Admin authentication              |
| **GitHub**     | Octokit REST                 | Fetch repos, releases, file trees |
| **Scheduling** | Vercel Cron                  | Daily auto-refresh                |
| **Deployment** | Vercel (Hobby)               | Zero-config hosting               |

---

## Project Structure

```
altsource/
├── prisma/
│   └── schema.prisma              # Database models (App, Version)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Homepage — app showcase grid
│   │   ├── not-found.tsx          # Custom 404 page
│   │   ├── error.tsx              # Global error boundary
│   │   ├── apps/[slug]/page.tsx   # App detail — versions, subscribe button
│   │   ├── admin/
│   │   │   ├── login/page.tsx     # Admin login
│   │   │   └── page.tsx           # Admin dashboard (CRUD)
│   │   └── api/
│   │       ├── auth/route.ts      # POST login, DELETE logout (rate-limited)
│   │       ├── apps/route.ts      # GET list, POST create
│   │       ├── apps/[id]/route.ts # PUT update, DELETE remove
│   │       ├── refresh/route.ts   # POST manual / GET cron refresh
│   │       └── source/[slug]/route.ts  # Public AltStore JSON feed
│   ├── modules/                   # Page modules (isolated per page)
│   │   ├── home/                  # Homepage UI
│   │   ├── app-detail/            # App detail UI
│   │   └── admin/                 # Admin UI (table, dialogs, skeleton)
│   ├── services/
│   │   ├── github.ts              # GitHub API integration (retry, rate-limit aware)
│   │   ├── ipa-utils.ts           # IPA Bundle ID extraction (HTTP Range)
│   │   ├── source-generator.ts    # AltStore JSON assembly
│   │   └── release-parser.ts      # Version extraction, changelog cleanup
│   ├── core/
│   │   ├── api-client.ts          # Typed frontend API client
│   │   ├── auth.ts                # JWT sign/verify helpers
│   │   ├── db.ts                  # Database connection (Prisma)
│   │   ├── utils.ts               # Utility functions
│   │   └── constants.ts           # Shared constants
│   ├── ui/
│   │   ├── shadcn/                # shadcn/ui primitives
│   │   └── layout/                # Layout components (header, theme, i18n)
│   ├── i18n/                      # Translation dictionaries (zh-CN, en)
│   ├── types/index.ts             # Shared TypeScript interfaces
│   └── proxy.ts                   # Route guard (admin auth check)
├── next.config.ts
├── vercel.json                    # Cron schedule
└── .env.example                   # Environment variable template
```

---

## API Endpoints

| Method    | Endpoint                 | Auth       | Description                                        |
| --------- | ------------------------ | ---------- | -------------------------------------------------- |
| `POST`    | `/api/auth`              | —          | Login (password → JWT + cookie)                    |
| `DELETE`  | `/api/auth`              | —          | Logout (clear cookie)                              |
| `GET`     | `/api/apps`              | JWT        | List all apps                                      |
| `POST`    | `/api/apps`              | JWT        | Add app (auto-fetches GitHub info + IPA Bundle ID) |
| `PUT`     | `/api/apps/[id]`         | JWT        | Update app metadata                                |
| `DELETE`  | `/api/apps/[id]`         | JWT        | Delete app + cascade versions                      |
| `POST`    | `/api/refresh`           | JWT/Cron   | Refresh one or all apps                            |
| `GET`     | `/api/refresh`           | Cron       | Vercel Cron daily trigger                          |
| **`GET`** | **`/api/source/[slug]`** | **Public** | **AltStore JSON feed** (24h CDN cache)             |

---

## Data Model

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
        int releaseId UK "dedup key"
        datetime createdAt
    }
```

- **Slug**: Auto-generated from repo name, used in public source URLs (`/api/source/pikapika`)
- **releaseId**: GitHub Release ID, prevents duplicate version imports
- **Version retention**: Only the latest N versions are kept (configurable via `MAX_VERSIONS`)

---

## Security

| Measure                | Implementation                                     |
| ---------------------- | -------------------------------------------------- |
| Admin auth             | JWT (HS256, 24h expiry) via `jose`                 |
| Route guard            | `proxy.ts` checks httpOnly cookie on `/admin`      |
| API auth               | `Authorization: Bearer <token>` header validation  |
| Brute-force protection | IP-based rate limiting (5 failures / 5 minutes)    |
| Cron auth              | `CRON_SECRET` for Vercel Cron requests             |
| Cookie security        | `httpOnly`, `secure` (production), `sameSite: lax` |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)
- [Docker](https://www.docker.com/) (local PostgreSQL; [OrbStack](https://orbstack.dev/) recommended)

### Setup

1. Install dependencies
2. Start local dev PostgreSQL (Docker required)
3. Copy `.env.development` to `.env`, then fill in your GitHub Token
4. Generate Prisma Client + sync database
5. Start dev server

> Production uses Vercel + Vercel Postgres, not Docker.

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values. Some variables are optional and will use sensible defaults if not set.

#### Database

| Variable                   | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`             | PostgreSQL connection string (Prisma Postgres / Neon)          |

> Local dev: `postgresql://altsource:altsource@localhost:5432/altsource?schema=public`

#### GitHub

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `GITHUB_TOKEN` | GitHub Personal Access Token (provides 5000 req/hr rate) |

> Generate at: Settings → Developer settings → Personal access tokens → Fine-grained tokens (public repo read-only)

#### Auth

| Variable         | Description          |
| ---------------- | -------------------- |
| `ADMIN_PASSWORD` | Admin login password |

#### Auth & Security (Optional)

The following variables are **optional**. If not set, sensible defaults are used automatically.

| Variable                  | Default        | Description                                            |
| ------------------------- | -------------- | ------------------------------------------------------ |
| `JWT_SECRET`              | Auto-generated | JWT signing key. Auto-generated on startup if not set (changes on each cold start). Set explicitly for multi-instance deployments |
| `CRON_SECRET`             | —              | Cron auth secret. On Vercel, auto-injected. If not set, cron endpoint falls back to JWT auth only |
| `TOKEN_EXPIRY_SECONDS`    | `86400`        | JWT token expiry in seconds (default 24h)              |
| `RATE_LIMIT_WINDOW_MS`    | `300000`       | Auth rate limit window in milliseconds (default 5min)  |
| `RATE_LIMIT_MAX_FAILURES` | `5`            | Max failed login attempts per window                   |

#### Site

| Variable               | Description                                              |
| ---------------------- | -------------------------------------------------------- |
| `SITE_URL`             | Full site URL, e.g. `https://alt.example.com`            |
| `SITE_TITLE`           | Site title for HTML meta and homepage                    |
| `SITE_DESCRIPTION`     | Site description for HTML meta and homepage              |
| `NEXT_PUBLIC_SITE_TITLE` | Site title for client-side components (header navbar)  |
| `NEXT_PUBLIC_GITHUB_REPO_URL` | GitHub repo URL shown in header navbar              |

#### AltStore Source

| Variable                   | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `SOURCE_IDENTIFIER_PREFIX` | Source identifier prefix, e.g. `com.altsource.`         |
| `MAX_VERSIONS`             | Number of versions to retain per app (e.g. `3`)         |

#### Refresh

| Variable            | Description                                       |
| ------------------- | ------------------------------------------------- |
| `CONCURRENCY`       | GitHub API concurrent requests per batch (e.g. `3`) |
| `REFRESH_PAGE_SIZE` | Number of apps per refresh batch (e.g. `10`)      |

---

## Deployment

1. Deploy to Vercel
2. Run Prisma migration on production database

Vercel will automatically:
- Build and deploy the Next.js app
- Inject `POSTGRES_*` and `CRON_SECRET` environment variables
- Execute the daily Cron job at midnight UTC (`vercel.json`)

---

## UI Theme

Built with [shadcn/ui](https://ui.shadcn.com) using a Teal + Gray palette:

[View Theme Config](https://ui.shadcn.com/create?base=base&theme=teal&baseColor=gray&style=maia&iconLibrary=tabler&radius=large)

---

## License

[MIT](LICENSE)
