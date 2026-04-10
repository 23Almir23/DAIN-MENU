import { type LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-sans-heading flex items-center gap-2.5 tracking-tight">
          {Icon && (
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-[18px] w-[18px] text-primary" />
            </div>
          )}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
