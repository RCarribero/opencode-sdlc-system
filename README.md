# OpenCode SDLC Multi-Agent System

[![npm version](https://img.shields.io/npm/v/opencode-sdlc-system)](https://www.npmjs.com/package/opencode-sdlc-system)
[![npm downloads](https://img.shields.io/npm/dm/opencode-sdlc-system)](https://www.npmjs.com/package/opencode-sdlc-system)

Orquestación completa del ciclo de vida del software (SDLC) para **OpenCode Desktop**, impulsada por un equipo de subagentes especializados y un sistema de hooks globales que garantizan seguridad, persistencia de estado y limpieza automática del entorno de trabajo.

---

## Tabla de contenido

- [Descripción general](#descripción-general)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Equipo de agentes](#equipo-de-agentes)
- [Plugins de infraestructura](#plugins-de-infraestructura)
- [Cómo usar el sistema](#cómo-usar-el-sistema)
- [Ejemplo de flujo de trabajo](#ejemplo-de-flujo-de-trabajo)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Personalización y extensión](#personalización-y-extensión)
- [Instalación manual por sistema operativo](#instalación-manual-por-sistema-operativo)
- [Guía de configuración manual](CONFIGURATION.md)
- [AI Setup Prompt](AI_SETUP_PROMPT.md)
- [Enlaces](#enlaces)
- [Licencia](#licencia)

---

## Descripción general

Este sistema convierte **OpenCode Desktop** en un entorno de desarrollo asistido por IA completo y seguro. En lugar de depender de un solo agente, el sistema orquesta un equipo de 6 subagentes especializados que trabajan en secuencia para planificar, explorar, implementar, revisar, probar y documentar tu código.

Cada subagente tiene permisos limitados a su rol específico, lo que reduce riesgos de seguridad. Los 5 plugins de infraestructura se ejecutan en segundo plano para detectar tu stack técnico, bloquear comandos destructivos, persistir el estado entre sesiones y mantener limpio tu disco.

---

## Requisitos previos

- **OpenCode Desktop** instalado y abierto al menos una vez (para que exista `~/.config/opencode/`)
- **Node.js** (cualquier versión LTS) — necesario para ejecutar el instalador

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
node install.js
```

> **IMPORTANTE:** Reinicia OpenCode Desktop después de la instalación para que los plugins se activen.

El instalador:
- Copia los agentes a `~/.config/opencode/agents/`
- Copia los plugins a `~/.config/opencode/plugins/`
- Registra los 5 plugins en el array `plugin` de tu `opencode.json` o `opencode.jsonc`
- Si no existe archivo de configuración, crea uno básico automáticamente

---

## Equipo de agentes

### 🧠 `@orchestrator` — Coordinador principal
Orquesta todo el ciclo SDLC. Delega tareas a los subagentes según su especialidad. Nunca edita código directamente.

### 📋 `@sdlc-planner` — Planificador
Convierte requerimientos difusos en un plan de implementación estructurado: archivos a modificar, riesgos, criterios de aceptación y estrategia de pruebas. Solo lectura.

### 🔍 `@sdlc-explorer` — Explorador
Mapea bases de código existentes: detecta convenciones, patrones, dependencias y arte previo relevante. Solo lectura.

### 💻 `@sdlc-implementer` — Implementador
Escribe el código siguiendo el plan del planificador. Tiene acceso completo de edición sobre los archivos del proyecto.

### 🔎 `@sdlc-reviewer` — Revisor
Audita los cambios implementados: bugs, vulnerabilidades de seguridad, problemas de rendimiento y violaciones de estilo. Solo lectura + git.

### 🧪 `@sdlc-tester` — Probador
Ejecuta la suite de pruebas existente, diagnostica fallos y sugiere casos de prueba faltantes. Puede editar tests y ejecutar comandos.

### 📄 `@sdlc-documenter` — Documentador
Genera y actualiza README, JSDoc, CHANGELOG y documentación técnica. Edita solo archivos de documentación, sin tocar lógica de aplicación.

---

## Plugins de infraestructura

Se ejecutan en segundo plano en cada sesión de OpenCode sin intervención del usuario.

| Plugin | Función |
|---|---|
| 🛡️ **ActionValidatorPlugin** | Bloquea comandos destructivos (`rm -rf`, `format`, `shutdown`, etc.) en tiempo real y registra cada intento en `agents/security.log` |
| 🧹 **CleanupPlugin** | Limpia automáticamente los scripts temporales de `agents/workflow/` al iniciar cada sesión, moviéndolos a una carpeta `trash` |
| 🧠 **ContextLoaderPlugin** | Detecta automáticamente tu stack técnico (Node.js, Python, Rust, etc.) y frameworks, escribe `agents/context.json` y lo inyecta en el system prompt de los agentes |
| 🤖 **AutoDiscoveryPlugin** | Escanea el proyecto al iniciar la sesión, instala `find-skills` de Vercel, autoconfigura MCP servers (Stripe, Supabase, GitHub, etc.) según las dependencias detectadas, e inyecta una instrucción dinámica al orquestador para que descubra skills relevantes |
| 💾 **StateTrackerPlugin** | Persiste el historial de archivos modificados y el plan a medio terminar en `agents/state.json` y `agents/plan.json`, permitiendo retomar sesiones interrumpidas |
| 🚀 **InitPlugin** | Inicializa proyectos vacíos creando un `README.md` básico si el workspace no contiene archivos visibles |

---

## Cómo usar el sistema

Una vez instalado y reiniciado OpenCode:

1. Abre tu proyecto en OpenCode Desktop
2. En el chat, invoca al orquestador escribiendo `/agent orchestrator` o selecciónalo desde la UI
3. Pídele lo que necesites en lenguaje natural
4. El orquestador delegará automáticamente el trabajo en los subagentes apropiados mientras los plugins de infraestructura vigilan la seguridad y el estado

### Comandos rápidos

```
/agent orchestrator    → Inicia el orquestador principal
```

---

## Ejemplo de flujo de trabajo

Petición del usuario:
> "Agrega un endpoint POST /api/contact que reciba nombre, email y mensaje, lo valide y lo guarde en un archivo JSON. Ejecuta el ciclo SDLC completo."

Lo que sucede internamente:

1. **`@sdlc-explorer`** mapea el proyecto: detecta Express, estructura de rutas existente, convenciones de naming
2. **`@sdlc-planner`** produce un plan: archivos a crear (`routes/contact.js`, `validators/contact.js`), archivos a modificar (`app.js`), riesgos y criterios de aceptación
3. **`@sdlc-implementer`** escribe el código siguiendo el plan
4. **`@sdlc-reviewer`** audita el diff: verifica validaciones, manejo de errores, seguridad
5. **`@sdlc-tester`** ejecuta los tests existentes, sugiere casos para el nuevo endpoint
6. **`@sdlc-documenter`** actualiza el README con el nuevo endpoint y registra el cambio en el CHANGELOG

Mientras tanto, los plugins:
- `ContextLoaderPlugin` inyecta el stack (Node + Express) en el contexto de cada agente
- `ActionValidatorPlugin` bloquea cualquier intento de comando destructivo
- `StateTrackerPlugin` registra cada archivo modificado

---

## Estructura del proyecto

```
opencode-sdlc-system/
├── agents/
│   ├── orchestrator.md          # Agente principal — coordina el ciclo SDLC
│   ├── sdlc-planner.md          # Planificador de implementación
│   ├── sdlc-explorer.md         # Explorador de bases de código
│   ├── sdlc-implementer.md      # Implementador de código
│   ├── sdlc-reviewer.md         # Revisor de código
│   ├── sdlc-tester.md           # Probador automatizado
│   ├── sdlc-documenter.md       # Documentador técnico
│   ├── context.json             # Metadatos del proyecto (auto-detectados)
│   ├── state.json               # Historial de modificaciones (generado por StateTrackerPlugin)
│   └── plan.json                # Plan persistido entre sesiones
├── plugins/
│   ├── InitPlugin.ts            # Inicializa proyectos vacíos
│   ├── ContextLoaderPlugin.ts   # Detecta stack técnico
│   ├── StateTrackerPlugin.ts    # Persiste estado de sesión
│   ├── ActionValidatorPlugin.ts # Bloquea comandos destructivos
│   └── CleanupPlugin.ts         # Limpia archivos temporales
├── install.js                   # Script de instalación
├── package.json                 # Metadatos del paquete
├── README.md                    # Este archivo
├── CHANGELOG.md                 # Historial de versiones
├── CONFIGURATION.md             # Guía de configuración
├── AI_SETUP_PROMPT.md           # Prompt para agente IA configurador
└── CONTRIBUTING.md              # Guía para contribuir
```

---

## Personalización y extensión

### Añadir un nuevo agente

1. Crea un archivo `.md` en `agents/` siguiendo el frontmatter de los existentes
2. Define `mode: subagent` y los permisos adecuados (`edit: allow/deny`, `bash: allow/deny`, etc.)
3. El orquestador puede invocarlo vía Task tool si le das un nombre con prefijo `sdlc-*`
4. Ejecuta `node install.js` para copiarlo

### Añadir un nuevo plugin

1. Crea un archivo `.ts` en `plugins/` exportando un objeto con `id` y `server`
2. Registra tu plugin en el array `plugin` de `opencode.json` o `opencode.jsonc`
3. Ejecuta `node install.js` o añádelo manualmente

### Modificar permisos

Cada agente define sus permisos en el frontmatter YAML de su archivo `.md`. Puedes restringir o ampliar acceso a edición, bash, web fetch, etc.

## Instalación manual por sistema operativo

### 🪟 Windows

```powershell
# Ruta de configuración de OpenCode
$configDir = "$env:USERPROFILE\.config\opencode"

# Verificar que existe
if (!(Test-Path $configDir)) {
  Write-Host "Abre OpenCode Desktop al menos una vez para crear esta carpeta."
  exit 1
}

# Copiar agentes y plugins manualmente
Copy-Item -Path ".\agents\*" -Destination "$configDir\agents\" -Recurse -Force
Copy-Item -Path ".\plugins\*" -Destination "$configDir\plugins\" -Recurse -Force

# Registrar plugins en opencode.json
$configFile = "$configDir\opencode.json"
if (!(Test-Path $configFile)) {
  $configFile = "$configDir\opencode.jsonc"
}
Write-Host "Agrega estos plugins al array 'plugin' en $configFile"
Write-Host "./plugins/InitPlugin.ts"
Write-Host "./plugins/ContextLoaderPlugin.ts"
Write-Host "./plugins/StateTrackerPlugin.ts"
Write-Host "./plugins/ActionValidatorPlugin.ts"
Write-Host "./plugins/CleanupPlugin.ts"
```

### 🍎 macOS

```bash
# Ruta de configuración de OpenCode
CONFIG_DIR="$HOME/.config/opencode"

# Verificar que existe
if [ ! -d "$CONFIG_DIR" ]; then
  echo "Abre OpenCode Desktop al menos una vez para crear esta carpeta."
  exit 1
fi

# Copiar agentes y plugins manualmente
cp -R ./agents/* "$CONFIG_DIR/agents/"
cp -R ./plugins/* "$CONFIG_DIR/plugins/"

# Registrar plugins
echo "Agrega estos plugins al array 'plugin' en $CONFIG_DIR/opencode.json"
echo "./plugins/InitPlugin.ts"
echo "./plugins/ContextLoaderPlugin.ts"
echo "./plugins/StateTrackerPlugin.ts"
echo "./plugins/ActionValidatorPlugin.ts"
echo "./plugins/CleanupPlugin.ts"
```

### 🐧 Linux

```bash
# Mismos comandos que macOS
CONFIG_DIR="$HOME/.config/opencode"

if [ ! -d "$CONFIG_DIR" ]; then
  echo "Abre OpenCode Desktop al menos una vez para crear esta carpeta."
  exit 1
fi

cp -R ./agents/* "$CONFIG_DIR/agents/"
cp -R ./plugins/* "$CONFIG_DIR/plugins/"
```

---

## Enlaces

- [npm package](https://www.npmjs.com/package/opencode-sdlc-system)
- [Guía de configuración](CONFIGURATION.md)
- [Prompt para agente IA](AI_SETUP_PROMPT.md)
- [Reportar un bug](https://github.com/RCarribero/opencode-sdlc-system/issues)

> ¿Problemas? Revisa la [guía de configuración](CONFIGURATION.md) o ejecuta `npx opencode-sdlc-system` para instalación automática.

---

## Licencia

MIT © 2026 — Ver el archivo [LICENSE](LICENSE) para más detalles.
