import { LoginCredentials, OAuthProvider } from "../types/auth.types";

export interface IAuthService {
  loginWithCredentials(credentials: LoginCredentials): Promise<void>;
  loginWithOAuth(provider: OAuthProvider): Promise<void>;
}

export class AuthService implements IAuthService {
  async loginWithCredentials(credentials: LoginCredentials): Promise<void> {
    // Normalization per auth specification
    const payload = {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    };

    // Simulated / future endpoint call or Convex/Clerk integration
    console.log("[AuthService] Logging in with credentials:", payload.email);
    // Simulating async network call
    await new Promise((resolve) => setTimeout(resolve, 600));
  }

  async loginWithOAuth(provider: OAuthProvider): Promise<void> {
    console.log(`[AuthService] Initiating OAuth flow for: ${provider}`);
    // Simulating OAuth redirect
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

export const authService = new AuthService();
