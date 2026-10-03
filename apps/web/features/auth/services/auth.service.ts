import { LoginCredentials, OAuthProvider, RegisterPayload } from "../types/auth.types";

/**
 * Abstraction over Convex auth actions.
 * Keeps UI decoupled from convex client details.
 * Uses dynamic import to avoid hard dependency at build time if Convex not configured.
 */
export interface IAuthService {
  loginWithCredentials(credentials: LoginCredentials): Promise<{ user: { _id: string; email: string }; profile: unknown }>;
  registerWithCredentials(payload: RegisterPayload): Promise<{ userId: string }>;
  loginWithOAuth(provider: OAuthProvider): Promise<void>;
}

type ConvexClient = {
  action: (ref: unknown, args: unknown) => Promise<unknown>;
};

let convexClient: ConvexClient | null = null;

export function setConvexClient(client: ConvexClient) {
  convexClient = client;
}

async function getConvexApi() {
  // Lazy import generated api — avoids circular build issues when codegen not yet run
  const mod = await import("@/convex/_generated/api");
  return mod.api as unknown as Record<string, Record<string, unknown>>;
}

export class AuthService implements IAuthService {
  async loginWithCredentials(credentials: LoginCredentials) {
    const payload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    };

    // If a Convex client was injected (e.g., via ConvexProvider), use it directly
    // otherwise fallback to fetch via Convex HTTP action URL — here we use client-side Convex hook pattern
    // The UI hook `useLogin` will call `useAction(api.auth.actions.login)` directly,
    // so this service is kept for non-hook contexts and as fallback.
    if (convexClient) {
      const api = await getConvexApi();
      const ref = (api as unknown as { auth: { actions: { login: unknown } } }).auth.actions.login;
      return (await convexClient.action(ref, payload)) as { user: { _id: string; email: string }; profile: unknown };
    }

    // Fallback: instruct caller to use useAction hook
    throw new Error(
      "Convex client not initialized. Use useAction(api.auth.actions.login) in components or call setConvexClient().",
    );
  }

  async registerWithCredentials(payload: RegisterPayload) {
    const normalized = {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      username: payload.username.trim().toLowerCase(),
      display_name: payload.displayName.trim(),
      bio: payload.bio?.trim(),
      avatar: payload.avatar?.trim(),
      locale: payload.locale ?? "system",
      timezone: payload.timezone ?? "system",
    };

    if (convexClient) {
      const api = await getConvexApi();
      const ref = (api as unknown as { auth: { actions: { register: unknown } } }).auth.actions.register;
      return (await convexClient.action(ref, normalized)) as { userId: string };
    }

    throw new Error(
      "Convex client not initialized. Use useAction(api.auth.actions.register) in components or call setConvexClient().",
    );
  }

  async loginWithOAuth(provider: OAuthProvider): Promise<void> {
    // OAuth redirect will be handled by a Convex httpAction / Next route
    // For now, redirect to Convex site URL oauth endpoint (to be implemented)
    if (typeof window !== "undefined") {
      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      if (siteUrl) {
        window.location.href = `${siteUrl}/oauth/${provider}/authorize`;
        return;
      }
    }
    console.log(`[AuthService] Initiating OAuth flow for: ${provider}`);
  }
}

export const authService = new AuthService();
