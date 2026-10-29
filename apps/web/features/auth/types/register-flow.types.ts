export type RegisterStep = 1 | 1.1 | 2;

export interface RegisterFlowData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  displayName: string;
  avatarFile: File | null;
  avatarPreview: string | null;
  avatarUrl: string | null; // for recommended selection
  bio: string;
}

export interface RegisterFlowErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  code?: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  general?: string;
}

export const TOTAL_STEPS = 3;

export const RECOMMENDED_AVATARS = [
  "/avatars/profile_1.jpg",
  "/avatars/profile_2.jpg",
  "/avatars/profile_3.jpg",
  "/avatars/profile_4.jpg",
  "/avatars/profile_5.jpg",
  "/avatars/profile_6.jpg",
] as const;
