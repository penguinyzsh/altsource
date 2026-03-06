"use client";

/**
 * 首页 UI 展示组件
 *
 * 从 page.tsx（Server Component）提取的 Client Component，
 * 用于支持 useTranslation()。接收 Server Component 传入的数据 props。
 */

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/ui/shadcn/badge";
import { Card, CardContent } from "@/ui/shadcn/card";
import { Button } from "@/ui/shadcn/button";
import {
  IconApps,
  IconVersions,
  IconArrowRight,
  IconDownload,
} from "@tabler/icons-react";
import { formatSize } from "@/core/utils";
import { DEFAULT_DEVELOPER_NAME } from "@/core/constants";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface AppData {
  id: string;
  github: string;
  name: string | null;
  developerName: string | null;
  localizedDescription: string | null;
  iconURL: string | null;
  category: string;
  versions: {
    id: string;
    version: string;
    size: number;
  }[];
}

interface HomeContentProps {
  apps: AppData[];
  totalVersions: number;
  siteTitle: string;
  siteDescription: string;
}

export function HomeContent({ apps, totalVersions, siteTitle, siteDescription }: HomeContentProps) {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Hero 区域 */}
      <div className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-background to-primary/5 border border-border/50 px-8 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {siteTitle}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {siteDescription}
          </p>
          {apps.length > 0 && (
            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm ring-1 ring-foreground/10">
                <IconApps size={16} className="text-primary" />
                <span className="font-semibold">{apps.length}</span>
                <span className="text-muted-foreground">
                  {t("home.appsLabel")}
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm ring-1 ring-foreground/10">
                <IconVersions size={16} className="text-primary" />
                <span className="font-semibold">{totalVersions}</span>
                <span className="text-muted-foreground">
                  {t("home.versionsLabel")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* App Grid */}
      {apps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <IconApps size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{t("home.emptyTitle")}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
              {t("home.emptyDescription")}
            </p>
            <Link href="/admin" className="mt-6">
              <Button>
                {t("home.emptyAction")}
                <IconArrowRight size={16} data-icon="inline-end" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => {
            const latestVersion = app.versions[0];
            return (
              <Link key={app.id} href={`/apps/${app.id}`} className="group">
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      {app.iconURL ? (
                        <Image
                          src={app.iconURL}
                          alt={app.name || app.github}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-12 w-12 rounded-xl ring-1 ring-foreground/5"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <IconDownload size={20} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="font-semibold truncate group-hover:text-primary transition-colors">
                          {app.name || app.github}
                        </h2>
                        <p className="text-sm text-muted-foreground truncate">
                          {app.developerName || DEFAULT_DEVELOPER_NAME}
                        </p>
                      </div>
                    </div>

                    {app.localizedDescription && (
                      <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                        {app.localizedDescription}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      {latestVersion && (
                        <>
                          <Badge variant="secondary" className="text-xs font-mono">
                            v{latestVersion.version}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatSize(latestVersion.size)}
                          </Badge>
                        </>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {app.category}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
