/**
 * 管理面板
 *
 * 容器组件，负责数据逻辑和子组件编排：
 * - 数据：通过 apiClient 获取/操作 App 列表
 * - UI：委托给 components/admin/ 下的子组件渲染
 *
 * 子组件职责：
 * - AdminSkeleton：加载骨架屏
 * - AdminHeader：顶部操作栏（刷新/添加/退出）
 * - AdminEmptyState：空状态引导
 * - AppTable：App 列表表格
 * - AddAppDialog：添加 App 对话框
 * - EditAppDialog：编辑 App 对话框
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { App } from "@/types";
import { apiClient, ApiError, logout } from "@/core/api-client";
import { useTranslation } from "@/ui/layout/i18n-provider";
import { AdminSkeleton } from "@/modules/admin/admin-skeleton";
import { AdminHeader } from "@/modules/admin/admin-header";
import { AdminEmptyState } from "@/modules/admin/admin-empty-state";
import { AppTable } from "@/modules/admin/app-table";
import { AddAppDialog } from "@/modules/admin/add-app-dialog";
import { EditAppDialog } from "@/modules/admin/edit-app-dialog";
import { Button } from "@/ui/shadcn/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/ui/shadcn/dialog";
import { IconAlertTriangle, IconRefreshAlert } from "@tabler/icons-react";

export default function AdminPage() {
    const { t } = useTranslation();
    const [apps, setApps] = useState<App[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshingAppId, setRefreshingAppId] = useState<string | null>(null);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingApp, setEditingApp] = useState<App | null>(null);
    const [deletingApp, setDeletingApp] = useState<App | null>(null);
    const [deleting, setDeleting] = useState(false);

    /** 从 API 获取 App 列表（401 由 apiClient 统一处理） */
    const fetchApps = useCallback(async () => {
        try {
            setError(false);
            const data = await apiClient.apps.list();
            setApps(data);
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) return;
            setError(true);
            toast.error(t("admin.fetchFailed"));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchApps();
    }, [fetchApps]);

    /** 确认删除 App */
    const confirmDelete = async () => {
        if (!deletingApp) return;

        setDeleting(true);
        try {
            await apiClient.apps.delete(deletingApp.id);
            toast.success(t("admin.deleteSuccess"));
            setDeletingApp(null);
            await fetchApps();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message);
            } else {
                toast.error(t("admin.networkError"));
            }
        } finally {
            setDeleting(false);
        }
    };

    /** 手动触发刷新（可选指定单个 App） */
    const handleRefresh = async (appId?: string) => {
        setRefreshing(true);
        if (appId) setRefreshingAppId(appId);

        try {
            const data = await apiClient.refresh(appId);
            toast.success(
                appId
                    ? data.message
                    : t("admin.refreshResult", { success: data.success ?? 0, failed: data.failed ?? 0 })
            );
            await fetchApps();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message);
            } else {
                toast.error(t("admin.networkError"));
            }
        } finally {
            setRefreshing(false);
            setRefreshingAppId(null);
        }
    };

    /** 退出登录 */
    const handleLogout = () => {
        logout();
    };

    if (loading) {
        return <AdminSkeleton />;
    }

    if (error && apps.length === 0) {
        return (
            <div className="container mx-auto px-4 py-10">
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                        <IconRefreshAlert size={24} className="text-destructive" />
                    </div>
                    <h2 className="text-lg font-semibold mb-2">{t("admin.fetchFailed")}</h2>
                    <Button onClick={fetchApps} className="mt-4">
                        {t("error.retry")}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-10">
            <AdminHeader
                appCount={apps.length}
                refreshing={refreshing && !refreshingAppId}
                onRefreshAll={() => handleRefresh()}
                onAdd={() => setAddDialogOpen(true)}
                onLogout={handleLogout}
            />

            {apps.length === 0 ? (
                <AdminEmptyState onAdd={() => setAddDialogOpen(true)} />
            ) : (
                <AppTable
                    apps={apps}
                    refreshing={refreshing}
                    refreshingAppId={refreshingAppId}
                    onRefresh={(id) => handleRefresh(id)}
                    onEdit={setEditingApp}
                    onDelete={setDeletingApp}
                />
            )}

            <AddAppDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onSuccess={fetchApps}
            />

            <EditAppDialog
                app={editingApp}
                open={!!editingApp}
                onOpenChange={(open) => !open && setEditingApp(null)}
                onSuccess={fetchApps}
            />

            {/* Delete confirmation dialog */}
            <Dialog open={!!deletingApp} onOpenChange={(open) => !open && setDeletingApp(null)}>
                <DialogContent showCloseButton={false} className="sm:max-w-sm">
                    <DialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <IconAlertTriangle size={24} className="text-destructive" />
                        </div>
                        <DialogTitle className="text-center">{t("admin.deleteConfirmTitle")}</DialogTitle>
                        <DialogDescription className="text-center">
                            {t("admin.deleteConfirm", { name: deletingApp?.name || deletingApp?.github || "" })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-3 sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeletingApp(null)}
                            disabled={deleting}
                        >
                            {t("editDialog.cancel")}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleting}
                        >
                            {t("adminTable.delete")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
