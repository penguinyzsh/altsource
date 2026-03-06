/**
 * 管理面板骨架屏
 *
 * 在 App 列表加载期间显示的占位 UI。
 */

"use client";

import { Skeleton } from "@/ui/shadcn/skeleton";
import { Card, CardContent } from "@/ui/shadcn/card";

export function AdminSkeleton() {
    return (
        <div className="container mx-auto px-4 py-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Skeleton className="h-9 w-24 rounded-full" />
                    <Skeleton className="h-9 w-24 rounded-full" />
                    <Skeleton className="h-9 w-9 rounded-full" />
                </div>
            </div>
            <Card>
                <CardContent className="p-0">
                    <div className="space-y-0">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 border-b border-border/50 last:border-0">
                                <Skeleton className="h-9 w-9 rounded-xl" />
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-40 ml-auto" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
