/**
 * Health check email : vérifie la config Resend + SPF/DMARC via DNS.
 *
 * Utilité :
 *  - Diagnostiquer rapidement pourquoi les emails partent en spam
 *  - Vérif régulière (cron externe → alertes)
 *
 * Sécurité : la route est publique mais ne divulgue AUCUN secret.
 * En prod on peut la restreindre via header X-Health-Secret si besoin.
 */

import { NextResponse } from "next/server";
import { promises as dns } from "dns";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DnsCheck {
  name: string;
  ok: boolean;
  detail?: string;
  raw?: string;
}

async function checkTxtRecord(
  hostname: string,
  matcher: (raw: string) => boolean
): Promise<DnsCheck> {
  try {
    const records = await dns.resolveTxt(hostname);
    const flat = records.map((r) => r.join(""));
    const match = flat.find(matcher);
    return {
      name: hostname,
      ok: Boolean(match),
      raw: match || flat.join(" | ").slice(0, 200) || "(aucun record)",
    };
  } catch (err) {
    return {
      name: hostname,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function getEmailDomain(): string {
  const from = process.env.RESEND_FROM_EMAIL || "noreply@vitrix.fr";
  return from.split("@")[1] || "vitrix.fr";
}

export async function GET() {
  const domain = getEmailDomain();
  const hasApiKey = Boolean(process.env.RESEND_API_KEY);

  // On teste 3 records DNS classiques :
  //  - SPF (v=spf1 ... include:amazonses.com pour Resend)
  //  - DMARC (_dmarc.<domain>, v=DMARC1)
  //  - DKIM (resend._domainkey.<domain>, valeur commence par v=DKIM1)
  const [spf, dmarc, dkim] = await Promise.all([
    checkTxtRecord(domain, (r) => r.startsWith("v=spf1")),
    checkTxtRecord(`_dmarc.${domain}`, (r) => r.startsWith("v=DMARC1")),
    checkTxtRecord(`resend._domainkey.${domain}`, (r) => r.startsWith("v=DKIM1")),
  ]);

  const allOk = hasApiKey && spf.ok && dmarc.ok && dkim.ok;
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      ok: allOk,
      domain,
      resend: {
        apiKeyConfigured: hasApiKey,
        fromEmail: process.env.RESEND_FROM_EMAIL || "noreply@vitrix.fr",
        fromName: process.env.RESEND_FROM_NAME || "Vitrix",
      },
      dns: { spf, dmarc, dkim },
      recommendations: allOk
        ? []
        : [
            !hasApiKey && "Ajoutez RESEND_API_KEY dans les variables d'environnement Vercel.",
            !spf.ok &&
              `Ajoutez le record SPF sur ${domain} : "v=spf1 include:amazonses.com ~all"`,
            !dmarc.ok &&
              `Ajoutez le record DMARC sur _dmarc.${domain} : "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}"`,
            !dkim.ok &&
              `Ajoutez le record DKIM fourni par Resend sur resend._domainkey.${domain}`,
          ].filter(Boolean),
    },
    { status }
  );
}
