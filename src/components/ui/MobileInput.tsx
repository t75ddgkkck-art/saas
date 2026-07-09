import { InputHTMLAttributes } from "react";

interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function MobileInput({ label, error, className, ...props }: MobileInputProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 ${
          error ? "border-red-500" : ""
        } ${className || ""}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
