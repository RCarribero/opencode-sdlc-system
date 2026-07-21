# Guía de Configuración — OpenCode SDLC System

Esta guía explica cómo configurar y personalizar el sistema SDLC multi-agente para tu proyecto.

---

## Índice

- [Configuración inicial](#configuración-inicial)
- [Estructura de archivos de configuración](#estructura-de-archivos-de-configuración)
- [Configurar agentes](#configurar-agentes)
- [Configurar plugins](#configurar-plugins)
- [Personalizar el orquestador](#personalizar-el-orquestador)
- [Variables de entorno](#variables-de-entorno)
- [Solución de problemas](#solución-de-problemas)

---

## Configuración inicial

Después de instalar (`npm install -g opencode-sdlc-system` o `npx opencode-sdlc-system`), los archivos se copian a:

| Archivos | Destino |
|---|---|
| Agentes | `~/.config/opencode/agents/` |
| Plugins | `~/.config/opencode/plugins/` |
| Configuración | `~/.config/opencode/opencode.json` |

**Reinicia OpenCode Desktop** después de la instalación para que los plugins se activen.

---

## Estructura de archivos de configuración

### `opencode.json` / `opencode.jsonc`

Archivo principal de configuración de OpenCode. El instalador registra automáticamente los 5 plugins en el array `plugin`:

```json
{
  "default_agent": "orchestrator",
  "plugin": [
    "./plugins/InitPlugin.ts",
    "./plugins/ContextLoaderPlugin.ts",
    "./plugins/StateTrackerPlugin.ts",
    "./plugins/ActionValidatorPlugin.ts",
    "./plugins/CleanupPlugin.ts"
  ]
}
```

### `agents/context.json` (auto-generado)

Metadatos del proyecto detectados automáticamente por ContextLoaderPlugin:

```json
{
  "project": "nombre-del-proyecto",
  "stack": {
    "languages": ["javascript", "typescript"],
    "frameworks": ["react", "next.js"],
    "packageManager": "npm",
    "testRunner": "jest"
  },
  "dependencies": {}
}
```

### `agents/state.json` (auto-generado)

Historial de archivos modificados por los agentes. Usado por StateTrackerPlugin para persistencia entre sesiones.

### `agents/plan.json` (auto-generado)

Plan de trabajo activo. Permite al orquestador retomar tareas interrumpidas.

---

## Configurar agentes

Cada agente es un archivo `.md` con frontmatter YAML. Puedes ajustar permisos y comportamiento editándolos directamente en `~/.config/opencode/agents/`.

### Estructura de permisos

```yaml
---
description: Descripción del agente
mode: primary           # primary | subagent
color: primary          # primary | secondary | success | warning | info | accent
permission:
  edit: allow           # allow | deny
  bash: allow           # allow | deny | list of allowed commands
  webfetch: allow       # allow | deny
  task:
    "*": deny
    "sdlc-*": allow     # Solo puede invocar subagentes sdlc-*
  todowrite: allow
  question: allow
  skill: allow
---
```

### Ejemplo: restringir el implementador

Si quieres que `@sdlc-implementer` solo pueda editar ciertos directorios y ejecutar solo comandos de build:

```yaml
permission:
  edit: allow
  bash:
    "*": deny
    "npm run build*": allow
```

### Orden de carga

1. `@orchestrator` — agente principal (mode: primary)
2. `@sdlc-planner` — planificación
3. `@sdlc-explorer` — exploración de código
4. `@sdlc-implementer` — implementación
5. `@sdlc-reviewer` — revisión
6. `@sdlc-tester` — pruebas
7. `@sdlc-documenter` — documentación

---

## Configurar plugins

Los plugins se ejecutan en segundo plano. Se configuran registrándolos en el array `plugin` del `opencode.json`.

### Plugins disponibles

| Plugin | ID | Eventos que escucha |
|---|---|---|
| **InitPlugin** | `initplugin` | `session.created`, `chat.messages.transform` |
| **ContextLoaderPlugin** | `contextloaderplugin` | `session.created`, `chat.messages.transform`, `chat.system.transform` |
| **StateTrackerPlugin** | `statetrackerplugin` | `session.created`, `tool.execute.after` |
| **ActionValidatorPlugin** | `actionvalidatorplugin` | `chat.message`, `tool.execute.before` |
| **CleanupPlugin** | `cleanupplugin` | `session.created` |

### Orden de los plugins

El orden en el array `plugin` importa. Se recomienda:

1. `InitPlugin` — primero, para inicializar proyectos vacíos
2. `ContextLoaderPlugin` — carga el contexto técnico
3. `StateTrackerPlugin` — rastrea el estado
4. `ActionValidatorPlugin` — valida acciones peligrosas
5. `CleanupPlugin` — limpia al final

### Deshabilitar un plugin

Elimínalo del array `plugin` en `opencode.json` y reinicia OpenCode.

---

## Personalizar el orquestador

El orquestador (`@orchestrator`) es el cerebro del sistema. Puedes modificar su comportamiento editando `~/.config/opencode/agents/orchestrator.md`:

- **Skills awareness**: configura qué skills carga el orquestador antes de despachar subagentes
- **Workflow steps**: ajusta el orden de las fases del SDLC
- **Subagentes disponibles**: lista los subagentes que el orquestador puede invocar

### Añadir un subagente personalizado

1. Crea `~/.config/opencode/agents/sdlc-misubagente.md`
2. Define frontmatter con `mode: subagent`
3. Añade `"sdlc-misubagente": "allow"` al `task` del orquestador

---

## Variables de entorno

| Variable | Descripción | Por defecto |
|---|---|---|
| `OPENCODE_CONFIG_DIR` | Directorio de configuración de OpenCode | `~/.config/opencode/` |
| `OPENCODE_SKIP_POSTINSTALL` | Salta la ejecución automática de `install.js` tras `npm install` | `false` |

---

## Solución de problemas

### Los plugins no se cargan

1. Verifica que los plugins estén en `~/.config/opencode/plugins/`
2. Verifica que estén registrados en el array `plugin` de `opencode.json`
3. **Reinicia OpenCode Desktop** completamente

### El orquestador no encuentra subagentes

1. Verifica que los archivos `.md` estén en `~/.config/opencode/agents/`
2. Verifica que tengan `mode: subagent` en el frontmatter
3. El nombre del archivo debe empezar con `sdlc-`

### ActionValidatorPlugin bloquea comandos legítimos

Si el plugin bloquea un comando que necesitas, puedes:
1. Deshabilitar el plugin removiéndolo del array `plugin`
2. Modificar `ActionValidatorPlugin.ts` para ajustar la lista de palabras prohibidas

### Error de permisos al instalar en Linux/Mac

```bash
sudo npm install -g opencode-sdlc-system
```

O configura npm para instalaciones globales sin sudo:

```bash
npm config set prefix ~/.npm
export PATH="$PATH:$HOME/.npm/bin"
```

### El instalador no encuentra OpenCode

Asegúrate de haber abierto OpenCode Desktop al menos una vez. Esto crea el directorio `~/.config/opencode/`.
