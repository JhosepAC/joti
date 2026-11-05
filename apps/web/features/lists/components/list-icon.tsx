import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  CaseSensitive,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleChevronDown,
  Copy,
  DollarSign,
  Ellipsis,
  GripVertical,
  Hash,
  Heart,
  Link,
  Mail,
  Pencil,
  Percent,
  Phone,
  Pin,
  Plane,
  Plus,
  ShoppingBasket,
  SquareCheck,
  Star,
  Table2,
  Tag,
  Undo2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const LIST_ICONS = [
  "table",
  "check",
  "basket",
  "plane",
  "book",
  "briefcase",
  "heart",
  "bolt",
  "pin",
  "tag",
];
const glyphs = {
  close: X,
  more: Ellipsis,
  plus: Plus,
  grip: GripVertical,
  up: ChevronUp,
  down: ChevronDown,
  right: ChevronRight,
  open: ArrowUpRight,
  undo: Undo2,
  tick: Check,
  star: Star,
  copy: Copy,
  edit: Pencil,
  calendar: CalendarDays,
  mail: Mail,
  phone: Phone,
};
const listIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  table: Table2,
  check: SquareCheck,
  basket: ShoppingBasket,
  plane: Plane,
  book: BookOpen,
  briefcase: Briefcase,
  heart: Heart,
  bolt: Zap,
  pin: Pin,
  tag: Tag,
};
const propertyIcons: Readonly<Partial<Record<string, LucideIcon>>> = {
  checkbox: SquareCheck,
  date: CalendarDays,
  number: Hash,
  currency: DollarSign,
  percent: Percent,
  rating: Star,
  select: CircleChevronDown,
  status: CircleChevronDown,
  multiSelect: CircleChevronDown,
  email: Mail,
  phone: Phone,
  url: Link,
};

export function ListGlyph({ name }: { name: keyof typeof glyphs }) {
  const Icon = glyphs[name];
  return <Icon size="1em" strokeWidth={1.7} aria-hidden="true" />;
}

export function ListIcon({ name = "table" }: { name?: string }) {
  const Icon = Object.hasOwn(listIcons, name) ? listIcons[name] : undefined;
  return Icon ? (
    <Icon size="1em" strokeWidth={1.7} aria-hidden="true" />
  ) : (
    <span className="lists-custom-icon" aria-hidden="true">
      {name}
    </span>
  );
}

export function PropertyIcon({ type }: { type: string }) {
  const Icon =
    (Object.hasOwn(propertyIcons, type) && propertyIcons[type]) ||
    CaseSensitive;
  return (
    <span className="lists-property-icon" aria-hidden="true">
      <Icon size="1em" strokeWidth={1.7} />
    </span>
  );
}
