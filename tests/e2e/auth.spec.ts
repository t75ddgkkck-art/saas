import { test, expect } from "@playwright/test";

test.describe("Authentification", () => {
  test("devrait afficher la page de connexion", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Vitrix/);
    await expect(page.locator("button:has-text('Se connecter')")).toBeVisible();
  });

  test("devrait afficher la page d'inscription", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveTitle(/Vitrix/);
  });
});
