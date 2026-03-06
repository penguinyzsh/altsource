/**
 * 管理后台登录页
 *
 * 客户端组件，提供密码登录功能：
 * 1. 用户输入管理密码
 * 2. 调用 apiClient.auth.login() 验证
 * 3. 成功后将 JWT 存入 localStorage
 * 4. 跳转到管理面板 /admin
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/shadcn/button";
import { Input } from "@/ui/shadcn/input";
import { Label } from "@/ui/shadcn/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/ui/shadcn/card";
import { IconLock, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";
import { apiClient, ApiError } from "@/core/api-client";
import { LOCAL_STORAGE_TOKEN_KEY } from "@/core/constants";
import { useTranslation } from "@/ui/layout/i18n-provider";

export default function AdminLoginPage() {
    const { t } = useTranslation();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const { token } = await apiClient.auth.login(password);
            localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, token);
            router.push("/admin");
        } catch (err) {
            if (err instanceof ApiError) {
                setError(err.message);
            } else {
                setError(t("login.networkError"));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
            {/* 背景装饰 */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
            </div>

            <Card className="relative w-full max-w-sm">
                <CardHeader className="text-center pb-2 pt-8">
                    <div className="mx-auto mb-4">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <IconLock size={24} />
                        </div>
                    </div>
                    <CardTitle className="text-xl">{t("login.title")}</CardTitle>
                    <CardDescription className="mt-1">
                        {t("login.description")}
                    </CardDescription>
                </CardHeader>

                <CardContent className="pb-8">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">{t("login.passwordLabel")}</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder={t("login.passwordPlaceholder")}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive flex items-center gap-2">
                                <IconAlertTriangle size={16} className="shrink-0" />
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full gap-1.5"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <IconLoader2 size={14} className="animate-spin" />
                                    {t("login.loggingIn")}
                                </>
                            ) : (
                                t("login.login")
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
