import { Skeleton } from "@/ui/shadcn/skeleton";
import { Card, CardContent } from "@/ui/shadcn/card";

export default function AppDetailLoading() {
  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      {/* Back link */}
      <Skeleton className="h-4 w-28 mb-8" />

      {/* Header */}
      <div className="flex items-start gap-5 mb-8">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="flex-1">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-8">
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      {/* Source URL card */}
      <Card className="mb-8">
        <CardContent className="py-3.5 px-5">
          <Skeleton className="h-3 w-32 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>

      {/* Version history */}
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="space-y-2.5">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="py-3.5 px-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
