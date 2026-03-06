import { Skeleton } from "@/ui/shadcn/skeleton";
import { Card, CardContent } from "@/ui/shadcn/card";

export default function HomeLoading() {
  return (
    <div className="container mx-auto px-4 py-10">
      {/* Hero skeleton */}
      <div className="mb-12 rounded-3xl border border-border/50 px-8 py-12 sm:px-12 sm:py-16">
        <Skeleton className="h-10 w-64 mb-3" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <div className="mt-6 flex gap-3">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>
      </div>

      {/* App grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <Skeleton className="mt-3 h-4 w-full" />
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
