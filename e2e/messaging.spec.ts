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

test("staff sends a message → client sees it in /app/messages", async ({ page, request }) => {
  const EMAIL = "messaging.client@example.com";

  // ── 1. Register prospect ──────────────────────────────────────────────────
  const regRes = await request.post("/api/auth/register", {
    data: {
      fullName: "Messaging Client",
      email: EMAIL,
      phoneCountry: "+357",
      phoneNumber: "99222333",
      password: "oroTest!1",
    },
  });
  expect(regRes.ok(), `register: ${regRes.status()}`).toBeTruthy();

  // ── 2. Sign in as prospect and complete onboarding via API ────────────────
  await signIn(page, EMAIL, "oroTest!1");
  await page.waitForURL(/\/onboarding/, { timeout: 15000 });

  await page.request.post("/api/onboarding/services", { data: { services: ["company_formation"] } });
  await page.request.post("/api/onboarding/submit", {
    data: {
      services: ["company_formation"],
      fullLegalName: "Messaging Client",
      dateOfBirth: "1988-07-15",
      nationality: "Cyprus",
      residenceCountry: "Cyprus",
      address: "50 Message Lane, Limassol, 3000",
      businessDescription: "An e-commerce platform connecting artisan producers in the Mediterranean region with international buyers through a digital marketplace with integrated logistics solutions.",
      expectedTurnover: "50K-200K",
      timeline: "within_1_month",
      source: "social",
      proposedCompanyName: "MessageCo Ltd",
      shareholderCount: 1,
      nomineeServices: false,
      businessActivity: "E-Commerce",
    },
  });

  // ── 3. Sign in as staff, approve, clear compliance, convert ───────────────
  await signIn(page, "staff@oro.local", "oroDemo!1");
  await page.waitForURL(/\/admin/, { timeout: 15000 });

  await page.goto("/admin/submissions");
  await page.getByText("Messaging Client").first().click();
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

  // ── 4. Staff sends a message ──────────────────────────────────────────────
  await page.goto(`/admin/clients/${clientId}/messages`);
  await page.locator("textarea[placeholder='Address the client. Be precise.']").fill("Hello from ORO team — please check your documents.");
  await page.getByRole("button", { name: /^send/i }).click();
  // Wait for the message to appear in the thread
  await expect(page.getByText("Hello from ORO team — please check your documents.")).toBeVisible({ timeout: 10000 });

  // ── 5. Client signs in and sees the message ───────────────────────────────
  await signIn(page, EMAIL, "oroTest!1");
  await page.waitForURL(/\/app/, { timeout: 15000 });

  await page.goto("/app/messages");
  await expect(page.getByText("Hello from ORO team — please check your documents.")).toBeVisible({ timeout: 10000 });
});
