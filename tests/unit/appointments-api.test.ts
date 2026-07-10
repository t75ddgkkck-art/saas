/**
 * Test contract : schémas Zod des routes /api/appointments (Lot 20).
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const StatusEnum = z.enum(["pending", "confirmed", "cancelled", "completed"]);

const CreateSchema = z.object({
  clientId: z.string().uuid().optional(),
  client: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      phone: z.string().min(4).max(20),
      email: z.string().email().max(255).optional(),
    })
    .optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: StatusEnum.default("confirmed"),
});

const UpdateSchema = z.object({
  status: StatusEnum.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
});

describe("appointments API — schémas Zod (Lot 20)", () => {
  it("accepte une création complète avec client à la volée", () => {
    const r = CreateSchema.safeParse({
      title: "Réparation fuite",
      date: "2026-08-15",
      startTime: "09:00",
      endTime: "10:00",
      client: { firstName: "A", lastName: "B", phone: "0612345678" },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("confirmed");
  });

  it("accepte avec clientId UUID existant", () => {
    const r = CreateSchema.safeParse({
      title: "Test",
      date: "2026-08-15",
      startTime: "10:00",
      endTime: "11:00",
      clientId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  it("rejette une date au mauvais format", () => {
    const r = CreateSchema.safeParse({
      title: "T",
      date: "15/08/2026",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(r.success).toBe(false);
  });

  it("rejette startTime malformé", () => {
    const r = CreateSchema.safeParse({
      title: "T",
      date: "2026-08-15",
      startTime: "9h",
      endTime: "10:00",
    });
    expect(r.success).toBe(false);
  });

  it("rejette un clientId non-UUID (anti-IDOR côté schéma)", () => {
    const r = CreateSchema.safeParse({
      title: "T",
      date: "2026-08-15",
      startTime: "09:00",
      endTime: "10:00",
      clientId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("rejette title vide", () => {
    const r = CreateSchema.safeParse({
      title: "",
      date: "2026-08-15",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(r.success).toBe(false);
  });

  it("UpdateSchema accepte un patch partiel (status seul)", () => {
    const r = UpdateSchema.safeParse({ status: "completed" });
    expect(r.success).toBe(true);
  });

  it("UpdateSchema rejette un status inconnu", () => {
    const r = UpdateSchema.safeParse({ status: "hacked" });
    expect(r.success).toBe(false);
  });

  it("UpdateSchema accepte description = null (retrait de valeur)", () => {
    const r = UpdateSchema.safeParse({ description: null });
    expect(r.success).toBe(true);
  });
});
