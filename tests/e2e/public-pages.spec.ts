import { test, expect } from "@playwright/test";

test.describe("Pages publiques", () => {
  test("devrait afficher une page ville", async ({ page }) => {
    await page.goto("/ville/paris");
    await expect(page.locator("text=Artisans à Paris")).toBeVisible();
  });

  test("devrait afficher une page métier", async ({ page }) => {
    await page.goto("/metier/plombier");
    await expect(page.locator("text=Plombiers")).toBeVisible();
  });

  test("devrait afficher le sitemap", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("urlset");
  });

  test("devrait afficher robots.txt", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);
    const content = await page.content();
    expect(content).toContain("User-agent");
  });
});
