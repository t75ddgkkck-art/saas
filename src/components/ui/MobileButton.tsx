import { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function MobileButton({
  children,
  loading,
  className,
  disabled,
  ...props
}: MobileButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`w-full rounded-xl bg-blue-600 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700 ${
        className || ""
      }`}
      {...props}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Chargement...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}
