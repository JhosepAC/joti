# Joti — Definición del concepto del producto
Antes de hablar de tecnologías, arquitectura o código, tenemos que definir qué es Joti, qué problema resuelve, cómo funciona y qué experiencia queremos ofrecer. La idea es construir una identidad de producto lo suficientemente clara como para que todas las decisiones futuras tengan sentido.
Mi propuesta es tratar esta etapa como la definición conceptual de un producto real.
Stay in the flow with Craft
[craft.do](<https://www.craft.do/os26?utm_source=chatgpt.com>)

Dirección visual conceptual: un entorno personal, organizado, modular y acogedor.

## 1. ¿Qué es Joti?

Joti es una plataforma digital que permite crear espacios personalizados para organizar diferentes áreas de tu vida, tus proyectos y tus relaciones.
Cada espacio es un entorno independiente que el usuario crea según sus necesidades. Dentro de él puede organizar información mediante herramientas como listas, tareas, calendarios, notas, documentos y galerías.
El usuario no tiene que adaptarse a una estructura predeterminada. Es Joti quien se adapta a la forma en que cada persona quiere organizarse.
Por ejemplo, una persona podría crear los siguientes espacios:
- Universidad: asignaturas, tareas, proyectos grupales, fechas de exámenes y documentos.
- Vida personal: objetivos, hábitos, pendientes e ideas.
- Amigos: planes, películas por ver, viajes y actividades.
- Pareja: calendario compartido, regalos, recuerdos y notas.
- Trabajo: proyectos, reuniones, tareas y recursos.
- Proyecto personal: ideas, planificación, referencias y seguimiento del progreso.

Todos estos espacios viven dentro de una misma cuenta, pero cada uno tiene su propia organización y contenido.

### La idea central
> Un solo lugar para organizar muchas partes de tu vida, a tu manera.

Joti no pretende ser únicamente una aplicación de tareas, una agenda o un bloc de notas. Busca reunir esas herramientas en espacios que tengan sentido para cada usuario.

## 2. ¿Qué problema resuelve?
Actualmente, una persona puede utilizar una aplicación para sus tareas, otra para sus notas, un calendario para sus eventos, una carpeta para sus documentos y un chat para organizar planes con otras personas.
El resultado suele ser información dispersa, contextos mezclados y dificultad para mantener todo organizado.

Joti parte de tres problemas principales:
- Información fragmentada
Las tareas, los documentos, las notas y los eventos relacionados con una misma actividad están repartidos en diferentes herramientas.

- Organización rígida
Muchas herramientas imponen una estructura que no necesariamente coincide con la forma en que una persona piensa o trabaja.

Falta de contexto compartido
- Cuando varias personas organizan algo juntas, la información puede quedar repartida entre mensajes, archivos y calendarios independientes.

Joti busca responder a estos problemas con una estructura sencilla: crear un espacio, decidir cómo organizarlo y reunir ahí todo lo relacionado con él.
No necesita reemplazar todas las aplicaciones del usuario para resultar útil. Su valor está en proporcionar un entorno organizado y coherente para cada contexto.

## 3. ¿Qué significa realmente un espacio en Joti?

Esta es la decisión conceptual más importante del producto.
Un espacio no debería ser simplemente una carpeta que contiene listas. Debería ser un entorno de organización con identidad propia, cuyo contenido y estructura dependen del propósito que tenga.
Cada espacio puede tener:
- Un nombre.
- Una descripción opcional.
- Un icono y un color identificativo.
- Un conjunto de herramientas.
- Su propio contenido.
- Una configuración de acceso.
- Uno o varios participantes, si el usuario decide compartirlo.

Por ejemplo, crear un espacio llamado Universidad no debería obligar al usuario a utilizar una plantilla académica. Puede empezar vacío y agregar las herramientas que necesite, o utilizar una plantilla como punto de partida.

# Universidad

Mi espacio académico
Privado4 módulos
Pendientes
7 tareas pendiente
Calendario
Clases y fechas importantes
Trabajos grupales
Tareas y coordinación
Documentos
Material de estudio

Ejemplo ilustrativo de cómo podría verse un espacio personalizado.
La regla conceptual sería: el espacio define el contexto; sus módulos definen cómo se organiza la información.
Esto permite que dos espacios tengan estructuras completamente diferentes, incluso si pertenecen a la misma persona.

## 4. ¿Cómo funcionaría Joti para el usuario?

El recorrido principal debe ser fácil de comprender. Idealmente, una persona que visita Joti por primera vez puede entender su funcionamiento en pocos minutos.

Paso 1. Crear una cuenta

El usuario se registra e ingresa a su entorno personal.

Paso 2. Crear su primer espacio

Elige un nombre, un icono, un color y, si lo desea, una descripción. También puede comenzar con una plantilla.

Paso 3. Personalizarlo

Añade las herramientas que necesita: listas, tareas, calendario, notas, documentos o galerías.

Paso 4. Organizar su información

Crea tareas, registra fechas, escribe notas y guarda recursos dentro de los módulos correspondientes.

Paso 5. Compartirlo, si quiere

Invita a otras personas a un espacio concreto, sin necesidad de compartir el resto de su cuenta.

El usuario puede volver a su panel principal en cualquier momento, entrar a otro espacio y cambiar de contexto sin perder su organización.

## 5. Los componentes principales del producto

Para definir Joti correctamente, conviene distinguir entre sus entidades centrales y las herramientas que ofrece.

### A. Cuenta y perfil

Representa al usuario dentro de Joti.

Funcionalidades:

- Registro e inicio de sesión.
- Recuperación de cuenta.
- Perfil con nombre y avatar opcional.
- Preferencias personales.
- Acceso a los espacios propios y compartidos.

### B. Espacios

Son la unidad principal de organización.

Funcionalidades:

- Crear, editar y eliminar espacios.
- Asignar nombre, descripción, icono y color.
- Crear un espacio desde cero o desde una plantilla.
- Reordenar los espacios.
- Archivar y restaurar espacios.
- Marcar espacios como favoritos.
- Configurar participantes y permisos.
- Duplicar un espacio como punto de partida para otro.

### C. Módulos

Son las herramientas que el usuario incorpora dentro de cada espacio.

La idea no es que todos los espacios contengan las mismas herramientas, sino que cada uno pueda combinar las que necesite.

Pomito Pomodoro timer

Listas y tareas

Crear elementos, marcar tareas como completadas, establecer prioridades, añadir fechas límite y organizar pendientes.

nixly

Calendario

Registrar eventos, fechas importantes y actividades. En versiones posteriores, permitir vistas mensuales y semanales.

Notepad desktop app by Serhii Yermolenko on Dribbble

Notas

Escribir ideas, apuntes, recordatorios y contenido organizado por títulos o categorías.

Document Home by Prakash Ghodke 👋 for Never Before Seen on Dribbble

Documentos y archivos

Guardar enlaces, adjuntar archivos y reunir materiales relevantes para el contexto del espacio.

White Brown Color Palette Ideas (20 Picks + Hex)

Galería

Reunir imágenes y recuerdos relacionados con un espacio, por ejemplo, fotos de viajes o referencias para un proyecto.

Hay una distinción importante: una lista de películas podría utilizar el módulo de listas y tareas, con campos como título, estado y valoración. No hace falta desarrollar una aplicación de películas independiente. Del mismo modo, una lista de regalos podría reutilizar ese módulo con una configuración diferente.

Esta reutilización sería una de las decisiones fundamentales de diseño de Joti.

## 6. Joti personal y Joti compartido

La colaboración merece una definición propia porque puede convertirse en una de las funcionalidades más valiosas del producto.

Joti debe permitir que el usuario tenga espacios personales y, si lo desea, espacios compartidos.

| Aspecto | Espacio personal | Espacio compartido |
| --- | --- | --- |
| Propietario | Un usuario | Un usuario propietario |
| Acceso | Solo usuarios autorizados | Miembros invitados |
| Contenido | Organización individual | Organización conjunta |
| Edición | Según permisos del propietario | Según el rol de cada miembro |
| Ejemplo | Notas privadas | Calendario de pareja |

Los espacios compartidos podrían permitir:

- Invitar mediante correo electrónico o enlace controlado.
- Asignar roles de propietario, editor y lector.
- Ver los cambios de otros participantes.
- Colaborar en tareas y listas.
- Administrar los miembros y revocar el acceso.

Un principio esencial: compartir un espacio no debe compartir automáticamente los demás espacios del usuario.

Además, las notas y los documentos deben respetar los permisos del espacio en el que se encuentran. Si en el futuro se necesitan elementos privados dentro de un espacio compartido, esa privacidad tendrá que diseñarse explícitamente.

## 7. La estructura general de la aplicación

Conceptualmente, Joti podría tener cuatro áreas principales de navegación.

Inicio

Vista general de los espacios, favoritos y actividad reciente.

Mis espacios

Todos los espacios creados por el usuario, organizados y accesibles desde un solo lugar.

Compartidos conmigo

Espacios a los que otras personas lo han invitado.

Configuración

Perfil, preferencias, seguridad y gestión de cuenta.

No haría que el inicio fuera un panel complejo lleno de estadísticas. Su propósito sería ayudar a la persona a encontrar rápidamente el espacio al que quiere entrar.

Una vez dentro de un espacio, la interfaz cambiaría para mostrar únicamente su contexto y sus módulos.

## 8. ¿Qué hace diferente a Joti?

Joti no sería la primera plataforma con espacios, notas, tareas o colaboración. Hay productos que ya resuelven partes importantes de este problema.

Por tanto, su diferenciación no debería basarse en afirmar que inventa una categoría nueva, sino en definir con precisión qué experiencia quiere ofrecer.

Propongo tres principios:

1. Organización por contexto. Las personas piensan en términos de situaciones y proyectos —Universidad, Viaje, Pareja—, no únicamente en tipos de herramientas.
2. Personalización sin complejidad. Cada espacio empieza sencillo y el usuario agrega funcionalidades a medida que las necesita.
3. Un producto personal que también permite colaborar. El usuario conserva su propia organización, pero puede compartir espacios concretos con otras personas.

La ventaja buscada sería que una persona no tenga que diseñar un sistema complejo para comenzar. Crear un espacio y añadir una lista debería tomar muy poco tiempo.

La flexibilidad tiene que estar presente sin convertir Joti en una herramienta difícil de configurar.

## 9. Alcance funcional: qué pertenece a Joti y qué puede esperar

Para mantener una visión clara, separaría el concepto completo del producto de lo que realmente construiremos primero.

| Funcionalidad | MVP | Evolución |
| --- | --- | --- |
| Registro y cuenta | Sí | Mejoras de perfil y preferencias |
| Crear y administrar espacios | Sí | Plantillas y duplicación |
| Listas y tareas | Sí | Prioridades y filtros avanzados |
| Personalizar módulos | Básico | Más tipos y opciones |
| Notas | Puede esperar | Editor más completo |
| Calendario | Puede esperar | Vistas avanzadas y recordatorios |
| Galería y archivos | Puede esperar | Organización y previsualizaciones |
| Compartir espacios | Sí, si el alcance lo permite | Roles y colaboración avanzada |
| Tiempo real | No imprescindible al inicio | Sincronización colaborativa |
| Búsqueda global | Básica o posterior | Búsqueda en todos los espacios |
| Aplicación móvil nativa | No | Solo si existe una necesidad real |
| Integraciones externas | No | Según demanda de usuarios |

Mi recomendación sería que el primer MVP incluya cuentas, espacios, módulos de listas y tareas, y permisos correctamente implementados. Si la colaboración es central para la visión inicial, incluiría también invitaciones y espacios compartidos, dejando las funciones avanzadas para después.

## 10. Principios que deberían guiar el producto

Estos serían los principios que utilizaría para tomar decisiones futuras sobre Joti:

- Simplicidad: crear un espacio no debería exigir configuraciones técnicas ni una plantilla obligatoria.
- Flexibilidad: cada espacio debe poder adaptarse a un propósito distinto.
- Coherencia: todos los módulos deben sentirse parte de una misma aplicación.
- Privacidad: los espacios son privados por defecto y el usuario controla con quién los comparte.
- Persistencia: la información debe guardarse de forma fiable y no desaparecer al cerrar la aplicación.
- Portabilidad: conviene pensar desde el principio cómo permitir que el usuario recupere sus datos.
- Accesibilidad: la aplicación debe poder utilizarse con teclado, lectores de pantalla y distintos tamaños de pantalla.
- Evolución gradual: agregar funciones sin hacer que las existentes se vuelvan más difíciles de usar.

# 11. La definición que propongo para Joti

# Joti

Definición conceptual · Versión 1.0

Categoría: plataforma modular de organización personal y colaborativa.

Propósito: ayudar a las personas a organizar diferentes áreas de su vida en entornos digitales independientes, personalizados y fáciles de gestionar.

Unidad central: el espacio, creado por el usuario y definido por un contexto.

Modelo de funcionamiento: cada espacio contiene módulos que permiten crear, organizar y consultar información.

Tipos de usuario: personas que necesitan organizar su vida individual, grupos de amigos, parejas, estudiantes, equipos y personas que gestionan proyectos personales.

Propuesta de valor: reunir las herramientas y la información de cada contexto en un espacio que el usuario pueda adaptar a sus necesidades.

Principio diferenciador: el usuario no empieza eligiendo una aplicación especializada; empieza creando el espacio que necesita y decide cómo organizarlo.

Visión a largo plazo: convertirse en una plataforma flexible donde las personas puedan construir su propio sistema de organización personal y compartir partes de él con quienes elijan.<