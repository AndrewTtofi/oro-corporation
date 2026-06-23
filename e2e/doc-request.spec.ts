import { test, expect } from "@playwright/test";
import { resetAndSeed } from "./_fixtures";

test.beforeEach(async ({ request }) => {
  await resetAndSeed(request);
});

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("input[name='email']").fill(email);
  await page.locator("input[name='password']").fill(password);
  await page.locator("form button[type='submit']").click();
}

test("staff requests a document → client sees it in /app/documents", async ({ page, request }) => {
  const EMAIL = "docrequest.client@example.com";

  // ── 1. Register prospect ──────────────────────────────────────────────────
  const regRes = await request.post("/api/auth/register", {
    data: {
      fullName: "DocRequest Client",
      email: EMAIL,
      phoneCountry: "+357",
      phoneNumber: "99333444",
      password: "oroTest!1",
    },
  });
  expect(regRes.ok(), `register: ${regRes.status()}`).toBeTruthy();

  // ── 2. Sign in as prospect and complete onboarding via API ────────────────
  await signIn(page, EMAIL, "oroTest!1");
  await page.waitForURL(/\/onboarding/, { timeout: 15000 });

  await page.request.post("/api/onboarding/services", { data: { services: ["accounting"] } });
  await page.request.post("/api/onboarding/submit", {
    data: {
      services: ["accounting"],
      fullLegalName: "DocRequest Client",
      dateOfBirth: "1975-11-20",
      nationality: "Cyprus",
      residenceCountry: "Cyprus",
      address: "25 Document Road, Paphos, 8000",
      businessDescription: "A professional services firm providing accounting, bookkeeping and tax advisory services to small and medium enterprises operating throughout Cyprus and the broader European Union area.",
      expectedTurnover: "200K-500K",
      timeline: "1_to_3_months",
      source: "referral",
      hasCyprusCompany: false,
      accountingSoftware: "QuickBooks",
      monthlyTxVolume: "100-500",
    },
  });

  // ── 3. Sign in as staff, approve, clear, convert ──────────────────────────
  await signIn(page, "staff@oro.local", "oroDemo!1");
  await page.waitForURL(/\/admin/, { timeout: 15000 });

  await page.goto("/admin/submissions");
  await page.getByText("DocRequest Client").first().click();
  await page.waitForURL(/\/admin\/submissions\/.+/, { timeout: 10000 });
  await page.getByRole("button", { name: /approve submission/i }).click();
  await page.waitForTimeout(1500);

  const clearRes = await request.post("/api/test/setup-client", { data: { email: EMAIL } });
  expect(clearRes.ok(), `clear: ${clearRes.status()}`).toBeTruthy();

  await page.goto("/admin/clients");
  await page.getByRole("button", { name: /convert from prospect/i }).click();
  await page.waitForSelector("text=Convert from Prospect", { timeout: 5000 });
  await page.getByRole("button", { name: /make client/i }).first().click();
  await page.waitForURL(/\/admin\/clients\/.+/, { timeout: 15000 });

  const clientId = page.url().split("/admin/clients/")[1];
  expect(clientId).toBeTruthy();

  // ── 4. Staff requests a document ─────────────────────────────────────────
  await page.goto(`/admin/clients/${clientId}/request-docs`);
  await page.locator("input[placeholder*='What document']").fill("Latest bank statement (last 3 months)");
  await page.getByRole("button", { name: /^send request$/i }).click();

  // Wait for the history section to show the new request
  await expect(page.getByText("Latest bank statement (last 3 months)")).toBeVisible({ timeout: 10000 });

  // ── 5. Client logs in and sees the request under "Requested by <firm>" ────
  await signIn(page, EMAIL, "oroTest!1");
  await page.waitForURL(/\/app/, { timeout: 15000 });

  await page.goto("/app/documents");

  // The RequestsBlock renders the brand-driven heading "Requested by <firm>"
  // (firm name comes from branding; neutral default when COMPANY_NAME unset).
  await expect(page.getByText(/requested by/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Latest bank statement (last 3 months)")).toBeVisible({ timeout: 10000 });
});
