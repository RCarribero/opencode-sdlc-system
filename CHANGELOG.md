## [1.0.2] — 2026-07-20

### Fixed
- UTF-8 BOM eliminado de todos los archivos para compatibilidad con Windows (el shebang en install.js fallaba en npm install -g)
- Archivos guardados con UTF-8 sin BOM
## [1.0.1] — 2026-07-20

### Added
- Soporte multiplataforma en install.js: detección de Windows/macOS/Linux con rutas específicas
- Manejo de ejecución via npx (detección de rutas temporales y registro con paths absolutos)
- Variable de entorno `OPENCODE_CONFIG_DIR` para override de ruta de configuración
- Copia asíncrona recursiva con `fs.promises` para subdirectorios
- Sección de instalación manual por SO en README (Windows PowerShell, macOS/Linux bash)
- AI_SETUP_PROMPT.md con instrucciones específicas por sistema operativo
- CONFIGURATION.md con guía completa de configuración manual

### Fixed
- Shebang añadido a install.js para funcionar como CLI global
- Compatibilidad con jsonc preservando comentarios durante inyección de plugins
- Mensajes específicos según SO al finalizar la instalación
# Changelog

Todas las cambios notables en este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-19

### Added

- **Orquestación multi-agente SDLC**: 6 subagentes especializados (`@sdlc-planner`, `@sdlc-explorer`, `@sdlc-implementer`, `@sdlc-reviewer`, `@sdlc-tester`, `@sdlc-documenter`) coordinados por `@orchestrator`
- **Plugin ActionValidatorPlugin**: Bloquea comandos destructivos (`rm -rf`, `format`, `shutdown`, etc.) en tiempo real y registra intentos en `agents/security.log`
- **Plugin CleanupPlugin**: Limpia automáticamente scripts temporales de `agents/workflow/` al iniciar cada sesión
- **Plugin ContextLoaderPlugin**: Detecta stack técnico (Node.js, Python, Rust, etc.) y frameworks, escribe `agents/context.json` y lo inyecta en el system prompt de los agentes
- **Plugin StateTrackerPlugin**: Persiste historial de archivos modificados y plan a medio terminar en `agents/state.json` y `agents/plan.json`
- **Plugin InitPlugin**: Inicializa proyectos vacíos creando un `README.md` básico si el workspace no contiene archivos visibles
- **Instalador automático** (`install.js`): Copia agentes y plugins a `~/.config/opencode/`, registra hooks en `opencode.json`/`opencode.jsonc`, sin dependencias externas
- **Sistema de permisos granular**: Cada agente define su propio frontmatter YAML con permisos para edición, bash, web fetch y task
- **Persistencia de sesión**: El orquestador puede retomar planes interrumpidos gracias a `state.json` y `plan.json`

