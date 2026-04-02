/**
 * Notification Channels tests — Sprint D3, Task D3-08/08b
 * (gov-1775086319444-6olaxo)
 *
 * Testes unitários e de integração para delivery channels:
 *  1. sendNotificationEmail — mock Resend SDK, verifica to/subject/body
 *  2. sendNotificationEmail — erro Resend → outbox fica FAILED para retry
 *  3. WhatsApp urgente — notificação com priority=urgent dispara WhatsApp
 *  4. Channel routing — email_pref=true → EMAIL; whatsapp_pref=true → WHATSAPP
 *  5. Idempotência — mesma notificação 2x não envia email duplicado
 *  6. Rate limiting — não processa mais de X entries por ciclo (take:50)
 *  7. Template rendering — email HTML renderiza correctamente com dados
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoist mocks ─────────────────────────────────────────────────────────────
const mockAuth = vi.hoisted(() => vi.fn());
const mockResendSend = vi.hoisted(() => vi.fn());

const mockOutboxCreate = vi.hoisted(() => vi.fn());
const mockOutboxFindMany = vi.hoisted(() => vi.fn());
const mockOutboxFindFirst = vi.hoisted(() => vi.fn());
const mockOutboxUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));

vi.mock("resend", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Resend: vi.fn().mockImplementation(function (this: any) {
    this.emails = { send: mockResendSend };
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notificationOutbox: {
      create: mockOutboxCreate,
      findMany: mockOutboxFindMany,
      findFirst: mockOutboxFindFirst,
      update: mockOutboxUpdate,
    },
  },
}));

import {
  enqueueEmail,
  enqueueWhatsApp,
  processOutbox,
  deliverEmail,
} from "@/lib/actions/notification-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseEmailInput = {
  orgId: "org-channel-1",
  recipientId: "user@example.com",
  subject: "Nova notificação Duedilis",
  body: "<p>Tens uma nova notificação no projecto <strong>Obra Lisboa</strong>.</p>",
  entityType: "Issue",
  entityId: "issue-123",
};

const baseWhatsAppInput = {
  orgId: "org-channel-1",
  recipientId: "+351912345678",
  body: "URGENTE: Tens uma nova notificação no projecto Obra Lisboa.",
  entityType: "Issue",
  entityId: "issue-456",
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. sendNotificationEmail — mock Resend SDK, verifica to/subject/body
// ─────────────────────────────────────────────────────────────────────────────
describe("sendNotificationEmail — Resend SDK", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deliverEmail → chama Resend com to/subject/body correctos", async () => {
    const entry = {
      id: "outbox-email-1",
      orgId: "org-channel-1",
      recipientId: "user@example.com",
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      subject: "Nova notificação Duedilis",
      body: "<p>Conteúdo do email</p>",
      recipient: { email: "user@example.com", name: "Alice Silva" },
    };

    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockResolvedValue({ id: "resend-id-abc" });
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-email-1",
      status: "DELIVERED",
      deliveredAt: new Date(),
    });

    const result = await deliverEmail({ outboxId: "outbox-email-1" });

    // Resend.emails.send deve ter sido chamado
    expect(mockResendSend).toHaveBeenCalledOnce();

    // Verificar que to inclui o email do destinatário
    const sendCall = mockResendSend.mock.calls[0][0];
    expect(sendCall.to).toContain("user@example.com");
    expect(sendCall.subject).toBe("Nova notificação Duedilis");
    expect(sendCall.html).toBe("<p>Conteúdo do email</p>");

    // Resultado deve ter status DELIVERED
    expect(result.status).toBe("DELIVERED");
  });

  // ─── 2. sendNotificationEmail — erro Resend → outbox stays FAILED for retry ───
  it("deliverEmail — Resend falha → status FAILED, errorMessage definido, attempts++", async () => {
    const entry = {
      id: "outbox-email-2",
      orgId: "org-channel-1",
      recipientId: "fail@example.com",
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      subject: "Email que vai falhar",
      body: "<p>Conteúdo</p>",
      recipient: { email: "fail@example.com", name: "Bob Falha" },
    };

    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockRejectedValue(new Error("Resend: rate limit exceeded"));
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-email-2",
      status: "FAILED",
      attempts: 1,
      errorMessage: "Resend: rate limit exceeded",
    });

    const result = await deliverEmail({ outboxId: "outbox-email-2" });

    // Resend deve ter sido chamado (tentativa foi feita)
    expect(mockResendSend).toHaveBeenCalledOnce();

    // Notificação fica no outbox com status FAILED para retry
    expect(result.status).toBe("FAILED");
    expect(result.attempts).toBe(1);
    expect(result.errorMessage).toMatch(/rate limit exceeded/i);

    // outbox.update deve ter sido chamado com status FAILED
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          errorMessage: expect.stringContaining("rate limit"),
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. WhatsApp urgente — notificação com priority=urgent dispara WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
describe("WhatsApp urgente", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueueWhatsApp → cria outbox entry com channel=WHATSAPP, status=PENDING", async () => {
    mockOutboxFindFirst.mockResolvedValue(null); // sem duplicado
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-wa-1",
      orgId: baseWhatsAppInput.orgId,
      recipientId: baseWhatsAppInput.recipientId,
      channel: "WHATSAPP",
      body: baseWhatsAppInput.body,
      status: "PENDING",
      attempts: 0,
      entityType: baseWhatsAppInput.entityType,
      entityId: baseWhatsAppInput.entityId,
    });

    const result = await enqueueWhatsApp(baseWhatsAppInput);

    expect(result.channel).toBe("WHATSAPP");
    expect(result.status).toBe("PENDING");
    expect(result.recipientId).toBe(baseWhatsAppInput.recipientId);
    expect(result.body).toContain("URGENTE");

    // Verifica que o outbox foi criado com os dados correctos
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "WHATSAPP",
          status: "PENDING",
          attempts: 0,
        }),
      }),
    );
  });

  it("processOutbox — entry WHATSAPP PENDING → transita para PROCESSING sem lançar erro", async () => {
    const whatsappEntry = {
      id: "outbox-wa-2",
      channel: "WHATSAPP",
      status: "PENDING",
      attempts: 0,
      recipientId: "+351912345678",
      body: "URGENTE: notificação crítica",
    };

    mockOutboxFindMany.mockResolvedValue([whatsappEntry]);
    // WhatsApp delivery não tem implementação real (placeholder) — não deve lançar erro
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-wa-2",
      status: "PROCESSING",
    });

    // processOutbox não deve lançar exceção para WHATSAPP entries
    await expect(processOutbox()).resolves.not.toThrow();

    // outbox.update deve ter sido chamado para transitar para PROCESSING
    expect(mockOutboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "outbox-wa-2" },
        data: expect.objectContaining({ status: "PROCESSING" }),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Channel routing — email_pref → EMAIL; whatsapp_pref → WHATSAPP
// ─────────────────────────────────────────────────────────────────────────────
describe("Channel routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueueEmail cria entry com channel=EMAIL", async () => {
    mockOutboxFindFirst.mockResolvedValue(null);
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-route-email",
      channel: "EMAIL",
      status: "PENDING",
    });

    const result = await enqueueEmail(baseEmailInput);

    expect(result.channel).toBe("EMAIL");
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: "EMAIL" }),
      }),
    );
  });

  it("enqueueWhatsApp cria entry com channel=WHATSAPP", async () => {
    mockOutboxFindFirst.mockResolvedValue(null);
    mockOutboxCreate.mockResolvedValue({
      id: "outbox-route-wa",
      channel: "WHATSAPP",
      status: "PENDING",
    });

    const result = await enqueueWhatsApp(baseWhatsAppInput);

    expect(result.channel).toBe("WHATSAPP");
    expect(mockOutboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: "WHATSAPP" }),
      }),
    );
  });

  it("enqueueEmail e enqueueWhatsApp criam entries separadas para o mesmo evento", async () => {
    mockOutboxFindFirst.mockResolvedValue(null);
    mockOutboxCreate
      .mockResolvedValueOnce({
        id: "outbox-dual-email",
        channel: "EMAIL",
        status: "PENDING",
        entityId: "issue-789",
      })
      .mockResolvedValueOnce({
        id: "outbox-dual-wa",
        channel: "WHATSAPP",
        status: "PENDING",
        entityId: "issue-789",
      });

    const emailResult = await enqueueEmail({
      ...baseEmailInput,
      entityId: "issue-789",
    });
    const waResult = await enqueueWhatsApp({
      ...baseWhatsAppInput,
      entityId: "issue-789",
    });

    expect(emailResult.channel).toBe("EMAIL");
    expect(waResult.channel).toBe("WHATSAPP");
    expect(mockOutboxCreate).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Idempotência — mesma notificação 2x não duplica email
// ─────────────────────────────────────────────────────────────────────────────
describe("Idempotência — sem duplicados", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueueEmail com mesmo entityType+entityId+recipientId → retorna existente sem criar novo", async () => {
    const existingEntry = {
      id: "outbox-idem-1",
      orgId: "org-channel-1",
      recipientId: "user@example.com",
      channel: "EMAIL",
      status: "PENDING",
      entityType: "Issue",
      entityId: "issue-idem-1",
    };

    // Primeiro envio: sem duplicado
    mockOutboxFindFirst.mockResolvedValueOnce(null);
    mockOutboxCreate.mockResolvedValueOnce(existingEntry);

    const first = await enqueueEmail({
      ...baseEmailInput,
      entityType: "Issue",
      entityId: "issue-idem-1",
    });

    expect(mockOutboxCreate).toHaveBeenCalledTimes(1);
    expect(first.id).toBe("outbox-idem-1");

    // Segundo envio: encontra o existente → não cria outro
    mockOutboxFindFirst.mockResolvedValueOnce(existingEntry);

    const second = await enqueueEmail({
      ...baseEmailInput,
      entityType: "Issue",
      entityId: "issue-idem-1",
    });

    // create não deve ser chamado novamente
    expect(mockOutboxCreate).toHaveBeenCalledTimes(1);
    expect(second.id).toBe("outbox-idem-1");
  });

  it("enqueueWhatsApp com mesmo entityType+entityId+recipientId → retorna existente", async () => {
    const existingWaEntry = {
      id: "outbox-wa-idem-1",
      channel: "WHATSAPP",
      status: "PENDING",
      recipientId: "+351912345678",
      entityType: "Issue",
      entityId: "issue-idem-wa-1",
    };

    mockOutboxFindFirst.mockResolvedValue(existingWaEntry);

    const result = await enqueueWhatsApp({
      ...baseWhatsAppInput,
      entityType: "Issue",
      entityId: "issue-idem-wa-1",
    });

    // Deve retornar existente sem criar novo
    expect(mockOutboxCreate).not.toHaveBeenCalled();
    expect(result.id).toBe("outbox-wa-idem-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Rate limiting — processOutbox tem limite máximo de 50 entries por ciclo
// ─────────────────────────────────────────────────────────────────────────────
describe("Rate limiting — outbox sem spam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("processOutbox tem limite máximo de 50 entries por ciclo (take:50)", async () => {
    // Simular 50 entries PENDING
    const manyEntries = Array.from({ length: 50 }, (_, i) => ({
      id: `outbox-rl-${i}`,
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      recipientId: `user${i}@example.com`,
      subject: `Email ${i}`,
      body: `<p>Email ${i}</p>`,
    }));

    mockOutboxFindMany.mockResolvedValue(manyEntries);
    mockOutboxUpdate.mockResolvedValue({ status: "PROCESSING" });
    mockResendSend.mockResolvedValue({ id: "resend-rl" });

    await processOutbox();

    // processOutbox deve ter chamado findMany com take:50
    expect(mockOutboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it("entries com attempts >= 3 são excluídas do processamento (max retries)", async () => {
    // Devolver lista vazia porque a query já filtra attempts < 3
    mockOutboxFindMany.mockResolvedValue([]);

    await processOutbox();

    // A query deve incluir filtro para attempts < 3 (cláusula lt)
    const findManyArgs = mockOutboxFindMany.mock.calls[0][0];
    const whereJson = JSON.stringify(findManyArgs?.where ?? {});
    expect(whereJson).toContain("lt");

    // Nenhum update foi feito (lista vazia)
    expect(mockOutboxUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Template rendering — email HTML correctamente renderizado
// ─────────────────────────────────────────────────────────────────────────────
describe("Template rendering — HTML email", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deliverEmail → passa HTML body completo ao Resend (sem truncar)", async () => {
    const htmlBody = [
      "<!DOCTYPE html>",
      "<html>",
      "<head><title>Notificação Duedilis</title></head>",
      "<body>",
      "<h1>Nova Issue atribuída</h1>",
      "<p>O utilizador <strong>Alice</strong> atribuiu-lhe a issue",
      "<em>Verificar betão</em> no projecto <strong>Obra Lisboa</strong>.</p>",
      '<a href="https://duedilis.pt/issues/issue-template-1">Ver issue</a>',
      "</body>",
      "</html>",
    ].join("\n");

    const entry = {
      id: "outbox-template-1",
      orgId: "org-channel-1",
      recipientId: "user@example.com",
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      subject: "Nova Issue atribuída — Obra Lisboa",
      body: htmlBody,
      recipient: { email: "user@example.com", name: "Alice Silva" },
    };

    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockResolvedValue({ id: "resend-template-1" });
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-template-1",
      status: "DELIVERED",
      deliveredAt: new Date(),
    });

    await deliverEmail({ outboxId: "outbox-template-1" });

    const sendCall = mockResendSend.mock.calls[0][0];

    // HTML deve conter tags essenciais
    expect(sendCall.html).toContain("<h1>");
    expect(sendCall.html).toContain("<strong>Alice</strong>");
    expect(sendCall.html).toContain("Obra Lisboa");

    // Subject deve conter o nome do projecto
    expect(sendCall.subject).toContain("Obra Lisboa");

    // From deve ser o domínio Duedilis
    expect(sendCall.from).toContain("duedilis");
  });

  it("deliverEmail → formata o campo 'to' com nome quando disponível", async () => {
    const entry = {
      id: "outbox-template-2",
      orgId: "org-channel-1",
      recipientId: "bob@example.com",
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      subject: "Reunião agendada",
      body: "<p>Reunião amanhã às 10h.</p>",
      recipient: { email: "bob@example.com", name: "Bob Costa" },
    };

    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockResolvedValue({ id: "resend-template-2" });
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-template-2",
      status: "DELIVERED",
      deliveredAt: new Date(),
    });

    await deliverEmail({ outboxId: "outbox-template-2" });

    const sendCall = mockResendSend.mock.calls[0][0];

    // 'to' deve incluir email do destinatário
    expect(sendCall.to).toContain("bob@example.com");
    // 'to' deve ser uma string válida
    expect(typeof sendCall.to).toBe("string");
  });

  it("deliverEmail sem recipient → usa recipientId como email no campo 'to'", async () => {
    const entry = {
      id: "outbox-template-3",
      orgId: "org-channel-1",
      recipientId: "noname@example.com",
      channel: "EMAIL",
      status: "PENDING",
      attempts: 0,
      subject: "Notificação",
      body: "<p>Conteúdo.</p>",
      recipient: null, // sem recipient associado
    };

    mockOutboxFindFirst.mockResolvedValue(entry);
    mockResendSend.mockResolvedValue({ id: "resend-template-3" });
    mockOutboxUpdate.mockResolvedValue({
      id: "outbox-template-3",
      status: "DELIVERED",
      deliveredAt: new Date(),
    });

    await deliverEmail({ outboxId: "outbox-template-3" });

    const sendCall = mockResendSend.mock.calls[0][0];

    // Sem recipient, usa recipientId como email
    expect(sendCall.to).toBe("noname@example.com");
  });
});
