"use client";

import { t, type Lang } from "@/lib/i18n";

export interface QrCodeCardProps {
  qrCode: string;
  slug: string;
  lang?: Lang;
  cardBorder: string;
  cardBg: string;
}

const CAPTIONS: Record<Lang, string> = {
  fr: "Scannez ce code pour enregistrer ou partager cette page.",
  en: "Scan this code to save or share this page.",
  es: "Escanea este código para guardar o compartir esta página.",
  de: "Scannen Sie diesen Code, um die Seite zu speichern oder zu teilen.",
};

/**
 * Bloc "QR Code" affiché en bas de la vitrine. Extrait de PublicPage.tsx.
 */
export function QrCodeCard({ qrCode, slug, lang = "fr", cardBorder, cardBg }: QrCodeCardProps) {
  return (
    <div className={`mt-8 rounded-2xl border ${cardBorder} ${cardBg} p-6`}>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrCode}
          alt="QR code de partage de la page"
          className="h-36 w-36 rounded-xl bg-white p-2 shadow-sm"
        />
        <div className="text-center sm:text-left">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            📱 {t(lang, "qrTitle")}
          </p>
          <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
            {CAPTIONS[lang] || CAPTIONS.fr}
          </p>
          <p className="mt-2 font-mono text-xs text-slate-400">vitrix.fr/{slug}</p>
        </div>
      </div>
    </div>
  );
}
