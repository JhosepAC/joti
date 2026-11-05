import { Mark } from "@tiptap/react";

export const writingStyleOptions = {
  color: ["#202124", "#0b57d0", "#137333", "#b3261e"],
  backgroundColor: ["#fff3b0", "#d3e3fd", "#d7f0de", "#fbdde1"],
  fontFamily: [
    "Georgia, serif",
    "ui-monospace, monospace",
    "system-ui, sans-serif",
  ],
  fontSize: ["14px", "18px", "22px", "26px"],
} as const;

export type WritingStyle = keyof typeof writingStyleOptions;
const fields = Object.keys(writingStyleOptions) as WritingStyle[];
const propertyName = (key: WritingStyle) =>
  key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function safeStyle(key: WritingStyle, value: unknown) {
  return typeof value === "string" &&
    (writingStyleOptions[key] as readonly string[]).includes(value)
    ? value
    : null;
}

function css(attrs: Record<string, unknown>) {
  return fields
    .flatMap((key) => {
      const value = safeStyle(key, attrs[key]);
      const property = propertyName(key);
      return value ? [`${property}:${value}`] : [];
    })
    .join(";");
}

export const WritingStyleMark = Mark.create({
  name: "writingStyle",
  addAttributes() {
    return Object.fromEntries(
      fields.map((key) => [
        key,
        {
          default: null,
          rendered: false,
          parseHTML: (element: HTMLElement) => {
            const property = propertyName(key);
            const declaration = element
              .getAttribute("style")
              ?.split(";")
              .map((part) => part.trim())
              .find((part) => part.startsWith(`${property}:`));
            return safeStyle(
              key,
              declaration?.slice(property.length + 1).trim(),
            );
          },
        },
      ]),
    );
  },
  parseHTML() {
    return [{ tag: "span[data-writing-style]" }];
  },
  renderHTML({ mark }) {
    return ["span", { "data-writing-style": "", style: css(mark.attrs) }, 0];
  },
  renderMarkdown(node, helpers) {
    return `<span data-writing-style="" style="${css(node.attrs ?? {})}">${helpers.renderChildren(node)}</span>`;
  },
});
