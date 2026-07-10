import { describe, it, expect } from "vitest";
import {
  publicChatSystemPrompt,
  publicChatFallback,
  reviewReplySystemPrompt,
  blogArticleSystemPrompt,
  socialPostSystemPrompt,
  monthlyReportSystemPrompt,
} from "@/lib/ai/prompts";

const BIZ = {
  name: "Ambiance Plomberie",
  category: "plombier",
  city: "Rennes",
  phone: "0299000000",
  email: "contact@ambiance.fr",
  address: "10 rue de la Paix",
  postalCode: "35000",
  emergencyPhone: "0699000000",
  showEmergency: true,
};

describe("ai/prompts — publicChatSystemPrompt", () => {
  it("inclut le nom, la catégorie humaine et la ville", () => {
    const p = publicChatSystemPrompt(BIZ, "Service: Débouchage", "Lundi: 9h-18h");
    expect(p).toContain("Ambiance Plomberie");
    expect(p).toContain("plombier");
    expect(p).toContain("Rennes");
    expect(p).toContain("Débouchage");
  });

  it("inclut le téléphone urgence si activé", () => {
    const p = publicChatSystemPrompt(BIZ, "", "");
    expect(p).toContain("0699000000");
  });

  it("interdit d'inventer prix/services", () => {
    const p = publicChatSystemPrompt(BIZ, "", "");
    expect(p.toLowerCase()).toContain("jamais inventer");
  });
});

describe("ai/prompts — publicChatFallback (règles)", () => {
  const services = [{ name: "Débouchage", price: "80€" }];

  it("réserver → propose bouton RDV", () => {
    const r = publicChatFallback("je veux réserver", BIZ, services, "");
    expect(r.toLowerCase()).toContain("rendez-vous");
  });

  it("prix → liste des services", () => {
    const r = publicChatFallback("c'est combien ?", BIZ, services, "");
    expect(r).toContain("Débouchage");
    expect(r).toContain("80€");
  });

  it("urgence → téléphone d'urgence si activé", () => {
    const r = publicChatFallback("j'ai une fuite", BIZ, services, "");
    expect(r).toContain("0699000000");
  });

  it("horaire → texte hours", () => {
    const r = publicChatFallback("vous êtes ouvert ?", BIZ, services, "Lundi 9h-18h");
    expect(r).toContain("Lundi 9h-18h");
  });

  it("adresse", () => {
    const r = publicChatFallback("où êtes-vous ?", BIZ, services, "");
    expect(r).toContain("10 rue de la Paix");
    expect(r).toContain("Rennes");
  });

  it("hors sujet → réponse générique avec nom + métier", () => {
    const r = publicChatFallback("bonjour", BIZ, services, "");
    expect(r).toContain("Ambiance Plomberie");
    expect(r).toContain("plombier");
  });
});

describe("ai/prompts — autres prompts", () => {
  it("reviewReplySystemPrompt inclut le nom et la ville", () => {
    const p = reviewReplySystemPrompt(BIZ);
    expect(p).toContain("Ambiance Plomberie");
    expect(p).toContain("Rennes");
    expect(p).toContain("2-3 phrases");
  });

  it("blogArticleSystemPrompt inclut le topic et exige HTML simple", () => {
    const p = blogArticleSystemPrompt(BIZ, "5 signes rénovation");
    expect(p).toContain("5 signes rénovation");
    expect(p).toContain("<h2>");
    expect(p).toContain("400 mots");
  });

  it("socialPostSystemPrompt varie selon plateforme", () => {
    const insta = socialPostSystemPrompt(BIZ, "instagram");
    const fb = socialPostSystemPrompt(BIZ, "facebook");
    const li = socialPostSystemPrompt(BIZ, "linkedin");
    expect(insta.toLowerCase()).toContain("hashtag");
    expect(fb.toLowerCase()).toContain("chaleureux");
    expect(li.toLowerCase()).toContain("professionnel");
  });

  it("monthlyReportSystemPrompt a des règles claires", () => {
    const p = monthlyReportSystemPrompt();
    expect(p).toContain("5 points");
    expect(p).toContain("3 recommandations");
  });
});
