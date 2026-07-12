import { test, expect } from "@playwright/test";

/**
 * Ürün mimarisinin "Ana Kullanıcı Akışları A-D" olarak tanımladığı çekirdek yol:
 * araç ekle -> müşteri ekle -> eşleştir -> teklif oluştur -> uyumluluk kontrol
 * listesi tamamlanınca PDF üretimi açılıyor mu. Sadece izole E2E Supabase
 * projesine karşı çalışır (bkz. playwright.config.ts + .env.test.local.example).
 */

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.beforeAll(() => {
  if (!email || !password) {
    throw new Error("E2E_TEST_EMAIL ve E2E_TEST_PASSWORD .env.test.local içinde tanımlı olmalı");
  }
});

test("vehicle -> lead -> match -> offer -> compliance -> PDF açılıyor", async ({ page }) => {
  const runId = Date.now();
  const brand = `E2EBrand${runId}`;
  const model = `E2EModel${runId}`;
  const company = `E2E Trader ${runId}`;

  // Giriş
  await page.goto("/login");
  await page.getByLabel("E-posta").fill(email!);
  await page.getByLabel("Şifre").fill(password!);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Araç ekle
  await page.goto("/vehicles/new");
  await page.getByLabel("Marka").fill(brand);
  await page.getByLabel("Model").fill(model);
  await page.getByLabel("Fiyat").fill("42000");
  await page.getByLabel("Araç tipi").selectOption("truck");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page).toHaveURL(/\/vehicles\/[0-9a-f-]+/);

  // Müşteri ekle
  await page.goto("/leads/new");
  await page.getByLabel("İsim / Şirket").fill(company);
  await page.getByLabel("Max bütçe").fill("60000");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]+/);
  const leadId = page.url().split("/leads/")[1];

  // Eşleştirme: az önce eklenen araç uygun adaylar arasında görünmeli
  await page.goto(`/matches?lead_id=${leadId}`);
  await expect(page.getByText(`${brand} ${model}`)).toBeVisible();
  await page.getByRole("button", { name: "Bu aracı seç" }).click();
  await expect(page).toHaveURL(/\/offers\/new\?/);

  // Teklif oluştur
  await expect(page.getByText(company)).toBeVisible();
  await page.getByRole("button", { name: "Teklif oluştur" }).click();
  await expect(page).toHaveURL(/\/offers\/[0-9a-f-]+$/);

  // PDF üretmeden önce kutular boşken buton pasif olmalı
  await expect(page.getByRole("button", { name: "PDF üret" })).toBeDisabled();

  // Uyumluluk kontrol listesini tamamla
  const checklistLabels = [
    "İhracat yasallığı kontrol edildi",
    "Yaptırım listesi kontrolü yapıldı",
    "Araç kategorisi izinli",
    "Belgeler kontrol edildi",
    "Gümrük partneri onaylandı",
    "Ödeme yöntemi üzerinde anlaşıldı",
    "Alıcı kimliği doğrulandı",
  ];
  for (const label of checklistLabels) {
    await page.getByLabel(label).check();
    await expect(page.getByLabel(label)).toBeChecked();
  }

  // Tüm kutular işaretlenince PDF linki aktifleşmeli
  await expect(page.getByRole("link", { name: "PDF üret" })).toBeVisible();

  const offerId = page.url().split("/offers/")[1];

  // Durum değiştirilebilmeli ve sayfa yenilendikten sonra kalıcı olmalı
  await page.getByLabel("Durum").selectOption("accepted");
  await page.getByRole("button", { name: "Güncelle" }).click();
  await expect(page.getByText("Durum: Kabul Edildi")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Durum")).toHaveValue("accepted");

  // Teklif silinebilmeli
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Teklifi sil" }).click();
  await expect(page).toHaveURL(/\/offers$/);

  const response = await page.goto(`/offers/${offerId}`);
  expect(response?.status()).toBe(404);
});
