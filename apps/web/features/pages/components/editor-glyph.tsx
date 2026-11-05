import {
  CodeXml,
  Download,
  FileCode,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Link,
  List,
  ListOrdered,
  ListTodo,
  ListTree,
  Minus,
  Pilcrow,
  Plus,
  Printer,
  Quote,
  Redo2,
  Table2,
  Undo2,
  Upload,
  type LucideIcon,
} from "lucide-react";

const icons: Readonly<Partial<Record<string, LucideIcon>>> = {
  undo: Undo2,
  redo: Redo2,
  import: Download,
  export: Upload,
  print: Printer,
  insert: Plus,
  outline: ListTree,
  image: Image,
  link: Link,
  table: Table2,
  task: ListTodo,
  quote: Quote,
  divider: Minus,
  paragraph: Pilcrow,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  bullet: List,
  numbered: ListOrdered,
  markdown: FileCode,
  codeBlock: CodeXml,
};

export function EditorGlyph({ name }: { name: string }) {
  const Icon = Object.hasOwn(icons, name) ? icons[name]! : Heading;
  return <Icon size={18} strokeWidth={1.7} aria-hidden="true" />;
}
