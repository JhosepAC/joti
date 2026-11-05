import {
  LogOut,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

const icons: Readonly<Partial<Record<string, LucideIcon>>> = {
  profile: UserRound,
  security: ShieldCheck,
  preferences: SlidersHorizontal,
  danger: TriangleAlert,
  close: X,
  settings: Settings,
  logout: LogOut,
};

export function AccountGlyph({ name }: { name: string }) {
  const Icon = Object.hasOwn(icons, name) ? icons[name]! : UserRound;
  return <Icon size={20} strokeWidth={1.7} aria-hidden="true" />;
}
