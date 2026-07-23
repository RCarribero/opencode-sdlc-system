# OpenCode SDLC Multi-Agent System

[![npm version](https://img.shields.io/npm/v/opencode-sdlc-system)](https://www.npmjs.com/package/opencode-sdlc-system)
[![npm downloads](https://img.shields.io/npm/dm/opencode-sdlc-system)](https://www.npmjs.com/package/opencode-sdlc-system)

Orquestación completa del ciclo de vida del software (SDLC) para **OpenCode Desktop**, impulsada por un equipo de subagentes especializados, ahorro extremo de tokens (**Modo Cavernícola Hyper-Terse**) y un sistema de hooks globales que garantizan seguridad, persistencia de estado y limpieza automática del entorno de trabajo.

---

## Tabla de contenido

- [Descripción general](#descripción-general)
- [Novedades en v1.3.0](#novedades-en-v130)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Comandos Slash Nativos](#comandos-slash-nativos)
- [Modo Cavernícola (Token Saver 80%)](#modo-cavernícola-hyper-terse)
- [Equipo de agentes](#equipo-de-agentes)
- [Plugins de infraestructura](#plugins-de-infraestructura)
- [Workflows integrados](#workflows-integrados)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Licencia](#licencia)

---

## Descripción general

Este sistema convierte **OpenCode Desktop** en un entorno de desarrollo asistido por IA completo y seguro. En lugar de depender de un solo agente, el sistema orquesta un equipo de 6 subagentes especializados que trabajan en secuencia para planificar, explorar, implementar, revisar, probar y documentar tu código.

Cada subagente tiene permisos limitados a su rol específico. Los plugins de infraestructura se ejecutan en segundo plano para detectar tu stack técnico, autoconfigurar MCPs (Stripe, Supabase, etc.), bloquear comandos catastróficos del sistema operativo, recortar el consumo de tokens y mantener limpio tu disco.

---

## Novedades en v1.3.0

- 🦴 **Modo Cavernícola Hyper-Terse**: Ahorro automático de ~80% de tokens de salida en cada turno. Respuestas en 1 sola línea por hallazgo, sin rellenos, elogios ni preguntas fuera de rol.
- ⚡ **Comandos Slash Nativos**: Accesos directos `/sdlc`, `/plan`, `/review`, `/test`, `/docs` integrados en el chat.
- 🛡️ **ActionValidator No Intrusivo**: Permite borrados locales (`rm -rf node_modules`, `rd /s /q dist`) bloqueando únicamente la destrucción del sistema operativo (`/`, `C:\Windows`, `format`).
- 🙈 **UI Limpia con Subagentes Ocultos**: Configuración `hidden: true` para que solo `@orchestrator` aparezca en el menú selector de modelos principal.
- 📘 **Skill Integrada `opencode-best-practices`**: Guía técnica offline empaquetada e instalada automáticamente en `~/.agents/skills/`.
- 🧪 **Suite de Pruebas (`npm test`)**: 15 pruebas de integración automatizadas reales sobre el sistema de archivos.

---

## Requisitos previos

- **OpenCode Desktop** instalado y abierto al menos una vez (para que exista `~/.config/opencode/`)
- **Node.js** (>= 18.0.0 LTS) — para ejecutar el instalador y la suite de pruebas

---

## Instalación

### Instalación rápida (npm)

```bash
npx opencode-sdlc-system
```

O instálalo globalmente:

```bash
npm install -g opencode-sdlc-system
```

### Instalación desde el repositorio

```bash
git clone https://github.com/RCarribero/opencode-sdlc-system.git
cd opencode-sdlc-system
npm test          # Ejecuta los 15 tests de integración
node install.js   # Despliega plugins, agentes y skills
```

---

## Comandos Slash Nativos

Puedes escribir cualquiera de estos accesos directos en el chat de OpenCode:

| Comando Slash | Función | Agente Asignado |
|---|---|---|
| **/sdlc `<tarea>`** | Ejecuta el flujo multi-agente SDLC completo end-to-end | `@orchestrator` |
| **/plan `<requisitos>`** | Analiza requerimientos y genera un plan estructurado | `@sdlc-planner` |
| **/review** | Audita diffs de git, seguridad y tipos (modo ultra-terso) | `@sdlc-reviewer` |
| **/test** | Corre la suite de pruebas e informa fallos | `@sdlc-tester` |
| **/docs** | Actualiza README, CHANGELOG y JSDoc | `@sdlc-documenter` |

---

## Modo Cavernícola (Hyper-Terse)

Activado por defecto a nivel global en `opencode.jsonc` y `ContextLoaderPlugin.ts`.

- **ZERO Preamble**: Sin introducciones conversacionales ("Resumen de la revisión...").
- **ZERO Praise**: Sin secciones superfluas ("Lo que ya está bien").
- **ZERO Conversational Questions**: El revisor y subagentes no preguntan ("¿Aplico los fixes?").
- **1 Línea por Hallazgo**: Salida hiper-compacta y directa a la acción.

---

## Equipo de agentes

### 🧠 `@orchestrator` — Coordinador principal (Visible en selector)
Orquesta todo el ciclo SDLC. Delega tareas a los subagentes según su especialidad. Nunca edita código directamente.

### 📋 `@sdlc-planner` — Planificador (Subagente Oculto)
Convierte requerimientos en un plan de implementación estructurado en `.agents/plan.json`. Solo lectura.

### 🔍 `@sdlc-explorer` — Explorador (Subagente Oculto)
Mapea bases de código existentes: detecta convenciones, patrones y dependencias. Solo lectura.

### 💻 `@sdlc-implementer` — Implementador (Subagente Oculto)
Escribe el código siguiendo el plan del planificador. Tiene acceso completo de edición sobre el proyecto.

### 🔎 `@sdlc-reviewer` — Revisor (Subagente Oculto)
Audita los cambios en formato hiper-terso (1 línea por hallazgo). Solo lectura.

### 🧪 `@sdlc-tester` — Probador (Subagente Oculto)
Ejecuta la suite de pruebas existente, diagnostica fallos y sugiere casos de prueba.

### 📄 `@sdlc-documenter` — Documentador (Subagente Oculto)
Genera y actualiza README, JSDoc y CHANGELOG sin tocar la lógica de negocio.

---

## Plugins de infraestructura

| Plugin | Función |
|---|---|
| 🛡️ **ActionValidatorPlugin** | Bloquea destrucción catastrófica del sistema operativo (`rm -rf /`, `rd /s C:\Windows`, `format`). Permite borrados locales. |
| 🧹 **CleanupPlugin** | Limpia automáticamente scripts temporales moviéndolos a `.agents/workflow/trash/`. |
| 🧠 **ContextLoaderPlugin** | Detecta stack técnico, escribe `.agents/context.json` e inyecta la regla Modo Cavernícola Hyper-Terse. |
| 🤖 **AutoDiscoveryPlugin** | Autoconfigura MCPs (Stripe, Supabase, GitHub, etc.) y sincroniza skills locales. |
| 💾 **StateTrackerPlugin** | Persiste historial de modificaciones y plan (hasta 30 items) en `.agents/state.json` y `plan.json`. |
| 🚀 **InitPlugin** | Inicializa proyectos vacíos de forma interactiva y segura. |

---

## Workflows integrados

El proyecto incluye guías de trabajo listas para usar en la carpeta `workflows/`:
- `workflows/new-feature.md`: Desarrollo de nueva funcionalidad paso a paso.
- `workflows/bug-fix.md`: Diagnóstico y reparación rápida de errores.
- `workflows/security-audit.md`: Auditoría estricta de seguridad y código.

---

## Estructura del proyecto

```
opencode-sdlc-system/
├── agents/                  # Definiciones de los 7 agentes (.md)
├── plugins/                 # 6 plugins de infraestructura TypeScript
├── skills/                  # Skills empaquetadas (opencode-best-practices)
├── workflows/               # Guías de workflows comunes
├── tests/                   # Suite de 15 tests de integración (run_tests.ts)
├── install.js               # Instalador y registrador automático
├── package.json             # Metadatos del paquete
├── README.md                # Documentación principal
├── CHANGELOG.md             # Registro de cambios por versión
└── LICENSE                  # Licencia MIT
```

---

## Licencia

MIT © OpenCode SDLC Contributors
