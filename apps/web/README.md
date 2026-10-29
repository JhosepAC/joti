# Aplicación web de Nook

Aplicación Next.js con React, Convex y traducciones en español e inglés.

El workspace de `/w/[slug]` presenta los espacios de la cuenta, los módulos Inicio/Páginas y un editor de texto. La primera visita crea una página de inicio una sola vez; los espacios en blanco reciben una página vacía. Crear y guardar páginas usa `/api/workspace`, que conserva el token de sesión en la cookie HttpOnly y comprueba propietario, vencimiento y revisión en Convex. Los borradores de cada página se recuperan desde `sessionStorage`; el botón Guardar conserva el contenido en la cuenta.

Desde la raíz del repositorio:

```sh
pnpm --filter web dev
pnpm --filter web test
pnpm --filter web check-types
pnpm --filter web lint
```

Desarrollo: http://localhost:3002. Configura `.env.local` a partir de `.env.example`; las variables privadas también deben existir en el backend de Convex. Desde esta carpeta, `pnpm exec convex dev` sincroniza el backend de desarrollo configurado.

Consulta [la guía de autenticación](../../docs/authentication.md), [el contexto del producto](../../docs/business_context.md) y [las instrucciones de contribución](../../AGENTS.md).
