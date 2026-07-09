"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  /** ms avant auto-dismiss. 0 = jamais. Défaut 4500. */
  duration?: number;
}

interface ToastContextValue {
  push: (t: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
  /** Raccourcis */
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return ctx;
}

/**
 * Provider global à monter au niveau layout racine.
 * L'UI s'affiche en portail en bas-droite (mobile : centrée en bas).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = Math.random().toString(36).slice(2, 10);
      const item: ToastItem = { duration: 4500, ...t, id };
      setToasts((prev) => [...prev, item]);
      if (item.duration && item.duration > 0) {
        const timer = setTimeout(() => dismiss(id), item.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    // Cleanup au démontage
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const success = useCallback(
    (message: string, title?: string) => push({ kind: "success", message, title }),
    [push]
  );
  const error = useCallback(
    (message: string, title?: string) => push({ kind: "error", message, title, duration: 7000 }),
    [push]
  );
  const info = useCallback(
    (message: string, title?: string) => push({ kind: "info", message, title }),
    [push]
  );
  const warning = useCallback(
    (message: string, title?: string) => push({ kind: "warning", message, title }),
    [push]
  );

  return (
    <ToastContext.Provider value={{ push, dismiss, clear, success, error, info, warning }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const KIND_STYLES: Record<ToastKind, { icon: typeof CheckCircle2; bg: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-900",
    iconColor: "text-red-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900",
    iconColor: "text-blue-500",
  },
  warning: {
    icon: AlertCircle,
    bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900",
    iconColor: "text-amber-500",
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
    >
      {toasts.map((t) => {
        const { icon: Icon, bg, iconColor } = KIND_STYLES[t.kind];
        return (
          <div
            key={t.id}
            role={t.kind === "error" || t.kind === "warning" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-sm",
              "animate-in slide-in-from-bottom-2 fade-in duration-200",
              bg
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              {t.title && (
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t.title}
                </p>
              )}
              <p className="text-sm text-slate-700 dark:text-slate-300">{t.message}</p>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Fermer la notification"
              className="rounded-lg p-1 text-slate-400 hover:bg-white/40 hover:text-slate-600 dark:hover:bg-slate-800/60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
