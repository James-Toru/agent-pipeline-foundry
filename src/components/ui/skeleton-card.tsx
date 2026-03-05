import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl ring-1 ring-white/4 bg-zinc-900/60 skeleton-shimmer",
        className ?? "h-28"
      )}
    />
  );
}
