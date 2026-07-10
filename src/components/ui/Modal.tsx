"use client";

import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Désactive la fermeture au clic outside (pour formulaires complexes). */
  closeOnOverlay?: boolean;
  /** Désactive la fermeture à Escape. */
  closeOnEscape?: boolean;
  /** Libellé du bouton close, pour lecteurs d'écran. Défaut : "Fermer". */
  closeLabel?: string;
}

/**
 * Modal accessible WCAG :
 *  - `role="dialog"` + `aria-modal="true"`
 *  - `aria-labelledby` / `aria-describedby` reliés au titre/description
 *  - Focus **trap** (Tab / Shift+Tab restent à l'intérieur)
 *  - Focus **restore** : au close, on redonne le focus à l'élément qui a ouvert
 *  - Escape ferme (désactivable via `closeOnEscape={false}`)
 *  - Click outside ferme (désactivable via `closeOnOverlay={false}`)
 *  - `scroll lock` du body + gestion du padding compensation scrollbar
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = "md",
  closeOnOverlay = true,
  closeOnEscape = true,
  closeLabel = "Fermer",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Body scroll lock + compensation de scrollbar pour éviter le jump horizontal
  useEffect(() => {
    if (!isOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen]);

  // Focus management : sauvegarde puis restore
  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    // Focus initial : premier élément focusable dans le dialog, sinon le dialog.
    const focus = () => {
      const el = dialogRef.current;
      if (!el) return;
      const focusable = getFocusable(el);
      if (focusable.length > 0) focusable[0].focus();
      else el.focus();
    };
    // rAF pour laisser le DOM peindre
    const raf = requestAnimationFrame(focus);

    return () => {
      cancelAnimationFrame(raf);
      previousFocus.current?.focus?.();
    };
  }, [isOpen]);

  // Escape close
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  } as const;

  // Focus trap : Tab & Shift+Tab en boucle sur les éléments focusables du dialog
  const handleKeyDownTrap = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const el = dialogRef.current;
    if (!el) return;
    const focusables = getFocusable(el);
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (!closeOnOverlay) return;
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDownTrap}
        className={cn(
          "relative z-50 w-full rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 animate-in zoom-in-95 duration-200",
          "max-h-[calc(100vh-2rem)] overflow-y-auto",
          "focus-visible:outline-none",
          sizeClasses[size],
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-6 pb-0">
            <div className="space-y-1">
              {title && (
                <h2
                  id={titleId}
                  className="text-xl font-semibold text-slate-900 dark:text-slate-100"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-sm text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * Retourne les éléments focusables **visibles** contenus dans un root.
 * Exclut les `[disabled]` et les `[aria-hidden="true"]`.
 */
function getFocusable(root: HTMLElement): HTMLElement[] {
  const SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "iframe",
    "audio[controls]",
    "video[controls]",
    "[contenteditable]:not([contenteditable='false'])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  const nodes = Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  return nodes.filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    // Visible ? (couvre display:none + visibility:hidden + parent invisible)
    if (el.offsetParent === null && el.tagName !== "BODY") return false;
    return true;
  });
}
