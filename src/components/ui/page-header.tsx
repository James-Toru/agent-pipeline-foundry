interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ icon, title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-start justify-between animate-fade-up">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 ring-1 ring-white/6 text-zinc-400">
            {icon}
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1.5 ml-12 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
