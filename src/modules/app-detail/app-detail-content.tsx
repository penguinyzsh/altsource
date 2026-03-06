"use client";

/**
 * App 详情页 UI 展示组件
 *
 * 从 apps/[id]/page.tsx（Server Component）提取的 Client Component，
 * 用于支持 useTranslation()。接收 Server Component 传入的数据 props。
 */

import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/ui/shadcn/badge";
import { Button } from "@/ui/shadcn/button";
import { Separator } from "@/ui/shadcn/separator";
import { Card, CardContent } from "@/ui/shadcn/card";
import {
  IconArrowLeft,
  IconDownload,
  IconBrandGithub,
  IconFileCode,
  IconCopy,
  IconStar,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { formatSize, formatDate } from "@/core/utils";
import { DEFAULT_DEVELOPER_NAME, GITHUB_BASE_URL } from "@/core/constants";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface VersionData {
  id: string;
  version: string;
  size: number;
  date: string;
  localizedDescription: string | null;
}

interface AppDetailContentProps {
  app: {
    id: string;
    github: string;
    name: string | null;
    developerName: string | null;
    localizedDescription: string | null;
    iconURL: string | null;
    category: string;
    minOSVersion: string | null;
    versions: VersionData[];
  };
  sourceUrl: string;
  altStoreUrl: string;
}

export function AppDetailContent({ app, sourceUrl, altStoreUrl }: AppDetailContentProps) {
  const { locale, t } = useTranslation();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      {/* 返回 */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group"
      >
        <IconArrowLeft
          size={14}
          className="transition-transform group-hover:-translate-x-0.5"
        />
        {t("detail.backToApps")}
      </Link>

      {/* 头部 */}
      <div className="flex items-start gap-5 mb-8">
        {app.iconURL ? (
          <Image
            src={app.iconURL}
            alt={app.name || app.github}
            width={80}
            height={80}
            unoptimized
            className="h-20 w-20 rounded-2xl ring-1 ring-foreground/5"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconDownload size={28} />
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {app.name || app.github}
          </h1>
          <p className="text-muted-foreground mt-0.5">
            {app.developerName || DEFAULT_DEVELOPER_NAME}
          </p>
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <Badge variant="secondary">{app.category}</Badge>
            {app.versions[0] && (
              <Badge variant="outline" className="font-mono">
                v{app.versions[0].version}
              </Badge>
            )}
            {app.minOSVersion && (
              <Badge variant="outline">iOS {app.minOSVersion}+</Badge>
            )}
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 mb-8">
        <a href={altStoreUrl} className="flex-1">
          <Button className="w-full gap-2">
            <IconDownload size={16} />
            {t("detail.addToAltStore")}
          </Button>
        </a>
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="icon">
            <IconFileCode size={16} />
          </Button>
        </a>
        <a
          href={`${GITHUB_BASE_URL}/${app.github}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="icon">
            <IconBrandGithub size={16} />
          </Button>
        </a>
      </div>

      {/* 源地址（点击复制） */}
      <Card
        className="mb-8 cursor-pointer transition-colors hover:bg-muted/50"
        onClick={() => {
          navigator.clipboard.writeText(sourceUrl).then(
            () => toast.success(t("detail.copied")),
            () => toast.error(t("detail.copyFailed"))
          );
        }}
      >
        <CardContent className="py-3.5 px-5">
          <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <IconCopy size={12} />
            {t("detail.sourceUrl")}
          </p>
          <code className="text-sm break-all text-primary font-mono">
            {sourceUrl}
          </code>
        </CardContent>
      </Card>

      {/* 描述 */}
      {app.localizedDescription && (
        <>
          <div className="mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">
              {t("detail.description")}
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {app.localizedDescription}
            </p>
          </div>
          <Separator className="mb-8" />
        </>
      )}

      {/* 版本历史 */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-4">
          {t("detail.versionHistory")}
        </h2>
        {app.versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("detail.noVersions")}</p>
        ) : (
          <div className="space-y-2.5">
            {app.versions.map((version, index) => (
              <Card
                key={version.id}
                className={`transition-all duration-200 hover:shadow-md hover:shadow-primary/5 ${index === 0 ? "ring-1 ring-primary/20" : ""}`}
              >
                <CardContent className="py-3.5 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">
                        v{version.version}
                      </span>
                      {index === 0 && (
                        <Badge>
                          <IconStar size={10} className="mr-0.5" />
                          {t("detail.latest")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatSize(version.size)}</span>
                      <span>{formatDate(version.date, locale)}</span>
                    </div>
                  </div>
                  {version.localizedDescription && (
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {version.localizedDescription}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
