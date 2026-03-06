interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between animate-fade-up">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-white/6 text-zinc-400">
            {icon}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white truncate">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1.5 sm:ml-12 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
