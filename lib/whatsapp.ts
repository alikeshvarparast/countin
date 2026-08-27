export type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean };

export function whatsappEnabled() {
  return process.env.WHATSAPP_ENABLED === "true";
}

/** Stub for Meta Cloud API. Wired into notify() so a later adapter does not need a second system. */
export async function sendWhatsAppMessage(
  _phone: string,
  _text: string,
): Promise<WhatsAppSendResult> {
  if (!whatsappEnabled()) {
    return { ok: false, error: "WhatsApp is not enabled yet.", retryable: false };
  }
  return {
    ok: false,
    error: "WhatsApp adapter is not implemented yet.",
    retryable: false,
  };
}
