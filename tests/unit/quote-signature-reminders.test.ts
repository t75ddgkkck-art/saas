/**
 * F8 (Lot 38) — Tests decideReminderTier (state machine cron reminders).
 */

import { describe, expect, it } from "vitest";
import { __cronInternals } from "@/app/api/cron/quote-signature-reminders/route";

const { decideReminderTier } = __cronInternals;

const NOW = new Date("2026-08-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base = {
  status: "sent",
  signatureTokenHash: "abc",
  signatureTokenExpiresAt: new Date(NOW.getTime() + 30 * 86_400_000),
  signatureReminderCount: 0,
  signatureReminderSentAt: null as Date | null,
  updatedAt: daysAgo(4),
};

describe("decideReminderTier", () => {
  it("null si status !== sent", () => {
    expect(decideReminderTier({ ...base, status: "draft" }, NOW)).toBeNull();
    expect(decideReminderTier({ ...base, status: "accepted" }, NOW)).toBeNull();
    expect(decideReminderTier({ ...base, status: "cancelled" }, NOW)).toBeNull();
  });

  it("null si pas de token de signature", () => {
    expect(decideReminderTier({ ...base, signatureTokenHash: null }, NOW)).toBeNull();
  });

  it("null si token expiré", () => {
    expect(decideReminderTier({ ...base, signatureTokenExpiresAt: daysAgo(1) }, NOW)).toBeNull();
  });

  it("J+3 : envoyé il y a >= 3j, jamais relancé", () => {
    expect(decideReminderTier({ ...base, updatedAt: daysAgo(3) }, NOW)).toBe("J+3");
    expect(decideReminderTier({ ...base, updatedAt: daysAgo(4) }, NOW)).toBe("J+3");
  });

  it("null si < 3j après envoi (trop tôt)", () => {
    expect(decideReminderTier({ ...base, updatedAt: daysAgo(2) }, NOW)).toBeNull();
  });

  it("J+7 : envoyé il y a >= 7j, 1 rappel envoyé il y a >= 3j", () => {
    expect(
      decideReminderTier(
        {
          ...base,
          updatedAt: daysAgo(8),
          signatureReminderCount: 1,
          signatureReminderSentAt: daysAgo(4),
        },
        NOW
      )
    ).toBe("J+7");
  });

  it("null pour J+7 si dernier rappel trop récent", () => {
    expect(
      decideReminderTier(
        {
          ...base,
          updatedAt: daysAgo(8),
          signatureReminderCount: 1,
          signatureReminderSentAt: daysAgo(1), // 1j seulement
        },
        NOW
      )
    ).toBeNull();
  });

  it("J+15 : envoyé il y a >= 15j, 2 rappels envoyés il y a >= 7j", () => {
    expect(
      decideReminderTier(
        {
          ...base,
          updatedAt: daysAgo(16),
          signatureReminderCount: 2,
          signatureReminderSentAt: daysAgo(8),
        },
        NOW
      )
    ).toBe("J+15");
  });

  it("null si 3 rappels déjà envoyés (plafond atteint)", () => {
    // Impossible d'atteindre ici — le SQL pré-filtre déjà `< 3`
    // Mais on teste par sécurité que la fonction ne renvoie rien.
    expect(
      decideReminderTier(
        {
          ...base,
          updatedAt: daysAgo(30),
          signatureReminderCount: 3,
          signatureReminderSentAt: daysAgo(10),
        },
        NOW
      )
    ).toBeNull();
  });

  it("séquence complète : count 0 → 1 → 2 → plus rien", () => {
    let count = 0;
    let lastReminder: Date | null = null;
    const updatedAt = daysAgo(20);

    // Simule le state à chaque appel du cron (une fois par jour idéalement)
    const tier1 = decideReminderTier(
      {
        ...base,
        updatedAt,
        signatureReminderCount: count,
        signatureReminderSentAt: lastReminder,
      },
      NOW
    );
    expect(tier1).toBe("J+3");
    count = 1;
    lastReminder = daysAgo(17); // envoyé le lendemain de J+3 depuis send

    const tier2 = decideReminderTier(
      {
        ...base,
        updatedAt,
        signatureReminderCount: count,
        signatureReminderSentAt: lastReminder,
      },
      NOW
    );
    expect(tier2).toBe("J+7");
    count = 2;
    lastReminder = daysAgo(12);

    const tier3 = decideReminderTier(
      {
        ...base,
        updatedAt,
        signatureReminderCount: count,
        signatureReminderSentAt: lastReminder,
      },
      NOW
    );
    expect(tier3).toBe("J+15");
  });
});
