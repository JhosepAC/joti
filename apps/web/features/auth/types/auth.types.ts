export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
  bio?: string;
  avatar?: string;
  locale?: string;
  timezone?: string;
}

export interface ValidationErrors {
  email?: string;
  password?: string;
  username?: string;
  displayName?: string;
  bio?: string;
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
  bio?: string;
  locale?: string;
  timezone?: string;
}

export interface AuthResult {
  user: { _id: string; email: string };
  profile: UserProfile | null;
}
