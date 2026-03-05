import { Card } from "./card";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}

export function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-white/6 text-zinc-400">
          {icon}
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white">{value}</p>
      {subtext && (
        <p className="mt-1 text-xs text-zinc-500">{subtext}</p>
      )}
    </Card>
  );
}
