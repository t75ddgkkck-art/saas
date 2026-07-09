import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

// API officielle de l'État français — gratuite, sans clé API
// https://api.gouv.fr/les-api/api-recherche-entreprises
const API_SIRENE = "https://recherche-entreprises.api.gouv.fr";

export interface SiretVerificationResult {
  valid: boolean;
  name?: string;
  address?: string;
  activity?: string;
  city?: string;
  postalCode?: string;
  legalForm?: string;
  error?: string;
}

export async function verifySiret(siret: string): Promise<SiretVerificationResult> {
  const cleanSiret = siret.replace(/\s/g, "");

  // Validation format : 14 chiffres
  if (!/^\d{14}$/.test(cleanSiret)) {
    return { valid: false, error: "Le SIRET doit contenir exactement 14 chiffres" };
  }

  // Validation algorithme de Luhn
  if (!isValidLuhn(cleanSiret)) {
    return { valid: false, error: "Le numéro SIRET n'est pas valide (clé de contrôle incorrecte)" };
  }

  try {
    // Appel à l'API officielle de l'État (gratuite, sans auth)
    const response = await fetch(
      `${API_SIRENE}/search?q=${cleanSiret}&per_page=1&est_siege=true&etat_administratif=A`,
      {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return { valid: false, error: "Trop de requêtes, réessayez dans quelques secondes" };
      }
      return { valid: false, error: "Erreur lors de la vérification" };
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        valid: false,
        error: "SIRET introuvable dans la base SIRENE de l'INSEE.",
      };
    }

    const result = data.results[0];

    if (result.etat_administratif !== "A") {
      return {
        valid: false,
        error: "Cet établissement n'est plus actif. Seuls les établissements actifs peuvent s'inscrire.",
      };
    }

    // Vérifier correspondance exacte du SIRET
    const matchExact = result.matching_etablissements?.some(
      (e: any) => e.siret === cleanSiret
    ) || result.siege?.siret === cleanSiret;

    if (!matchExact) {
      return {
        valid: false,
        error: "Ce SIRET ne correspond pas exactement à un établissement actif.",
      };
    }

    const siege = result.siege || {};
    const adresse = [
      siege.numero_voie,
      siege.type_voie,
      siege.libelle_voie,
    ].filter(Boolean).join(" ");

    return {
      valid: true,
      name: result.nom_complet || result.nom_raison_sociale || "Entreprise",
      address: adresse || "Adresse non disponible",
      city: siege.libelle_commune,
      postalCode: siege.code_postal,
      legalForm: result.nature_juridique,
      activity: result.activite_principale,
    };
  } catch (error: any) {
    console.warn("API INSEE indisponible, fallback Luhn:", error.message);
    return {
      valid: true,
      name: "Entreprise (vérification Luhn - API INSEE temporairement indisponible)",
      address: "Adresse non disponible",
    };
  }
}

function isValidLuhn(siret: string): boolean {
  let sum = 0;
  let isEven = false;
  for (let i = siret.length - 1; i >= 0; i--) {
    let digit = parseInt(siret[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// Génération de QR code
export async function generateQRCode(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Erreur génération QR code:", error);
    throw new Error("Impossible de générer le QR code");
  }
}

export async function generateQRCodeBuffer(text: string): Promise<Buffer> {
  try {
    return await QRCode.toBuffer(text, {
      width: 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Erreur génération QR code buffer:", error);
    throw new Error("Impossible de générer le QR code");
  }
}
