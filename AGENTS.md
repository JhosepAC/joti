# Repository Guidelines

## Project Structure & Module Organization

Joti is a TypeScript monorepo managed with pnpm workspaces and Turborepo.

- `apps/web/`: main Next.js App Router application. Routes live in `app/`; domain code lives in `features/auth/`, `features/spaces/`, and `features/lists/`.
- `apps/web/convex/`: active backend schema, auth, sessions, spaces, and realtime lists. Keep backend changes here rather than in the root `convex/` scaffold. Same-origin session and scoped list access bridges live in `apps/web/app/api/`.
- `apps/docs/`: separate Next.js documentation application.
- `packages/ui/`: shared React components; `packages/eslint-config/` and `packages/typescript-config/`: shared tooling.
- Each app's `public/` contains static assets; `messages/en.json` and `messages/es.json` contain translations. Auth tests live in `apps/web/tests/auth/`.

## Build, Test, and Development Commands

Use Node.js 24+ and the pinned `pnpm@11.25.0`. Run commands from the repository root:

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start both apps; web uses port 3002 and docs uses 3001.
- `pnpm --filter web dev`: start only the web app.
- `pnpm build`: build applications through Turbo.
- `pnpm lint`: run ESLint with zero warnings allowed.
- `pnpm check-types`: generate Next.js route types and check workspace TypeScript.
- `pnpm --filter web test`: run Vitest auth, workspace, and list regression tests.
- `pnpm dev:backend`: synchronize the active Convex backend during development.
- `node scripts/i18n-check.mjs`: check translation keys, placeholders, and rich-text tags.
- `pnpm format`: format TypeScript, TSX, and Markdown repository-wide; review the resulting diff.

## Coding Style & Naming Conventions

Follow existing TypeScript/React style: two-space indentation, double quotes, semicolons, and Prettier formatting. Use PascalCase for components, camelCase for functions, and kebab-case filenames such as `login-form.tsx` and `use-login.ts`. Keep domain logic within its feature directory. Use next-intl for UI copy and update both locales together. Regenerate Convex `_generated/` files instead of editing them manually.

## Testing Guidelines

Vitest uses Node and `convex-test` for an in-process backend. Name tests `*.test.ts`; discovery currently includes only `tests/auth/**/*.test.ts`. Keep tests outside `convex/`. Reuse `helpers.ts` and `setup.ts`, cover regressions and failure paths, and avoid live services. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Use Conventional Commits, for example `feat(web): add space preview`. Configured scopes are `repo`, `web`, `ui`, `convex`, `custom-backend`, and `docs`. The Husky pre-commit hook runs `pnpm check-types`. PRs should explain behavior changes, link relevant issues, report validation, and include screenshots for UI changes.

## Security & Configuration

Copy `apps/web/.env.example` to `apps/web/.env.local`; align app URLs with port 3002. Set server secrets on the Convex deployment too. Never commit credentials or expose secrets through `NEXT_PUBLIC_` variables.
