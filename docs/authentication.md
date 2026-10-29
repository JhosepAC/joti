# Autenticación de Nook

## Recorridos

- `/auth/login`: correo y contraseña; recupera una sesión existente y determina si faltan perfil o primer espacio. Las cuentas sin verificar pueden solicitar y confirmar un código.
- `/auth/register`: credenciales, código y perfil. Nombre visible y usuario son obligatorios; foto y biografía son opcionales. Las contraseñas solo permanecen en memoria y no se guardan antes de comprobar el correo.
- `/auth/forgot-password`: confirma la solicitud sin revelar si la dirección tiene cuenta. Permite reenviar después del período de espera y corregir el correo.
- `/auth/reset-password?token=…`: comprueba el enlace, distingue fallo de conexión de enlace inválido y permite reintentar. El token se elimina del historial al consumirse o invalidarse.
- `/auth/complete-profile`: recupera la autorización al recargar; sin ella ofrece iniciar sesión.
- `/`: lleva al acceso; una cookie válida permite volver al espacio sin introducir la contraseña.

Google no aparece en formularios, servicios cliente ni correos. Sus endpoints HTTP no están montados. Las tablas y funciones internas heredadas se conservan para no destruir datos; las cuentas antiguas sin contraseña pueden establecerla mediante recuperación por correo.

## Sesiones y autorización

`/api/auth/session` intercambia una prueba de cuenta por una cookie `nook-session`, HttpOnly, SameSite=Lax y Secure en producción. Dura siete días; el backend conserva únicamente su hash. Las mutaciones HTTP requieren el mismo origen, y las respuestas no se almacenan en caché. Se mantienen como máximo diez sesiones por cuenta.

Las funciones de Convex siguen comprobando grants de cuenta o espacio de 15 minutos, con rotación de un solo uso. La sesión puede emitir una prueba nueva desde el acceso. No equivale a configurar `ctx.auth` para futuras funciones: cualquier operación nueva debe comprobar su autorización explícitamente.

Al cerrar sesión se elimina la cookie y se revoca la sesión; si el backend falla, el navegador recibe igualmente la eliminación de cookie. Un fallo de red que impide contactar al servidor se muestra para reintentar. Cambiar la contraseña consume el enlace, actualiza credenciales y elimina sesiones y grants en una única transacción.

## Configuración

1. Copia `apps/web/.env.example` a `.env.local` en la misma carpeta. Usa la URL de tu Convex y `NEXT_PUBLIC_APP_URL=http://localhost:3002` en desarrollo.
2. Configura `EMAIL_CODE_PEPPER` (secreto aleatorio de al menos 32 caracteres), `RESEND_API_KEY` y un `RESEND_FROM` autorizado en el despliegue de Convex. Configura también allí `NEXT_PUBLIC_APP_URL` para los enlaces de correo. Usa los límites del plan gratuito; no se incorporan herramientas de pago.
3. Desde `apps/web`, ejecuta `pnpm exec convex dev` para sincronizar el esquema y las funciones con el backend de desarrollo. `convex codegen` genera tipos, sin activar el cambio en el despliegue.
4. En producción usa HTTPS. No guardes secretos en variables `NEXT_PUBLIC_`, Git o logs.

Los códigos duran diez minutos y admiten cinco intentos. Hay 60 segundos entre envíos. Los enlaces de recuperación duran una hora y son de un solo uso. Los errores del proveedor de correo se muestran; nunca se simula un envío exitoso para una cuenta conocida.

## Verificación

Ejecuta `pnpm --filter web test`, `pnpm check-types`, `pnpm lint`, `node scripts/i18n-check.mjs` y `pnpm build` desde la raíz. Vitest usa convex-test y dobles de red: no envía correo real.

Antes de publicar, comprueba con una dirección que controles: registro y entrega real del código, código incorrecto/vencido, reenvío, usuario ocupado, foto inválida, perfil sin foto, recarga del perfil, primer espacio, acceso existente, cierre de sesión, cambio de idioma, enlace vencido/usado, contraseña repetida y recuperación completa. Verifica teclado, móvil y movimiento reducido. La entrega real de Resend depende de las credenciales y del remitente configurado.
