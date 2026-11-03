# Galería de Joti

Colección privada por espacio, integrada en `/w/[slug]?module=gallery`. Comparte las sesiones HttpOnly, los permisos de propietario y el grant temporal del workspace; no introduce cuentas, roles ni servicios externos. Los espacios compartidos todavía no existen en el proyecto.

## Uso

- Subida múltiple con previsualización, arrastrar archivos, progreso individual y total, dos transferencias simultáneas, cancelación y reintento. El lote admite 20 archivos; cerrar o abandonar el módulo cancela las transferencias del navegador. Una operación ya recibida por el servidor puede terminar y aparecer en la colección.
- Cuadrícula uniforme, mosaico con proporciones originales, vista compacta fotográfica, lista administrativa y cronología por día/mes/año. Tamaño, densidad, orden e información se guardan por usuario y espacio. El orden manual admite arrastrar y controles de teclado en Detalles.
- Álbumes con descripción/color y pertenencia múltiple, etiquetas, búsqueda, filtros por formato/fecha y edición con control de revisión. Eliminar un álbum conserva las imágenes.
- Visor con zoom, desplazamiento, ajuste, navegación con flechas, deslizamiento/pellizco táctil y protección de cambios sin guardar. Descarga individual del original y descarga ZIP de la selección; acciones masivas hasta 100 imágenes.

## Procesamiento y almacenamiento

`convex/gallery/uploads.ts` recibe el original en el runtime Convex (evita el límite de argumentos de 5 MiB del runtime Node). Comprueba firma binaria, calcula SHA-256 y reserva la colección/cuota en una transacción. Un hash ya presente reutiliza la misma imagen y permite añadirla a otro álbum sin repetir sus archivos ni sobrescribir detalles.

El original se conserva intacto en Convex Storage. Una acción Node programada (`files.process`) usa Sharp, que ya formaba parte de las dependencias de Next.js y ahora está declarado explícitamente. Decodifica con límite de píxeles, corrige orientación EXIF, convierte a sRGB y produce WebP sin EXIF/GPS:

| Versión         | Lado mayor máximo | Calidad |
| --------------- | ----------------: | ------: |
| Alta resolución |           3840 px |      93 |
| Mediana         |           1600 px |      88 |
| Miniatura       |            480 px |      85 |
| Placeholder     |             24 px |      65 |

Se conserva el canal alfa (calidad alfa 100), nunca se amplían imágenes pequeñas y un derivado excepcionalmente pesado reduce dimensiones antes de reducir calidad. Los derivados no superan 8 MiB. Se almacenan sus anchos reales para `srcset`. La compresión es con pérdida; el original descargable conserva todos sus bytes.

JPEG, PNG, WebP y AVIF estáticos están admitidos. HEIC/HEIF, GIF, SVG e imágenes animadas requieren conversión previa. La fecha EXIF válida se utiliza cuando existe; sin offset se conserva como fecha/hora UTC, sin inventar ubicación. Se puede corregir o quitar desde Detalles; en ausencia de captura se usa la subida. La zona del dispositivo rige las fechas de subida.

Política actual: conservar siempre originales hasta eliminación explícita. No hay borrado automático para ahorrar cuota. Límites configurados en `convex/gallery/model.ts`: 8 MiB/original, 40 megapíxeles, 5.000 imágenes y 512 MiB por espacio (originales más derivados). Se permiten 100 álbumes y 12 etiquetas de 30 caracteres por imagen. El procesamiento tiene un límite de 500 intentos por usuario/hora. ZIP limita los originales seleccionados a 64 MiB.

## Privacidad, errores y rendimiento

Los clientes reciben metadatos sin IDs de almacenamiento. `/api/gallery/media` valida la sesión y propiedad antes de devolver bytes o un 304; la caché es privada y exige revalidación. No se generan URLs públicas de Convex ni se usa el optimizador público de Next/Image. Los originales solo se solicitan al descargar. Si falta un derivado se intenta mediana/miniatura, nunca el original de forma implícita.

Consultas reactivas e índices por espacio/fecha/nombre/posición entregan ventanas de 60 registros. Los filtros examinan ventanas acotadas; la interfaz carga progresivamente hasta completar el primer conjunto de resultados. Búsquedas muy selectivas pueden recorrer varias ventanas, sin cargar toda la colección en una consulta. El mosaico distribuye dimensiones conocidas entre columnas mediante un único ResizeObserver. Imágenes lazy, placeholders, dimensiones reservadas y `srcset` evitan descargar originales o medir miles de nodos al entrar. No hay virtualización ni CDN pública; priorizamos la privacidad y la carga incremental.

Los estados uploading/processing/ready/error son persistentes. Los errores conservan el original y permiten reintentar o eliminar. Un cron marca trabajos interrumpidos después de 15 minutos. Los derivados fallidos se limpian al capturar errores; eliminar una imagen borra el original y sus cuatro derivados, libera cuota y quita todas sus pertenencias. Las versiones no se comparten entre imágenes distintas; deduplicar reutiliza el registro completo. Como en cualquier acción de almacenamiento separada de una transacción, una terminación abrupta del runtime entre `storage.store` y registrar el ID puede dejar un archivo huérfano; no se realiza un barrido global destructivo sobre archivos de otros módulos.

## Despliegue y validación

Cambios de esquema aditivos: `gallery_images`, `gallery_albums`, `gallery_preferences`, `gallery_usage` y sus índices. No hay backfill ni modificación de datos existentes. `convex.json` y `apps/web/convex.json` externalizan Sharp para instalar el binario de la plataforma en Convex; no se deben subir binarios de Windows al runtime Linux.

```sh
pnpm install
pnpm --filter web exec convex dev --once
pnpm --filter web test
pnpm --filter web lint
pnpm check-types
node scripts/i18n-check.mjs
pnpm build
```

No hacen falta nuevas claves API. En producción se debe desplegar Convex con el flujo habitual y alojar las rutas Node con capacidad para solicitudes de al menos 8 MiB y los tiempos `maxDuration` definidos; algunos proveedores serverless imponen límites de cuerpo inferiores.

Las pruebas `tests/auth/gallery.test.ts` cubren almacenamiento/conversión reales en convex-test, transparencia, EXIF, alta resolución, límites de píxeles, formatos, deduplicación, revisión, álbumes múltiples, permisos revocados, limpieza, ZIP y paginación con 1.000 registros. La revisión en navegador usa una cuenta temporal aislada y archivos de prueba, que se eliminan al terminar.

Quedan fuera de esta versión: HEIC dependiente de un decodificador compatible, búsquedas semánticas, edición fotográfica, conexiones a servicios externos, colaboración/roles compartidos y virtualización de colecciones enteras. No se simulan estas funciones.

Referencias técnicas: [límites de Convex](https://docs.convex.dev/production/state/limits), [paquetes externos](https://docs.convex.dev/functions/bundling), [salida de Sharp](https://sharp.pixelplumbing.com/api-output/).
