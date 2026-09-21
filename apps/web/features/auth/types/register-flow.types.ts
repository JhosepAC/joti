export type RegisterStep = 1 | 1.1 | 2 | 3 | 4;

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

export const TOTAL_STEPS = 4;

export const RECOMMENDED_AVATARS = [
  "https://api.dicebear.com/9.x/initials/svg?seed=JD",
  "https://api.dicebear.com/9.x/initials/svg?seed=AB",
  "https://api.dicebear.com/9.x/bottts/svg?seed=alpha",
  "https://api.dicebear.com/9.x/bottts/svg?seed=beta",
  "https://api.dicebear.com/9.x/lorelei/svg?seed=gamma",
  "https://api.dicebear.com/9.x/avataaars/svg?seed=delta",
] as const;
