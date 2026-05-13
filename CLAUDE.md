# FlashEnglish

Mini-app web para que mis dos hijas practiquen traducción español → inglés mediante tarjetas. Proyecto personal, sin presión de plazos, también pieza de portfolio.

## Quién soy

Product manager experimentado, **no soy desarrollador**. Mi código es flojo. Necesito que me trates como senior en producto pero junior en implementación: explícame las decisiones, no me sueltes 500 líneas sin contexto, y cuando elijas una librería o patrón di por qué.

## Repositorio y deploy

- **GitHub**: https://github.com/sclearys/flashenglish
- **Deploy**: Vercel (pendiente de conectar — ver "Pendiente para Fase 2")
- El código de la app ES la raíz del repo (no hay subdirectorio adicional)

## Documentación del proyecto

Los docs de referencia están en local en `../docs/` (no están en el repo por volumen):

- `01-Diseno-Maestro.docx` → qué construir, mecánica del juego, fases del proyecto, requisitos funcionales.
- `02-Sistema-Spark.docx` → sistema visual: colores, tipografía, espaciados, componentes. Es la fuente de verdad de cualquier decisión estética.
- `03-Decisiones-Arquitectura.docx` → schema de localStorage, regla de fallos del sistema de aprendizaje, pipeline de contenido. Decisiones técnicas ya cerradas.
- `../docs/content.json` → catálogo de 750 frases. Para el MVP solo se usan los bloques BASIC1 + BASIC2 (225 frases).

Si una decisión ya está en estos documentos, **se aplica sin discutir**. Si necesitas saltártela, lo justificas explícitamente.

**Nota:** Los archivos `.docx` en `docs/` son en realidad Markdown con extensión .docx. Leerlos como texto plano.

## Stack acordado

- **Next.js 14+** con App Router
- **TypeScript** estricto
- **Tailwind CSS** con variables CSS de Spark
- Deploy en **Vercel** (gratis, desde GitHub)
- **Sin backend en Fase 1 y 2**: todo el estado vive en `localStorage`

## Reglas de trabajo

### Cadencia
- Trabajamos por **iteraciones pequeñas y verificables**. Cada iteración termina con algo que puedo abrir en el navegador y comprobar.
- **Una iteración por vez.** No avanzas a la siguiente sin que yo lo confirme.
- **Usa Plan Mode** (o equivalente) antes de tocar ficheros en cambios no triviales. Quiero ver el plan, confirmarlo, y entonces ejecutas.

### Estilo de código
- Comentarios donde aporten valor, no comentar lo obvio.
- Nombres descriptivos en castellano para conceptos del dominio (`progresoFrases`, `sesionEnCurso`), inglés para conceptos técnicos genéricos (`useState`, `Button`).
- Prefiere claridad sobre brevedad. Soy junior, el código tiene que ser legible para mí dentro de un mes.

### Cuando me expliques algo
- Sé directo, sin halagos vacíos.
- Si una decisión mía es mala, dilo. No me digas que sí porque sí.
- Si una librería o patrón se puede explicar con una analogía simple, úsala.
- Si te falta info para decidir bien, **pregunta**. Mejor una pregunta corta que una suposición que toque rehacer.

## Comandos útiles del proyecto

Todos los comandos se ejecutan desde la raíz del repo (carpeta `app/` en local, raíz en GitHub).

```bash
npm run dev      # arranca el servidor de desarrollo en localhost:3000
npm run build    # build de producción
npm run lint     # comprobar lint
```

## Estructura del proyecto

```
(raíz del repo = carpeta app/ en local)
├── app/
│   ├── layout.tsx             # Root layout: fuente Inter, metadata PWA
│   ├── globals.css            # Tailwind base + keyframes de animación
│   ├── page.tsx               # Pantalla de inicio (stats + selector de sesión)
│   ├── sesion/
│   │   ├── page.tsx           # Wrapper con Suspense (requerido por useSearchParams)
│   │   └── SesionInterna.tsx  # Lógica completa de sesión activa
│   └── resumen/
│       └── page.tsx           # Pantalla de fin de sesión
├── components/
│   └── FeedbackFallo.tsx      # Pantalla "A REPASAR" con temporizador
├── lib/
│   ├── types.ts               # Todos los tipos TypeScript del dominio
│   ├── storage.ts             # Leer/escribir localStorage
│   ├── sesion.ts              # Compositor de sesión (pendientes + nuevas)
│   ├── aprendizaje.ts         # Máquina de estados del sistema de aprendizaje
│   └── stats.ts               # Cálculo de estadísticas del perfil
├── data/
│   └── content.json           # Catálogo de frases (import estático en build)
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icon.svg               # Icono de la app
└── tailwind.config.ts         # Tokens Spark (colores, tipografía, radios)
```

## Estado del proyecto

- Fase 0 (planificación): ✅ cerrada (diseño, Spark, arquitectura, contenido).
- Fase 1 (MVP): ✅ cerrada. App funcional con mecánica completa.
- Fase 2: 🔄 en curso.
- Fase 3: pendiente.

## Notas para futuras sesiones

### Decisiones de tipografía (ajustadas durante el desarrollo)
- Frases en español e inglés: **18px**, `font-semibold`, hardcodeadas como `text-[18px]` en los componentes (no usar el token `text-phrase` que puede quedar cacheado).
- El token `text-phrase` en `tailwind.config.ts` está a 18px como referencia, pero los componentes usan el valor directo.
- Eyebrows (TRADUCE, ENGLISH, A REPASAR): 10px, semibold, tracking 0.12em — token `text-eyebrow`.

### Decisiones de UX tomadas durante el desarrollo
- **Orden de botones de evaluación**: Fallo · Casi · Perfecto (de izquierda a derecha). El positivo va a la derecha.
- **Botón retroceder** (`‹`): aparece a la izquierda de Fallo solo desde la segunda tarjeta. Deshace la última evaluación restaurando un snapshot del estado anterior.
- **Temas gramaticales**: se muestran todos los del array (pueden ser 2-3 por frase).
- **Sesión más corta**: si hay menos de N frases disponibles, la sesión usa las que haya (no bloquea).
- **Selector de frases por sesión**: 10 / 15 / 20 / 25. Por defecto 25. Se pasa por URL param (`/sesion?frases=10`).
- **Resumen**: usa `useRef` para evitar doble ejecución de `useEffect` en React StrictMode (modo desarrollo).

### Gotchas técnicos
- **Node.js no estaba en PATH** al arrancar el proyecto. Si en una nueva sesión `node` no se encuentra, ejecutar primero: `$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")`.
- **El servidor de desarrollo** debe arrancarlo el usuario desde su propia terminal (`npm run dev`). Si lo arranca Claude, se cae al terminar la sesión.
- **Los archivos `.docx` en `docs/`** son en realidad Markdown con extensión .docx. Leerlos como texto plano.
- **localStorage en StrictMode**: React ejecuta los `useEffect` dos veces en desarrollo. Usar `useRef` como guardia cuando el efecto no debe repetirse (ver `app/resumen/page.tsx`).
- **`ids_repaso` en SesionEnCurso**: campo añadido en It-2. Sesiones guardadas antes de ese campo no lo tienen → usar `sesion.ids_repaso ?? []` como fallback defensivo.

### Pendiente para Fase 2
- ✅ Repo en GitHub: https://github.com/sclearys/flashenglish
- 🔄 Deploy en Vercel (conectar el repo de GitHub a vercel.com — en proceso).
- Multiperfil (selector de hasta 3 perfiles al abrir la app).
- Contenido del bloque Advanced disponible.
- Test inicial adaptativo (~15 frases que ubican al usuario en nivel de partida).
- Icono PWA en PNG real (192x192 y 512x512) para mejor compatibilidad en iOS.
- Racha de días: ✅ ya implementada en Fase 1.
