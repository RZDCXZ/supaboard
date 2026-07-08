export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex min-h-18 items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-2xl leading-8 font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
