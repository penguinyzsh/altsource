/**
 * App 列表表格
 *
 * 展示所有已收录的 App，包含名称、仓库链接、Bundle ID、
 * 最新版本号、更新时间和操作按钮（刷新/编辑/删除）。
 */

"use client";

import { Button } from "@/ui/shadcn/button";
import { Badge } from "@/ui/shadcn/badge";
import { Card } from "@/ui/shadcn/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/shadcn/tooltip";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/ui/shadcn/table";
import { IconRefresh, IconPencil, IconTrash, IconApps } from "@tabler/icons-react";
import Image from "next/image";
import type { App } from "@/types";
import { GITHUB_BASE_URL } from "@/core/constants";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface AppTableProps {
    /** App 列表数据 */
    apps: App[];
    /** 是否正在全局刷新 */
    refreshing: boolean;
    /** 当前正在刷新的单个 App ID */
    refreshingAppId: string | null;
    /** 刷新单个 App */
    onRefresh: (appId: string) => void;
    /** 编辑 App */
    onEdit: (app: App) => void;
    /** 删除 App */
    onDelete: (app: App) => void;
}

export function AppTable({ apps, refreshing, refreshingAppId, onRefresh, onEdit, onDelete }: AppTableProps) {
    const { locale, t } = useTranslation();

    return (
        <Card className="overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="font-semibold">{t("adminTable.name")}</TableHead>
                        <TableHead className="font-semibold hidden md:table-cell">{t("adminTable.repo")}</TableHead>
                        <TableHead className="font-semibold hidden lg:table-cell">{t("adminTable.bundleId")}</TableHead>
                        <TableHead className="font-semibold hidden sm:table-cell">{t("adminTable.updated")}</TableHead>
                        <TableHead className="text-right font-semibold">{t("adminTable.actions")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {apps.map((app) => (
                        <TableRow key={app.id} className="border-border/50 hover:bg-accent/50 transition-colors">
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    {app.iconURL ? (
                                        <Image
                                            src={app.iconURL}
                                            alt=""
                                            width={36}
                                            height={36}
                                            unoptimized
                                            className="h-9 w-9 rounded-lg ring-1 ring-foreground/5 shrink-0"
                                        />
                                    ) : (
                                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <IconApps size={16} />
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs">
                                            {app.name || app.github}
                                        </span>
                                        <div className="mt-0.5">
                                            {app.versions[0] ? (
                                                <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
                                                    v{app.versions[0].version}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-[10px] italic">
                                                    {t("adminTable.noVersion")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <a
                                    href={`${GITHUB_BASE_URL}/${app.github}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm transition-colors"
                                >
                                    {app.github}
                                </a>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                                <code className="text-xs bg-muted/50 px-2 py-1 rounded-full font-mono">
                                    {app.bundleIdentifier}
                                </code>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                {new Date(app.updatedAt).toLocaleDateString(locale)}
                            </TableCell>
                            <TableCell className="text-right py-2">
                                <div className="flex items-center justify-end gap-1">
                                    <Tooltip>
                                        <TooltipTrigger render={
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onRefresh(app.id)}
                                                disabled={refreshing}
                                                className="px-2"
                                            >
                                                <IconRefresh
                                                    size={16}
                                                    className={refreshingAppId === app.id ? "animate-spin" : ""}
                                                />
                                            </Button>
                                        } />
                                        <TooltipContent><p>{t("adminTable.refresh")}</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger render={
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onEdit(app)}
                                                className="px-2"
                                            >
                                                <IconPencil size={16} />
                                            </Button>
                                        } />
                                        <TooltipContent><p>{t("adminTable.edit")}</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger render={
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive px-2"
                                                onClick={() => onDelete(app)}
                                            >
                                                <IconTrash size={16} />
                                            </Button>
                                        } />
                                        <TooltipContent><p>{t("adminTable.delete")}</p></TooltipContent>
                                    </Tooltip>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
