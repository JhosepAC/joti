import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Ellipsis,
  Grid2X2,
  Grid3X3,
  Image,
  Images,
  Info,
  List,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";

const icons: Readonly<Partial<Record<string, LucideIcon>>> = {
  image: Image,
  grid: Grid2X2,
  masonry: Columns3,
  compact: Grid3X3,
  list: List,
  timeline: CalendarDays,
  upload: Upload,
  download: Download,
  album: Images,
  search: Search,
  tune: SlidersHorizontal,
  close: X,
  left: ChevronLeft,
  right: ChevronRight,
  plus: Plus,
  minus: Minus,
  trash: Trash2,
  check: Check,
  info: Info,
  more: Ellipsis,
  tag: Tag,
};

export function GalleryIcon({ name = "image" }: { name?: string }) {
  const Icon = Object.hasOwn(icons, name) ? icons[name]! : Image;
  return <Icon size={18} strokeWidth={1.7} aria-hidden="true" />;
}
