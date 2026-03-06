"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { IconSun, IconMoon } from "@tabler/icons-react"
import { Button } from "@/ui/shadcn/button"
import { useTranslation } from "@/ui/layout/i18n-provider"

/** 空 subscribe — 客户端永远不会收到通知 */
const subscribe = () => () => { };

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const { t } = useTranslation()

    // useSyncExternalStore 的第三个参数是 SSR 快照，
    // 始终返回 false，客户端 hydration 后返回 true
    const mounted = useSyncExternalStore(subscribe, () => true, () => false)

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon-sm" aria-label="Toggle theme">
                <IconSun size={16} />
            </Button>
        )
    }

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={t("nav.toggleTheme")}
        >
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
        </Button>
    )
}
