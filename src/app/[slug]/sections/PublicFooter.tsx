"use client";

import Link from "next/link";
import { t, type Lang } from "@/lib/i18n";

export interface PublicFooterProps {
  hideBranding?: boolean | null;
  siret?: string | null;
  lang?: Lang;
}

/**
 * Footer de la vitrine publique. Extrait de PublicPage.tsx.
 * Le branding "Powered by Vitrix" est masquable pour les plans Premium
 * (`business.hideBranding = true`).
 */
export function PublicFooter({ hideBranding, siret, lang = "fr" }: PublicFooterProps) {
  return (
    <div className="mt-8 border-t border-slate-200 py-8 text-center dark:border-slate-800">
      {!hideBranding && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t(lang, "poweredBy")}{" "}
          <Link
            href="/"
            className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
          >
            Vitrix
          </Link>
        </p>
      )}
      {siret && <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">SIRET: {siret}</p>}
    </div>
  );
}
