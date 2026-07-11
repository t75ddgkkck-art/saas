/**
 * Lot 27 — Tests de contrat API.
 *
 * Objectif : figer la SHAPE des réponses des routes API critiques.
 * Si un dev change accidentellement la forme d'une réponse (ex : rename
 * `totalCents` → `amount`), un client externe / le mobile Expo / le webhook
 * consommateur casse en silence.
 *
 * Ce test ne fait PAS appel aux vraies routes (pas de DB, pas de fetch réseau).
 * Il :
 *   1. Définit un schéma Zod = ce que la route DOIT renvoyer
 *   2. Utilise ce schéma pour valider un exemple de payload
 *   3. Toute modif accidentelle de la shape casse le test
 *
 * Pour ajouter une route :
 *   - Ajouter son schéma dans CONTRACTS
 *   - Ajouter un exemple qui matche
 *
 * Les schémas ici sont la DOCUMENTATION EXÉCUTABLE du contrat public.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schémas réutilisables
// ---------------------------------------------------------------------------

// UUID v4 (ce que Drizzle génère via defaultRandom())
const uuid = z.string().uuid();

// ISO 8601 timestamp (JSON.stringify d'une Date)
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime());

// Erreur normalisée renvoyée par `handleApiError`
const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Contrats — routes GET (payloads de lecture)
// ---------------------------------------------------------------------------

// Note : le schema DB utilise "cancelled" (2 L), pas "canceled" (contrairement
// à ce qui aurait pu être fait par convention Stripe US). Découverte au Lot 30
// via TS check — le contract test précédent était faux (jamais confronté à un
// vrai payload). "draft" n'est pas dans l'enum DB non plus.
const appointmentSchema = z.object({
  id: uuid,
  businessId: uuid,
  clientId: uuid.nullable(),
  serviceId: uuid.nullable(),
  startTime: isoDate,
  endTime: isoDate,
  // F6 (Lot 35) : ajout `en_route` et `in_progress` — 7 valeurs au total
  status: z.enum([
    "pending",
    "confirmed",
    "en_route",
    "in_progress",
    "completed",
    "no_show",
    "cancelled",
  ]),
  notes: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate.optional(),
});

const paymentSchema = z.object({
  id: uuid,
  businessId: uuid,
  clientId: uuid.nullable(),
  appointmentId: uuid.nullable(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.enum(["pending", "paid", "failed", "refunded", "canceled"]),
  method: z.string().nullable(),
  createdAt: isoDate,
});

const quoteSchema = z.object({
  id: uuid,
  businessId: uuid,
  clientId: uuid.nullable(),
  number: z.string(),
  status: z.enum(["draft", "sent", "accepted", "declined", "expired"]),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: isoDate,
});

const clientSchema = z.object({
  id: uuid,
  businessId: uuid,
  name: z.string().min(1),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: isoDate,
});

const searchResultSchema = z.object({
  type: z.enum(["business", "blog"]),
  id: z.string(),
  title: z.string(),
  url: z.string(),
  snippet: z.string().optional(),
});

const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
});

// ---------------------------------------------------------------------------
// Exemples valides — un par contrat
// Ces exemples DOIVENT rester alignés avec ce que renvoient les vraies routes.
// Si tu changes la route → change l'exemple → le test passe.
// Si tu changes UNIQUEMENT l'exemple → le test passe mais la route casse en prod.
// Donc : à mettre à jour EN MÊME TEMPS que la route.
// ---------------------------------------------------------------------------

const validAppointment = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  serviceId: null,
  startTime: "2026-07-15T09:00:00.000Z",
  endTime: "2026-07-15T10:00:00.000Z",
  status: "confirmed" as const,
  notes: "RDV chantier",
  createdAt: "2026-07-10T12:00:00.000Z",
  updatedAt: "2026-07-10T12:00:00.000Z",
};

const validPayment = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  clientId: "33333333-3333-4333-8333-333333333333",
  appointmentId: null,
  amountCents: 5000,
  currency: "EUR",
  status: "paid" as const,
  method: "card_terminal",
  createdAt: "2026-07-10T12:00:00.000Z",
};

const validQuote = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  clientId: null,
  number: "DEV-2026-0001",
  status: "sent" as const,
  totalCents: 120000,
  currency: "EUR",
  createdAt: "2026-07-10T12:00:00.000Z",
};

const validClient = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  name: "Jean Dupont",
  email: "jean@example.com",
  phone: "+33612345678",
  notes: null,
  createdAt: "2026-07-10T12:00:00.000Z",
};

const validSearchResponse = {
  query: "plombier argentré",
  results: [
    {
      type: "business" as const,
      id: "biz-1",
      title: "Plomberie Dupont",
      url: "/p/plomberie-dupont",
      snippet: "Plombier certifié Argentré-du-Plessis",
    },
    {
      type: "blog" as const,
      id: "post-1",
      title: "Comment détecter une fuite",
      url: "/blog/detecter-fuite",
    },
  ],
};

const validErrorResponse = { error: "Vous devez être connecté", code: "UNAUTHORIZED" };

// ---------------------------------------------------------------------------
// Table des contrats — le cœur du test
// ---------------------------------------------------------------------------

// F3 (Lot 31) — contract des routes de l'espace client final
const clientMeSchema = z.object({
  email: z.string().email(),
  businesses: z.array(
    z.object({
      id: uuid,
      slug: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      category: z.string().nullable(),
      profileImage: z.string().nullable(),
    })
  ),
});

const validClientMe = {
  email: "user@example.com",
  businesses: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "plomberie-dupont",
      name: "Plomberie Dupont",
      city: "Argentré",
      category: "Plombier",
      profileImage: null,
    },
  ],
};

const clientAppointmentSchema = z.object({
  id: uuid,
  businessId: uuid,
  businessName: z.string(),
  businessSlug: z.string(),
  businessCity: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  date: z.string(), // YYYY-MM-DD, format DB legacy
  startTime: z.string(),
  endTime: z.string(),
  // F6 (Lot 35) : 7 valeurs (ajout en_route, in_progress)
  status: z.enum([
    "pending",
    "confirmed",
    "en_route",
    "in_progress",
    "cancelled",
    "completed",
    "no_show",
  ]),
  depositRequired: z.boolean(),
  depositAmountCents: z.number().int().nullable(),
  depositStatus: z.enum(["pending", "paid", "refunded", "forfeited"]).nullable(),
  createdAt: isoDate,
});

const validClientAppointment = {
  id: "11111111-1111-4111-8111-111111111111",
  businessId: "22222222-2222-4222-8222-222222222222",
  businessName: "Plomberie Dupont",
  businessSlug: "plomberie-dupont",
  businessCity: "Argentré",
  title: "Réparation fuite",
  description: null,
  date: "2026-07-15",
  startTime: "09:00",
  endTime: "10:00",
  status: "confirmed" as const,
  depositRequired: true,
  depositAmountCents: 2000,
  depositStatus: "paid" as const,
  createdAt: "2026-07-10T12:00:00.000Z",
};

const CONTRACTS = [
  { name: "GET /api/appointments/[id]", schema: appointmentSchema, sample: validAppointment },
  { name: "GET /api/payments (item)", schema: paymentSchema, sample: validPayment },
  { name: "GET /api/quotes (item)", schema: quoteSchema, sample: validQuote },
  { name: "GET /api/clients/[id]", schema: clientSchema, sample: validClient },
  { name: "GET /api/search", schema: searchResponseSchema, sample: validSearchResponse },
  { name: "Error response (any 4xx/5xx)", schema: errorResponseSchema, sample: validErrorResponse },
  { name: "GET /api/client/me", schema: clientMeSchema, sample: validClientMe },
  {
    name: "GET /api/client/appointments (item)",
    schema: clientAppointmentSchema,
    sample: validClientAppointment,
  },
] as const;

describe("API contract — response shapes", () => {
  for (const { name, schema, sample } of CONTRACTS) {
    it(`${name} respecte le contrat`, () => {
      const parsed = schema.safeParse(sample);
      if (!parsed.success) {
        // Message d'erreur détaillé pour debug rapide
        // eslint-disable-next-line no-console
        console.error(`Contract broken for ${name}:`, JSON.stringify(parsed.error.issues, null, 2));
      }
      expect(parsed.success).toBe(true);
    });
  }

  it("rejette une réponse malformée (canary)", () => {
    // Sanity check : le schema DOIT rejeter un payload cassé,
    // sinon on aurait un test qui passe toujours (faux positif).
    const bad = { ...validAppointment, status: "unknown_status" };
    expect(appointmentSchema.safeParse(bad).success).toBe(false);
  });

  it("rejette un payload manquant un champ requis", () => {
    // Retire businessId → doit fail
    const { businessId: _omit, ...rest } = validAppointment;
    void _omit;
    expect(appointmentSchema.safeParse(rest).success).toBe(false);
  });
});

describe("API contract — enum stability", () => {
  // Les enums sont particulièrement fragiles : ajouter/renommer une valeur
  // casse tous les clients. On les fige explicitement ici.
  it("appointment.status contient exactement 7 valeurs (aligné DB enum appointment_status, F6)", () => {
    const values = appointmentSchema.shape.status.options;
    expect(values).toEqual([
      "pending",
      "confirmed",
      "en_route",
      "in_progress",
      "completed",
      "no_show",
      "cancelled",
    ]);
  });

  it("payment.status contient exactement 5 valeurs", () => {
    const values = paymentSchema.shape.status.options;
    expect(values).toEqual(["pending", "paid", "failed", "refunded", "canceled"]);
  });

  it("quote.status contient exactement 5 valeurs", () => {
    const values = quoteSchema.shape.status.options;
    expect(values).toEqual(["draft", "sent", "accepted", "declined", "expired"]);
  });

  it("search.type contient exactement 2 valeurs", () => {
    const values = searchResultSchema.shape.type.options;
    expect(values).toEqual(["business", "blog"]);
  });
});
