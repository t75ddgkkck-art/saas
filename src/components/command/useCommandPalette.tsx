"use client";

/**
 * Lot 55 — Hook + Provider global pour la Command Palette.
 *
 * Design :
 *  - Provider monté dans le layout dashboard → listener Cmd+K global
 *  - Hook `useCommandPalette()` retourne `{ open, close, toggle }` pour appels manuels
 *    (bouton sidebar "Rechercher ⌘K" par exemple)
 *  - Le composant <CommandPalette> lui-même est rendu par le Provider (une seule instance)
 *
 * Shortcut : Cmd+K (Mac) OU Ctrl+K (Win/Linux).
 * Cross-platform via `event.metaKey || event.ctrlKey`.
 *
 * Anti-conflit : on n'ouvre PAS la palette si le user tape dans un input ET
 * qu'il ne fait pas explicitement Cmd+K (les inputs peuvent avoir leur propre
 * Cmd+K, ex: éditeurs riches).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CommandPalette } from "./CommandPalette";

interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const Ctx = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Écouteur global Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cross-platform : metaKey (Mac) OU ctrlKey (Win/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Une seule instance rendue au niveau Provider — évite le double-render */}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </Ctx.Provider>
  );
}

/**
 * Hook consumer — utile pour un bouton "Rechercher ⌘K" qui déclenche l'ouverture.
 * Throw si utilisé hors du Provider (fail fast, plus safe que renvoyer un no-op).
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useCommandPalette doit être utilisé à l'intérieur de <CommandPaletteProvider>"
    );
  }
  return ctx;
}
