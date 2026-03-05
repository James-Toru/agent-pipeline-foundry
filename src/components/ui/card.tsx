import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  hover?: boolean;
  className?: string;
}

export function Card({ children, hover, className }: CardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl ring-1 ring-white/6 bg-zinc-900/80 backdrop-blur-sm",
        hover &&
          "transition-all duration-200 hover:ring-white/12 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20",
        className
      )}
    >
      {children}
    </div>
  );
}
