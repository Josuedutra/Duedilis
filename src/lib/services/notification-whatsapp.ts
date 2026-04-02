/**
 * WhatsApp notification service — Sprint D3, Task D3-08/08b
 * (gov-1775077739600-6nyr2k)
 *
 * MVP: log only — no real WhatsApp integration.
 * Phase 2: integrate WhatsApp Business API (Twilio / 360dialog).
 *
 * Urgent types dispatched via WhatsApp:
 *  - NC CRITICA com prazo a expirar
 *  - Aprovação pendente >48h
 */

/**
 * Envia uma mensagem WhatsApp para o número indicado.
 *
 * MVP: apenas regista o envio via console e retorna sucesso.
 * TODO Phase 2: integrar com WhatsApp Business API (Twilio/360dialog).
 */
export async function sendWhatsAppNotification(input: {
  phone: string;
  message: string;
}): Promise<{ success: boolean }> {
  // MVP: log + mock delivery
  console.log(
    `[WhatsApp] Sending to ${input.phone}: ${input.message.slice(0, 80)}...`,
  );

  // TODO Phase 2: integrate with WhatsApp Business API
  // const twilio = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({ from: 'whatsapp:+14155238886', to: `whatsapp:${input.phone}`, body: input.message });

  return { success: true };
}
