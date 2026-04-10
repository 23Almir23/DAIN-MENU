import { cn } from "@/lib/utils";

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

const maxWidthMap = {
  sm: "max-w-3xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "",
};

export function PageWrapper({ children, className, maxWidth = "lg" }: PageWrapperProps) {
  return (
    <div className={cn("p-6 lg:p-8 mx-auto space-y-8 animate-fade-in", maxWidthMap[maxWidth], className)}>
      {children}
    </div>
  );
}
