import { ConvexError } from "convex/values";
import {
  SPACE_ICON_SET,
  SPACE_NAME_CONTROL_CHARS_REGEX,
  SPACE_NAME_MAX_LENGTH,
  SPACE_NAME_MIN_LENGTH,
  SPACE_PURPOSE_SET,
  SPACE_SLUG_FALLBACK,
  SPACE_SLUG_MAX_LENGTH,
  SPACE_SLUG_REGEX,
  type SpaceIcon,
  type SpacePurpose,
} from "./constants";

// ---------------------------------------------------------------------------
// Space input validation.
//
// Runs in the V8 isolate (no `node:*`), and is called both by the action layer
// (to fail fast with a good message) and again inside the mutation (which is the
// authoritative check, because it is the one that runs atomically with the
// insert).
// ---------------------------------------------------------------------------

function fail(message: string, code = "VALIDATION_ERROR"): never {
  throw new ConvexError({ code, message });
}

// ---------------------------------------------------------------------------
// Name — 3-50 characters after trimming, no control characters.
// ---------------------------------------------------------------------------

export function validateSpaceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) fail("Space name is required.");
  if (trimmed.length < SPACE_NAME_MIN_LENGTH) {
    fail(`Space name must be at least ${SPACE_NAME_MIN_LENGTH} characters.`);
  }
  if (trimmed.length > SPACE_NAME_MAX_LENGTH) {
    fail(`Space name must not exceed ${SPACE_NAME_MAX_LENGTH} characters.`);
  }
  if (SPACE_NAME_CONTROL_CHARS_REGEX.test(trimmed)) {
    fail("Space name must not contain control characters.");
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Icon — must be one of the nine the picker offers. An allowlist rather than an
// "is it emoji?" test: it keeps the database free of arbitrary codepoints and
// stops a caller from storing a string that renders as nothing.
// ---------------------------------------------------------------------------

export function validateSpaceIcon(icon: string): SpaceIcon {
  if (!SPACE_ICON_SET.has(icon))
    fail("Please choose one of the suggested icons.");
  return icon as SpaceIcon;
}

// ---------------------------------------------------------------------------
// Purpose — closed enumeration. It selects the template that will be applied, so
// an unknown value must never be stored.
// ---------------------------------------------------------------------------

export function validateSpacePurpose(purpose: string): SpacePurpose {
  if (!SPACE_PURPOSE_SET.has(purpose))
    fail("Please choose a purpose for this space.");
  return purpose as SpacePurpose;
}

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

/**
 * Turns a space name into a URL-safe slug stem: diacritics folded, everything
 * that is not `a-z0-9` collapsed into a single dash.
 *
 * Returns the fallback when the name has no usable characters (for example
 * "???" or an all-CJK name), because an empty slug would produce the bare
 * `/w/` route.
 */
export function toSlugBase(name: string): string {
  const folded = name
    .normalize("NFD")
    // Strip the combining marks left behind by NFD.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SPACE_SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");

  return folded.length > 0 ? folded : SPACE_SLUG_FALLBACK;
}

/** Validates a slug that arrived from a client (the `/w/<slug>` route). */
export function validateSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > SPACE_SLUG_MAX_LENGTH + 4) {
    fail("Invalid space address.");
  }
  if (!SPACE_SLUG_REGEX.test(trimmed)) fail("Invalid space address.");
  return trimmed;
}

/** Empty uses the default palette; never allow CSS expressions or alpha colors. */
export function validateSpaceBackground(value: string): string {
  if (value !== "" && !/^#[a-fA-F0-9]{6}$/.test(value))
    fail("Choose a valid six-digit hex background color.");
  return value.toLowerCase();
}
