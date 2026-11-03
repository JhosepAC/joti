---
name: Joti Light
description: Content-first authentication, inspired by Google and Notion.
colors:
  ink: "#202124"
  action: "#0b57d0"
  action-hover: "#0842a0"
  canvas: "#ffffff"
  surface: "#f8f9fa"
  muted: "#5f6368"
  border: "#dadce0"
  selection: "#d3e3fd"
  blue: "#4285f4"
  green: "#34a853"
  yellow: "#fbbc04"
  note-ink: "#b06000"
  calendar-ink: "#188038"
rounded:
  field: "5px"
  button: "24px"
  preview: "10px"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
  heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  mobile-heading:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
  secondary:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
---

# Joti Light

Scope: `/auth/*`, first-space onboarding, and `/w/[slug]`. The user explicitly requested removing generic AI styling and using a predominantly light Google/Notion direction. This replaces the lavender studio and elevated account-card treatment.

## Layout and hierarchy

One white canvas. Plain Joti wordmark and text language controls. The form is unboxed and left aligned, with no decorative icon above its heading. Desktop retains the interactive space example alongside the form; mobile places it below. Use spacing and typography to group information.

## Color and components

Use neutral gray for structure and dark text for content. Blue identifies the primary action and links. Green and amber distinguish calendar and notes. Contextual space dots use blue, green and yellow; do not recolor a whole page per category. Functional icons remain in the example navigation and tools. No lavender wash, dark rail, decorative orbit, floating message, rotated panel, gradient or resting shadow.

Inputs are white, outlined and lightly rounded. The primary button is a flat blue pill. The example uses quiet borders and tone steps. Text and controls must remain legible at 320px; secondary text is at least 12px.

## Interaction and accessibility

Keep existing authentication, accessible fields, errors, recovery, profile and sessions intact. Retain space switching, native task controls, local note editing and sample day selection. The tool indicator follows an interruptible critically damped spring; reduced motion settles directly. Example content is labeled and never writes to an account. Do not add social login.

## Design references

Google contributes light surfaces, clear blue actions and contextual tool color. Notion contributes neutral content hierarchy and quiet structure. Apple-design contributes immediate feedback and interruptible motion; translucency is not needed on this surface. Existing installed skills suffice; no additional dependency or asset is required.

## First space and workspace

Onboarding pairs three concise steps with a working preview of the chosen tools. Use vector symbols, native radio groups, direct review editing, brief directional transitions, and request-driven pending states. Persist the draft; respect reduced motion.

The workspace uses a neutral space rail beside a module sidebar and a white content sheet. Desktop columns are 76px, 248px, and the remaining width. Mobile navigation becomes one focus-contained drawer. Home exposes the real first page; Pages provides editable titles and text, search, creation and explicit saving. Introductory content is seeded once and remains user-editable. Never replace real pages with fake activity or vanity statistics. Use Inter explicitly on headings, body, and controls; gray labels are at least 13px.

## Lists

Lists extends the same frame with an editable title, user-selected icon, saved view tabs, and a dense ruled table. Neutral property headers, right-aligned tabular numbers, and pale semantic option colors carry the hierarchy. Keep one blue record-creation action. Do not insert dashboard metrics or invented records. Typed empty templates expose the real table structure.

Column/row grips provide direct rearrangement; resize edges preview width before saving. Keyboard and property-panel controls offer alternatives. Dialogs stay centered with a brief 160ms settle and native focus containment; reduced motion removes travel. Tables scroll horizontally instead of shrinking values into unreadable cells. Within Lists, navigation folds into a drawer at 1100px to preserve the working area. Explicit pending, disconnected, conflict, archive, and recovery states are part of the design.

Selection uses a centered 44px utility gutter with no property divider. Searchable comboboxes, selection menus, color swatches, and a Monday-first calendar share custom light surfaces, selected states, keyboard navigation, and anchored 150ms entrances. Keep OS select/date pickers out of Lists. Preserve values when selection options are retired; expose their restoration in the property editor. Footer calculations reserve room for the result even when their label truncates. Sidebar item menus consistently group favorite, duplicate/rename, and open-in-new-tab actions.

## Joti identity

The custom SVG mark combines a lowercase j, its blue point, and a folded-sheet terminal. Use `JotiLogo` for wordmarks and its compact variant in the space rail. The standalone `public/joti-mark.svg`, application SVG icons, and ICO fallbacks share the same geometry. Preserve the aspect ratio and surrounding whitespace; do not add gradients or an enclosing tile.
