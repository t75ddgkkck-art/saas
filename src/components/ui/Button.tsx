import { ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm hover:shadow-md",
        secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
        outline: "border-2 border-slate-200 bg-transparent hover:bg-slate-50 text-slate-900 focus-visible:ring-slate-400 dark:border-slate-700 dark:hover:bg-slate-800 dark:text-slate-100",
        ghost: "hover:bg-slate-100 text-slate-700 focus-visible:ring-slate-400 dark:hover:bg-slate-800 dark:text-slate-300",
        destructive: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500 shadow-sm",
        success: "bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-500 shadow-sm",
        link: "text-slate-900 underline-offset-4 hover:underline dark:text-slate-100",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-11 px-5",
        lg: "h-13 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, type, ...props }, ref) => {
    return (
      <button
        // Lot 18 B18 : `type="button"` par défaut au lieu de "submit" natif.
        // Évite les soumissions accidentelles de formulaire quand un <Button>
        // sans type explicite est placé dans un <form>. On garde la possibilité
        // de passer type="submit" ou type="reset" explicitement.
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!loading && leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
