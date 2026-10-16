/** Client-safe helpers for sharing an invite link (no crypto imports here). */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
