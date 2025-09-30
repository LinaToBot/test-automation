import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test("MercadoLibre - PS5 Nuevos CDMX orden Mayor precio y listar 5", async ({
  page,
}, testInfo) => {
  // folder for per-run screenshots
  const shotsDir = path.join(testInfo.outputDir, "screens");
  fs.mkdirSync(shotsDir, { recursive: true });

  // helper to take a per-step screenshot
  async function shot(name: string) {
    await page.screenshot({
      path: path.join(shotsDir, `${name}.png`),
      fullPage: true,
    });
    await testInfo.attach(name, {
      path: path.join(shotsDir, `${name}.png`),
      contentType: "image/png",
    });
  }

  await test.step("'1) Open the site", async () => {
    await page.goto("/");
    await expect(page).toHaveURL(/mercadolibre\.com/);
    await shot("01-home");
  });

  await test.step("2) Select Mexico as country", async () => {
    // On the global landing page there are country cards; we look for "México".
    // We use getByRole for more stability. If already on .com.mx this step is skipped.
    if (
      page.url().includes("mercadolibre.com/") &&
      !page.url().includes(".com.mx")
    ) {
      // Button for text "México"
      const mexicoCard = page.getByRole("link", { name: /méxico/i }).first();
      if (await mexicoCard.isVisible()) {
        await mexicoCard.click();
      }
    }
    await expect(page).toHaveURL(/mercadolibre\.com\.mx/);
    await shot("02-mx-selected");
  });

  await test.step('3) Search for "playstation 5"', async () => {
    // Search input (varies frequently; various alternative uses)
    const searchBox = page
      .getByPlaceholder(/Buscar productos, marcas y más/i)
      .first()
      .or(page.locator('input[type="text"][aria-label*="Buscar"]').first())
      .or(page.locator('input[id="cb1-edit"]').first());

    await searchBox.click();
    await searchBox.fill("playstation 5");
    // Enter to search
    await searchBox.press("Enter");

    const cards = page.locator(".poly-card__content");
    await expect(cards.first()).toBeVisible({ timeout: 12_000 });
    await shot("03-results-ps5");
  });

  await test.step('4) Filter condition "New"', async () => {
    // Using flexible texts
    const nuevo = page.getByRole("link", { name: /nuevo|nuevos/i }).first();
    if (await nuevo.isVisible()) {
      await nuevo.click();
    } else {
      // Fallback: busca un checkbox/label
      const nuevoChk = page.getByLabel(/nuevo|nuevos/i).first();
      if (await nuevoChk.isVisible()) await nuevoChk.check();
    }

    const cards = page.locator(".poly-card__content");
    await expect(cards.first()).toBeVisible({ timeout: 12_000 });
    await shot("04-filter-new");
  });

  await test.step('5) Filter location "CDMX" or local', async () => {
    const cdmx = page.getByRole("link", { name: /local/i }).first();
    if (await cdmx.isVisible()) {
      await cdmx.click();
    } else {
      // Fallback: Find a checkbox/label
      const localChk = page.getByLabel(/local/i).first();
      if (await localChk.isVisible()) await localChk.check();
    }

    const cards = page.locator(".poly-card__content");
    await expect(cards.first()).toBeVisible({ timeout: 12_000 });
    await shot("05-filter-cdmx");
  });

  await test.step('6) Sort by "Mayor precio"', async () => {
    // 1) Click the "Más relevantes" button
    const sortBtn = page
      .getByRole("button", { name: /^Más relevantes$/i })
      .first();
    await expect(sortBtn).toBeVisible();
    await sortBtn.click();

    // 2) Wait for all menu options to be listed
    const allOptions = page.locator('li[role="option"]');
    await allOptions.allInnerTexts().catch(() => []);

    // 3) Click the "Highest price" option
    let target = page
      .locator('li[role="option"][data-key="price_desc"]')
      .first();

    // Fallback by text (covers “Mayor precio” / “Precio: mayor a menor”)
    if (!(await target.isVisible().catch(() => false))) {
      target = page
        .locator('li[role="option"]', {
          hasText: /Mayor precio|Precio:\s*mayor a menor/i,
        })
        .first();
    }

    await target.scrollIntoViewIfNeeded();
    await expect(target).toBeVisible({ timeout: 8000 });

    await target.click({ trial: true }); // dry run
    await target.click(); // real click

    // Confirmation: URL or button label changes
    await Promise.race([
      expect(page).toHaveURL(
        /price_desc|sort=price_desc|_OrderId_PRICE*DESC/i,
        { timeout: 8000 }
      ),
      expect(
        page
          .getByRole("button", {
            name: /Mayor precio|Precio:\s*mayor a menor/i,
          })
          .first()
      ).toBeVisible({ timeout: 8000 }),
    ]);

    await shot("06-sorted-mayor-precio");
  });

  await test.step("7)  Get name and price of the first 5 products", async () => {
    // 1) Select cards from list
    const cards = page.locator(".poly-card__content");
    await expect(cards.first()).toBeVisible({ timeout: 12_000 });

    const totalCards = await cards.count();
    const count = Math.min(totalCards, 5);
    const products: { name: string; price: string }[] = [];

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);

      // 2) Title in h3 (if sometimes h2, you can use 'h3, h2')
      const titleLoc = card.locator("h3").first();
      await expect(titleLoc).toBeVisible({ timeout: 8_000 });
      const name = (await titleLoc.innerText()).trim();

      // 3) Price
      // Price: prefer aria-label on .andes-money-amount[role="img"] (e.g. "30000 pesos mexicanos")
      const amount = card.locator('.andes-money-amount[role="img"]').first();
      let priceReadable = (await amount.getAttribute("aria-label")) ?? "";

      // If no aria-label, build it from fraction + cents
      if (!priceReadable) {
        const fraction = await card
          .locator(".andes-money-amount__fraction")
          .first()
          .textContent()
          .catch(() => null);
        const cents = await card
          .locator(".andes-money-amount__cents")
          .first()
          .textContent()
          .catch(() => null);
        if (fraction) {
          priceReadable = cents ? `${fraction}.${cents}` : `${fraction}`;
        }
      }

      // 4) Normalize to a readable format like "$30,000" (keep separators)
      let price = priceReadable.trim();
      if (!price) price = "N/D";
      // if the price comes like "30000 pesos mexicanos",  keep digits and separators
      price = price.replace(/[^0-9.,]/g, "").trim();
      if (price && !price.startsWith("$")) price = `$${price}`;

      products.push({ name, price });
    }

    // 5) Print to console
    console.log("================= TOP 5 PRODUCTOS =================");
    products.forEach((p, idx) =>
      console.log(`${idx + 1}. ${p.name} — ${p.price}`)
    );
    console.log("===================================================");

    // 6) Attach JSON as evidence
    const jsonPath = path.join(testInfo.outputDir, "top5.json");
    fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2), "utf-8");
    await testInfo.attach("top5.json", {
      path: jsonPath,
      contentType: "application/json",
    });

    expect(products.length).toBeGreaterThan(0);
    await shot("07-top5-captured");
  });
});
