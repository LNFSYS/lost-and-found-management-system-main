export function normalizeVietnameseText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0111\u0110]/g, "d")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function maskPhone(text: string): string {
  // Matches Vietnamese & international phone patterns (10-11 digits, optional +84, dots, hyphens, spaces)
  return text
    .replace(/(?:\+84|84|0)(?:[-.\s]?\d){9,10}\b/g, (match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 12) return match;
      const prefix = digits.startsWith("84") ? `+84${digits.slice(2, 4)}` : digits.slice(0, 3);
      const suffix = digits.slice(-3);
      return `${prefix}***${suffix}`;
    })
    .replace(/\b\d{10,11}\b/g, (match) => {
      return `${match.slice(0, 3)}***${match.slice(-3)}`;
    });
}

export function maskEmail(text: string): string {
  return text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_match, user, domain) => {
    const visible = user.length <= 2 ? user[0] ?? "" : user.slice(0, 2);
    return `${visible}***@${domain}`;
  });
}

export function maskContactInfo(text: string | null | undefined): string | null {
  if (text == null) return null;
  if (typeof text !== "string") return text;
  return maskEmail(maskPhone(text));
}
