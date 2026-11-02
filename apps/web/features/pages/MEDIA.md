# Imágenes compartidas y edición

El editor de páginas y notas utiliza `MediaPicker`, de `features/gallery/components/`: admite enlaces HTTP(S), selección de la galería del espacio y subida. Los archivos nuevos se guardan mediante `/api/gallery/upload`; se espera a que una versión esté disponible antes de insertarla. El documento guarda una referencia autenticada a la versión mediana, sin duplicar los bytes ni introducir base64. Los enlaces externos permanecen externos.

Las imágenes de Galería conservan sus permisos: los enlaces del documento no hacen públicos los archivos. Exportar Markdown conserva las referencias, pero verlas requiere una sesión con acceso al espacio. Eliminar una imagen desde Galería también retira el archivo al que apuntan los documentos; no hay copia independiente dentro de cada página.

La creación de espacios ofrece 19 iconos y una imagen personalizada. Entradas de hasta 2 MiB y 16 megapíxeles se convierten en el navegador a WebP de lado máximo 256 px y hasta 128 KiB. Se cierran los bitmaps y se revocan las URL de previsualización. La imagen optimizada también se registra en Galería. El backend verifica propiedad, disponibilidad, tamaño y dimensiones antes de asociarla al espacio. Los enlaces y la galería del espacio actual pueden usarse como origen; un origen externo necesita permitir CORS. Las descargas destinadas al icono se detienen al superar 2 MiB.

El índice de páginas usa filas compactas dentro de una columna centrada. El icono editable acompaña al título; los controles de formato, importación/exportación, impresión, historial e inserción tienen nombres accesibles y tooltips. La inserción combina un icono con el nombre del elemento.

Cambios aditivos: `spaces.icon` permite identificadores vectoriales y referencias `media:<slug>:<key>`; los valores antiguos permanecen compatibles. No se necesita backfill. Ejecutar `pnpm --filter web exec convex dev --once` en desarrollo y el despliegue habitual de Convex en producción.
