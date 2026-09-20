export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ValidationErrors {
  email?: string;
  password?: string;
  general?: string;
}

export type AuthStatus = "idle" | "loading" | "success" | "error";

export type OAuthProvider = "google";

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  avatar?: string;
}
