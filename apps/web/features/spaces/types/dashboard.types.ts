export interface SpacePage {
  id: string;
  icon?: string;
  title: string;
  body: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  isStarter: boolean;
  favorite?: boolean;
}
export interface DashboardSpace {
  slug: string;
  name: string;
  icon: string;
  purpose: string;
  modules?: string[];
  description?: string;
}
export interface DashboardData {
  space: DashboardSpace;
  spaces: DashboardSpace[];
  profile: {
    displayName: string;
    username: string;
    avatarUrl?: string | null;
    timezone?: string;
  };
  pages: SpacePage[];
  selectedPageId?: string;
}
