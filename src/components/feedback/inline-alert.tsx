import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const variants = {
  info: {
    icon: InfoIcon,
    className: "border-info/30 bg-info-soft text-info",
  },
  success: {
    icon: CircleCheckIcon,
    className: "border-primary/30 bg-primary-soft text-primary",
  },
  warning: {
    icon: TriangleAlertIcon,
    className: "border-warning/30 bg-warning-soft text-warning",
  },
  error: {
    icon: CircleXIcon,
    className: "border-destructive/30 bg-danger-soft text-destructive",
  },
} as const;

export function InlineAlert({
  variant,
  title,
  children,
  className,
}: {
  variant: keyof typeof variants;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: variantClassName } = variants[variant];
  const isError = variant === "error";

  return (
    <Alert
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      className={cn(variantClassName, className)}
    >
      <Icon aria-hidden="true" />
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
  );
}
