"use client";

import { Phone, MessageCircle, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { t, type Lang } from "@/lib/i18n";

/**
 * Boutons de contact rapides (téléphone, WhatsApp, email, SMS).
 * - Nettoyage des numéros (retire espaces, tirets)
 * - Deep-link WhatsApp mobile (api.whatsapp.com) fonctionne partout
 * - Aucun bouton rendu si le canal n'est pas renseigné (pas de `tel:null`)
 * - Tracking optionnel via /api/track (non-bloquant)
 */

export interface ContactButtonsProps {
  slug: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  lang?: Lang;
  primaryColor?: string | null;
}

function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Garde uniquement chiffres et le + initial
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  return cleaned.length >= 6 ? cleaned : null;
}

function cleanEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  // Validation minimale : présence de @ et un point après
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function track(slug: string, event: string) {
  // Fire-and-forget : n'affecte jamais le comportement utilisateur.
  if (typeof navigator === "undefined") return;
  const body = JSON.stringify({ slug, path: `contact:${event}` });
  try {
    if ("sendBeacon" in navigator) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

export function ContactButtons({
  slug,
  phone,
  whatsapp,
  email,
  lang = "fr",
  primaryColor,
}: ContactButtonsProps) {
  const tel = cleanPhone(phone);
  const wa = cleanPhone(whatsapp) || tel;
  const mail = cleanEmail(email);

  if (!tel && !wa && !mail) return null;

  return (
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tel && (
        <a
          href={`tel:${tel}`}
          onClick={() => track(slug, "call")}
          aria-label={t(lang, "call")}
          className="w-full"
        >
          <Button
            variant="primary"
            className="w-full"
            style={primaryColor ? { backgroundColor: primaryColor } : undefined}
            leftIcon={<Phone className="h-4 w-4" aria-hidden="true" />}
          >
            {t(lang, "call")}
          </Button>
        </a>
      )}

      {wa && (
        <a
          href={`https://api.whatsapp.com/send?phone=${wa.replace(/^\+/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track(slug, "whatsapp")}
          aria-label="WhatsApp"
          className="w-full"
        >
          <Button
            variant="outline"
            className="w-full border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            leftIcon={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
          >
            WhatsApp
          </Button>
        </a>
      )}

      {tel && (
        <a
          href={`sms:${tel}`}
          onClick={() => track(slug, "sms")}
          aria-label="SMS"
          className="w-full"
        >
          <Button
            variant="outline"
            className="w-full"
            leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
          >
            SMS
          </Button>
        </a>
      )}

      {mail && (
        <a
          href={`mailto:${mail}`}
          onClick={() => track(slug, "email")}
          aria-label={t(lang, "sendEmail")}
          className="w-full"
        >
          <Button
            variant="outline"
            className="w-full"
            leftIcon={<Mail className="h-4 w-4" aria-hidden="true" />}
          >
            Email
          </Button>
        </a>
      )}
    </div>
  );
}
