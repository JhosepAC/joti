// Localized transactional email copy.
//
// Server-side counterpart to the frontend dictionaries: backend contracts
// (codes, shapes) stay in English, but anything a user reads is rendered in
// their locale. The locale arrives as an explicit argument from the client
// (there is no session to read it from); unknown or missing values fall back
// to Spanish, matching the app fallback.

export type EmailLocale = "es" | "en";

export function resolveEmailLocale(raw: unknown): EmailLocale {
  return raw === "en" ? "en" : "es";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface VerificationCopy {
  subject: string;
  htmlBody: (code: string) => string;
  textBody: (code: string) => string;
}

interface LinkCopy {
  subject: string;
  htmlBody: (to: string, link: string) => string;
  textBody: (to: string, link: string) => string;
}

interface SimpleCopy {
  subject: string;
  htmlBody: (to: string) => string;
  textBody: (to: string) => string;
}

const verification: Record<EmailLocale, VerificationCopy> = {
  es: {
    subject: "Tu código de verificación de Nook",
    htmlBody: (code) => {
      const safe = escapeHtml(code);
      return (
        `<p>Tu código de verificación es <strong>${safe}</strong>. Vence en 10 minutos.</p>` +
        `<p>Si no lo pediste, puedes ignorar este correo.</p>`
      );
    },
    textBody: (code) =>
      `Tu código de verificación de Nook es ${code}. Vence en 10 minutos.`,
  },
  en: {
    subject: "Your Nook verification code",
    htmlBody: (code) => {
      const safe = escapeHtml(code);
      return (
        `<p>Your verification code is <strong>${safe}</strong>. It expires in 10 minutes.</p>` +
        `<p>If you did not request this, you can ignore this email.</p>`
      );
    },
    textBody: (code) =>
      `Your Nook verification code is ${code}. It expires in 10 minutes.`,
  },
};

const passwordReset: Record<EmailLocale, LinkCopy> = {
  es: {
    subject: "Restablece tu contraseña de Nook",
    htmlBody: (to, link) => {
      const safeTo = escapeHtml(to);
      const safeLink = escapeHtml(link);
      return (
        `<p>Pediste restablecer tu contraseña de <strong>${safeTo}</strong>.</p>` +
        `<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;">Restablecer contraseña</a></p>` +
        `<p>Este enlace vence en 60 minutos y solo puede usarse una vez. Si no lo pediste, ignora este correo.</p>` +
        `<p style="color:#666;font-size:12px;word-break:break-all;">O copia: ${safeLink}</p>`
      );
    },
    textBody: (to, link) =>
      `Restablece tu contraseña de Nook (vence en 60 minutos): ${link}`,
  },
  en: {
    subject: "Reset your Nook password",
    htmlBody: (to, link) => {
      const safeTo = escapeHtml(to);
      const safeLink = escapeHtml(link);
      return (
        `<p>You requested to reset your password for <strong>${safeTo}</strong>.</p>` +
        `<p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;border-radius:999px;text-decoration:none;">Reset your password</a></p>` +
        `<p>This link expires in 60 minutes and can only be used once. If you did not request this, ignore this email.</p>` +
        `<p style="color:#666;font-size:12px;word-break:break-all;">Or copy: ${safeLink}</p>`
      );
    },
    textBody: (to, link) =>
      `Reset your Nook password (expires in 60 minutes): ${link}`,
  },
};

const passwordChanged: Record<EmailLocale, SimpleCopy> = {
  es: {
    subject: "Tu contraseña de Nook cambió",
    htmlBody: () =>
      `<p>Tu contraseña se cambió correctamente.</p>
       <p>Si no fuiste tú, restablécela de inmediato y contacta soporte.</p>`,
    textBody: () =>
      `Tu contraseña de Nook cambió. Si no fuiste tú, restablécela de inmediato.`,
  },
  en: {
    subject: "Your Nook password was changed",
    htmlBody: () =>
      `<p>Your password was successfully changed.</p>
       <p>If you did not make this change, reset your password immediately and contact support.</p>`,
    textBody: () =>
      `Your Nook password was changed. If this was not you, reset it immediately.`,
  },
};

const oauthOnlyNotice: Record<EmailLocale, SimpleCopy> = {
  es: {
    subject: "Solicitud de restablecimiento de contraseña",
    htmlBody: () =>
      `<p>Pediste restablecer una contraseña, pero esta cuenta inicia sesión con Google.</p>
       <p>Continúa con Google en su lugar.</p>`,
    textBody: () =>
      `Esta cuenta inicia sesión con Google. Continúa con Google en su lugar.`,
  },
  en: {
    subject: "Password reset request",
    htmlBody: () =>
      `<p>You requested a password reset, but this account signs in with Google.</p>
       <p>Please continue with Google instead.</p>`,
    textBody: () =>
      `This account signs in with Google. Please continue with Google.`,
  },
};

export function verificationCopy(locale: EmailLocale): VerificationCopy {
  return verification[locale];
}

export function passwordResetCopy(locale: EmailLocale): LinkCopy {
  return passwordReset[locale];
}

export function passwordChangedCopy(locale: EmailLocale): SimpleCopy {
  return passwordChanged[locale];
}
