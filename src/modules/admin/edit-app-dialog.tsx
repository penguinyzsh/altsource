/**
 * 编辑 App 对话框
 *
 * 预填当前 App 数据，支持修改所有可编辑字段。
 * 表单状态内聚在组件内部，通过 useEffect 同步外部 app prop。
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Textarea } from "@/ui/shadcn/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/ui/shadcn/dialog";
import { IconLoader2 } from "@tabler/icons-react";
import { toast } from "sonner";
import type { App } from "@/types";
import { apiClient, ApiError } from "@/core/api-client";
import { DEFAULT_TINT_COLOR } from "@/core/constants";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface EditAppDialogProps {
    /** 当前编辑的 App（null 表示关闭） */
    app: App | null;
    /** 对话框是否打开 */
    open: boolean;
    /** 对话框状态变更回调 */
    onOpenChange: (open: boolean) => void;
    /** 编辑成功后的回调（用于刷新列表） */
    onSuccess: () => void;
}

export function EditAppDialog({ app, open, onOpenChange, onSuccess }: EditAppDialogProps) {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        bundleIdentifier: "",
        name: "",
        developerName: "",
        subtitle: "",
        localizedDescription: "",
        iconURL: "",
        tintColor: "",
        category: "",
        minOSVersion: "",
    });
    const [loading, setLoading] = useState(false);

    // 当编辑的 App 变化时，同步表单数据
    useEffect(() => {
        if (app) {
            setForm({
                bundleIdentifier: app.bundleIdentifier,
                name: app.name || "",
                developerName: app.developerName || "",
                subtitle: app.subtitle || "",
                localizedDescription: app.localizedDescription || "",
                iconURL: app.iconURL || "",
                tintColor: app.tintColor || "",
                category: app.category,
                minOSVersion: app.minOSVersion || "",
            });
        }
    }, [app]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app) return;

        setLoading(true);
        try {
            await apiClient.apps.update(app.id, form);
            toast.success(t("editDialog.editSuccess"));
            onOpenChange(false);
            onSuccess();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message);
            } else {
                toast.error(t("editDialog.networkError"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("editDialog.title")}{app ? ` - ${app.name || app.github}` : ""}</DialogTitle>
                    <DialogDescription>
                        {t("editDialog.description")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-bundleId">{t("editDialog.bundleId")}</Label>
                            <Input
                                id="edit-bundleId"
                                value={form.bundleIdentifier}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        bundleIdentifier: e.target.value,
                                    })
                                }
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-category">{t("editDialog.category")}</Label>
                            <Input
                                id="edit-category"
                                value={form.category}
                                onChange={(e) =>
                                    setForm({ ...form, category: e.target.value })
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">{t("editDialog.name")}</Label>
                            <Input
                                id="edit-name"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-developer">{t("editDialog.developer")}</Label>
                            <Input
                                id="edit-developer"
                                value={form.developerName}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        developerName: e.target.value,
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-subtitle">{t("editDialog.subtitle")}</Label>
                        <Input
                            id="edit-subtitle"
                            value={form.subtitle}
                            onChange={(e) =>
                                setForm({ ...form, subtitle: e.target.value })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-description">{t("editDialog.descriptionLabel")}</Label>
                        <Textarea
                            id="edit-description"
                            value={form.localizedDescription}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    localizedDescription: e.target.value,
                                })
                            }
                            rows={3}
                            className="resize-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-iconUrl">{t("editDialog.iconUrl")}</Label>
                        <Input
                            id="edit-iconUrl"
                            value={form.iconURL}
                            onChange={(e) =>
                                setForm({ ...form, iconURL: e.target.value })
                            }
                            placeholder="https://..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-tintColor">{t("editDialog.tintColor")}</Label>
                            <Input
                                id="edit-tintColor"
                                value={form.tintColor}
                                onChange={(e) =>
                                    setForm({ ...form, tintColor: e.target.value })
                                }
                                placeholder={DEFAULT_TINT_COLOR}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-minOS">{t("editDialog.minOS")}</Label>
                            <Input
                                id="edit-minOS"
                                value={form.minOSVersion}
                                onChange={(e) =>
                                    setForm({ ...form, minOSVersion: e.target.value })
                                }
                                placeholder="14.0"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-3 mt-4 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("editDialog.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="gap-1.5"
                        >
                            {loading ? (
                                <>
                                    <IconLoader2 size={16} className="animate-spin" />
                                    {t("editDialog.saving")}
                                </>
                            ) : (
                                t("editDialog.save")
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
