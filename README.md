# Nook

Plataforma de organización personal y colaborativa por espacios. Cada espacio reúne sus propias herramientas y contenido.

## Desarrollo

Usa Node.js 24+ y pnpm 11.25.0.

```sh
pnpm install
pnpm dev
```

La aplicación web usa http://localhost:3002 y la documentación http://localhost:3001. Para ejecutar solo la aplicación: `pnpm --filter web dev`.

Copia `apps/web/.env.example` a `apps/web/.env.local` y configura tu despliegue de Convex. Las variables privadas de correo deben configurarse también en Convex. Para sincronizar el backend de desarrollo, ejecuta `pnpm dev:backend` desde la raíz y mantén una sola instancia activa. `convex.json` apunta a `apps/web/convex/` para que ejecutar la CLI desde la raíz tampoco publique el scaffold vacío.

## Estructura

- `apps/web/app/`: rutas Next.js y puente HTTP de sesiones.
- `apps/web/features/auth/`: acceso, registro, verificación, perfil y recuperación.
- `apps/web/features/spaces/`: creación y navegación de espacios.
- `apps/web/convex/`: esquema y funciones del backend activo.
- `apps/web/tests/auth/`: pruebas Vitest con convex-test.
- `apps/docs/`: aplicación de documentación.
- `packages/`: componentes y configuraciones compartidas.
- `docs/`: contexto del producto y notas técnicas.

## Validación

```sh
pnpm --filter web test
pnpm check-types
pnpm lint
node scripts/i18n-check.mjs
pnpm build
```

La autenticación utiliza correo y contraseña. Las sesiones se guardan en cookies HttpOnly; Google está deshabilitado. Consulta [docs/authentication.md](docs/authentication.md) para configuración, alcance y verificación manual, y [AGENTS.md](AGENTS.md) para contribuir.
