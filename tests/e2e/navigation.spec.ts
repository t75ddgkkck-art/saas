import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("devrait afficher la page d'accueil", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Vitrix/);
  });

  test("devrait afficher la page À propos", async ({ page }) => {
    await page.goto("/a-propos");
    await expect(page).toHaveTitle(/À propos/);
  });

  test("devrait afficher l'annuaire", async ({ page }) => {
    await page.goto("/annuaire");
    await expect(page).toHaveTitle(/Annuaire/);
  });

  test("devrait afficher le blog", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveTitle(/Blog/);
  });

  test("devrait retourner 404 pour /demo", async ({ page }) => {
    const response = await page.goto("/demo");
    expect(response?.status()).toBe(404);
  });

  test("devrait naviguer vers la page de connexion", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Se connecter')");
    await expect(page).toHaveURL(/.*login/);
  });

  test("devrait naviguer vers la page d'inscription", async ({ page }) => {
    await page.goto("/");
    await page.click("button:has-text('Créer ma page')");
    await expect(page).toHaveURL(/.*register/);
  });
});
