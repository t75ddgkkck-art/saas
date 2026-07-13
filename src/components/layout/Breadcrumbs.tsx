"use client";

/**
 * Breadcrumbs auto-générés depuis le pathname (Lot 22).
 *
 * Exemple : /dashboard/blog/edit/123 →
 *   Dashboard › Blog › Edit › 123
 *
 * On mappe les segments techniques vers des libellés lisibles via un dico.
 * Les segments UUID (36 chars 8-4-4-4-12) sont abrégés en "…" par sécurité.
 *
 * On n'affiche RIEN sur `/dashboard` racine (redondant avec le H1) ni sur les
 * pages hors dashboard (landing, vitrine publique) — géré par l'appelant.
 *
 * A11y : nav aria-label="Fil d'Ariane", `aria-current="page"` sur le dernier
 * segment.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dictionnaire libellés — étendre au fil des sections. */
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  appointments: "Rendez-vous",
  quotes: "Devis",
  invoices: "Factures",
  clients: "Clients",
  payments: "Paiements",
  blog: "Blog",
  gallery: "Galerie",
  reviews: "Avis",
  vitrine: "Ma vitrine",
  settings: "Paramètres",
  analytics: "Statistiques",
  outils: "Outils",
  admin: "Admin",
  "ai-chat": "Assistant IA",
  welcome: "Bienvenue",
  "my-businesses": "Mes vitrines",
  "qr-code": "QR Code",
  "pdf-templates": "PDF",
};

function humanize(segment: string): string {
  if (UUID_RE.test(segment)) return "…";
  if (LABELS[segment]) return LABELS[segment];
  // Fallback : "quote-form-fields" → "Quote form fields"
  return segment.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function Breadcrumbs() {
  const pathname = usePathname() || "/";
  // Sépare les segments non-vides
  const segments = pathname.split("/").filter(Boolean);

  // Pas de breadcrumb sur la racine dashboard (H1 suffit)
  if (segments.length <= 1) return null;
  // Pas de breadcrumb hors dashboard (pages publiques ont leur propre nav)
  if (segments[0] !== "dashboard") return null;

  // Construit les items avec l'URL cumulée
  const items = segments.map((seg, i) => ({
    label: humanize(seg),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav aria-label="Fil d'Ariane" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {items.map((item, idx) => (
          <li key={item.href} className="flex items-center gap-1">
            {idx > 0 && (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-slate-400 dark:text-slate-600"
                aria-hidden="true"
              />
            )}
            {item.isLast ? (
              <span aria-current="page" className="font-medium text-slate-700 dark:text-slate-300">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-slate-900 hover:underline dark:hover:text-slate-100"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
