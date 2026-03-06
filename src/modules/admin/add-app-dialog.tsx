/**
 * 添加 App 对话框
 *
 * 表单包含：GitHub 仓库地址、Bundle Identifier（可选）、最低系统版本（可选）。
 * 表单状态内聚在组件内部管理。
 */

"use client";

import { useState } from "react";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
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
import type { AddAppForm } from "@/types";
import { apiClient, ApiError } from "@/core/api-client";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface AddAppDialogProps {
    /** 对话框是否打开 */
    open: boolean;
    /** 对话框状态变更回调 */
    onOpenChange: (open: boolean) => void;
    /** 添加成功后的回调（用于刷新列表） */
    onSuccess: () => void;
}

export function AddAppDialog({ open, onOpenChange, onSuccess }: AddAppDialogProps) {
    const { t } = useTranslation();
    const [form, setForm] = useState<AddAppForm>({
        github: "",
        bundleIdentifier: "",
        minOSVersion: "",
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await apiClient.apps.create(form);
            const bid = data?.bundleIdentifier || "";
            toast.success(
                bid
                    ? t("addDialog.addSuccessWithBid", { bid })
                    : t("addDialog.addSuccessNoBid")
            );
            onOpenChange(false);
            setForm({ github: "", bundleIdentifier: "", minOSVersion: "" });
            onSuccess();
        } catch (err) {
            if (err instanceof ApiError) {
                toast.error(err.message);
            } else {
                toast.error(t("addDialog.networkError"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t("addDialog.title")}</DialogTitle>
                    <DialogDescription>
                        {t("addDialog.description")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="github">{t("addDialog.githubLabel")}</Label>
                        <Input
                            id="github"
                            placeholder="owner/repo"
                            value={form.github}
                            onChange={(e) =>
                                setForm({ ...form, github: e.target.value })
                            }
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            {t("addDialog.githubHelp")}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="bundleId">{t("addDialog.bundleIdLabel")}</Label>
                        <Input
                            id="bundleId"
                            placeholder="com.example.app"
                            value={form.bundleIdentifier}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    bundleIdentifier: e.target.value,
                                })
                            }
                        />
                        <p className="text-xs text-muted-foreground">
                            {t("addDialog.bundleIdHelp")}
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="minOS">{t("addDialog.minOSLabel")}</Label>
                        <Input
                            id="minOS"
                            placeholder="14.0"
                            value={form.minOSVersion}
                            onChange={(e) =>
                                setForm({ ...form, minOSVersion: e.target.value })
                            }
                        />
                    </div>
                    <DialogFooter className="gap-3 mt-4 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("addDialog.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="gap-1.5"
                        >
                            {loading ? (
                                <>
                                    <IconLoader2 size={16} className="animate-spin" />
                                    {t("addDialog.adding")}
                                </>
                            ) : (
                                t("addDialog.add")
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
