import { test, expect } from "@playwright/test";

test.describe("Fiscal complete flow", () => {
  test("login → dashboard → project", async ({ page }) => {
    // Login com credenciais de teste
    await page.goto("/login");
    await page.getByLabel("Email").fill("fiscal@test.duedilis.pt");
    await page.getByLabel("Password").fill("test-password-123");
    await page.getByRole("button", { name: /entrar/i }).click();

    // Navegar para dashboard
    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();

    // Verificar lista de projectos
    await page.goto("/projects");
    await expect(page.getByTestId("project-list")).toBeVisible();
  });

  test("criar issue (NC) → adicionar evidence", async ({ page }) => {
    // Abrir projecto
    await page.goto("/projects");
    await page.getByTestId("project-list").getByRole("link").first().click();

    // Criar Não Conformidade
    await page.getByRole("button", { name: /nova não conformidade/i }).click();
    await page.getByLabel("Título").fill("NC de teste E2E");
    await page
      .getByLabel("Descrição")
      .fill("Descrição da não conformidade de teste");
    await page.getByRole("button", { name: /criar/i }).click();

    // Upload foto como evidence
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "evidence.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-image-data"),
    });

    // Verificar issue criada com evidence
    await expect(page.getByText("NC de teste E2E")).toBeVisible();
    await expect(page.getByTestId("evidence-list")).toBeVisible();
  });

  test("upload documento CDE → normalização IA → confirmar", async ({
    page,
  }) => {
    // Navegar para CDE folder
    await page.goto("/cde");
    await page
      .getByRole("link", { name: /documentos/i })
      .first()
      .click();

    // Upload ficheiro PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "projeto-estrutural.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-data"),
    });

    // Aguardar normalização (status READY)
    await expect(page.getByTestId("normalization-status")).toHaveText("READY", {
      timeout: 30000,
    });

    // Confirmar nome ISO sugerido
    await page.getByRole("button", { name: /confirmar/i }).click();
    await expect(page.getByTestId("document-status")).toHaveText("CONFIRMED");
  });

  test("foto mobile → GPS metadata → associar a issue", async ({ page }) => {
    // Simular viewport mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/photos/upload");

    // Upload foto com GPS mock
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "foto-obra-gps.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("fake-image-with-gps-exif"),
    });

    // Associar a issue existente
    await page.getByLabel("Associar a Issue").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /guardar/i }).click();

    // Verificar metadata GPS preservada
    await expect(page.getByTestId("gps-metadata")).toBeVisible();
    await expect(page.getByTestId("gps-latitude")).not.toBeEmpty();
    await expect(page.getByTestId("gps-longitude")).not.toBeEmpty();
  });

  test("criar aprovação → aprovar documento", async ({ page }) => {
    // Submeter documento para aprovação
    await page.goto("/cde");
    await page.getByTestId("document-list").getByRole("link").first().click();
    await page
      .getByRole("button", { name: /submeter para aprovação/i })
      .click();
    await page.getByRole("button", { name: /confirmar/i }).click();
    await expect(page.getByTestId("approval-status")).toHaveText("PENDING");

    // Switch user (reviewer)
    await page.goto("/logout");
    await page.goto("/login");
    await page.getByLabel("Email").fill("reviewer@test.duedilis.pt");
    await page.getByLabel("Password").fill("reviewer-password-123");
    await page.getByRole("button", { name: /entrar/i }).click();

    // Aprovar documento
    await page.goto("/approvals");
    await page
      .getByTestId("pending-approvals")
      .getByRole("link")
      .first()
      .click();
    await page.getByRole("button", { name: /aprovar/i }).click();

    // Verificar status APPROVED
    await expect(page.getByTestId("approval-status")).toHaveText("APPROVED");
  });

  test("criar reunião → adicionar participantes → publicar ata", async ({
    page,
  }) => {
    // Criar meeting
    await page.goto("/meetings/new");
    await page.getByLabel("Título").fill("Reunião de obra semanal");
    await page.getByLabel("Data").fill("2026-04-15");
    await page.getByRole("button", { name: /criar/i }).click();

    // Adicionar participantes
    await page.getByRole("button", { name: /adicionar participante/i }).click();
    await page
      .getByLabel("Email participante")
      .fill("participante@test.duedilis.pt");
    await page.getByRole("button", { name: /adicionar/i }).click();
    await expect(page.getByTestId("participants-list")).toContainText(
      "participante@test.duedilis.pt",
    );

    // Escrever ata
    await page
      .getByLabel("Ata")
      .fill("Ata da reunião de obra semanal — decisões tomadas.");

    // Publicar → verificar email (mock)
    await page.getByRole("button", { name: /publicar/i }).click();
    await expect(page.getByTestId("meeting-status")).toHaveText("PUBLISHED");
    await expect(page.getByTestId("email-sent-indicator")).toBeVisible();
  });

  test("criar link probatório NC ↔ Foto ↔ Documento ↔ Reunião", async ({
    page,
  }) => {
    // Abrir issue
    await page.goto("/projects");
    await page.getByTestId("project-list").getByRole("link").first().click();
    await page.getByTestId("issue-list").getByRole("link").first().click();

    // Criar link para foto
    await page
      .getByRole("button", { name: /adicionar link probatório/i })
      .click();
    await page.getByLabel("Tipo").selectOption("PHOTO");
    await page
      .getByTestId("evidence-selector")
      .getByRole("option")
      .first()
      .click();
    await page.getByRole("button", { name: /confirmar link/i }).click();
    await expect(page.getByTestId("evidence-trail")).toContainText("PHOTO");

    // Criar link para documento
    await page
      .getByRole("button", { name: /adicionar link probatório/i })
      .click();
    await page.getByLabel("Tipo").selectOption("DOCUMENT");
    await page
      .getByTestId("evidence-selector")
      .getByRole("option")
      .first()
      .click();
    await page.getByRole("button", { name: /confirmar link/i }).click();
    await expect(page.getByTestId("evidence-trail")).toContainText("DOCUMENT");

    // Criar link para meeting
    await page
      .getByRole("button", { name: /adicionar link probatório/i })
      .click();
    await page.getByLabel("Tipo").selectOption("MEETING");
    await page
      .getByTestId("evidence-selector")
      .getByRole("option")
      .first()
      .click();
    await page.getByRole("button", { name: /confirmar link/i }).click();
    await expect(page.getByTestId("evidence-trail")).toContainText("MEETING");

    // Verificar trail imutável
    await expect(
      page.getByTestId("evidence-trail-immutable-badge"),
    ).toBeVisible();
    const trailItems = page.getByTestId("evidence-trail").getByRole("listitem");
    await expect(trailItems).toHaveCount(3);
  });
});
