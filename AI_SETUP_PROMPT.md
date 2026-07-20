# AI Setup Prompt — OpenCode SDLC System

## Instrucciones para el agente configurador

Tu tarea es instalar y configurar el sistema **OpenCode SDLC Multi-Agent System** siguiendo estos pasos en orden.

### Fase 1: Verificar instalación

1. Detecta el sistema operativo:
   - `os.platform()` === 'win32' → **Windows**
   - `os.platform()` === 'darwin' → **macOS**
   - `os.platform()` === 'linux' → **Linux**

2. Según el SO, la ruta de configuración de OpenCode es:
   - **Windows**: `%USERPROFILE%\.config\opencode\`
   - **macOS**: `$HOME/.config/opencode/`
   - **Linux**: `$HOME/.config/opencode/`
   - (opcional) Variable de entorno `OPENCODE_CONFIG_DIR` para override

3. Verifica que la carpeta existe. Si no:
   - Abre OpenCode Desktop al menos una vez para que la cree
   - Si no lo tienes instalado, descárgalo de https://opencode.ai

4. Verifica que los archivos del sistema están en la ruta correcta:
   - Agentes: `<configPath>/agents/`
   - Plugins: `<configPath>/plugins/`

5. Verifica que `opencode.json` o `opencode.jsonc` tenga los 5 plugins registrados

### Fase 2: Instalación

Si faltan archivos o plugins, ejecuta:

```bash
npx opencode-sdlc-system
```

O si clonaste el repo:

```bash
cd <ruta-del-repo>
node install.js
```

### Fase 3: Analizar el proyecto

1. Usa `@sdlc-explorer` para mapear el proyecto:
   - Lenguajes y frameworks detectados
   - Dependencias principales
   - Convenciones de código existentes
   - Estructura de directorios
2. Verifica que `agents/context.json` fue generado

### Fase 4: Configurar permisos de agentes

Revisa los archivos `.md` en `<configPath>/agents/` y ajusta permisos. Por defecto:

| Agente | Edit | Bash | WebFetch |
|--------|------|------|----------|
| @orchestrator | deny | allow | allow |
| @sdlc-planner | deny | allow | allow |
| @sdlc-explorer | deny | allow | deny |
| @sdlc-implementer | allow | allow | allow |
| @sdlc-reviewer | deny | allow | allow |
| @sdlc-tester | allow | allow | allow |
| @sdlc-documenter | allow | deny | allow |

### Fase 5: Prueba de humo

1. Invoca `/agent orchestrator`
2. Pide "explora la estructura del proyecto y dime qué tecnologías detectas"
3. Verifica que la respuesta incluya:
   - Stack técnico detectado
   - Estructura de directorios
   - Convenciones encontradas

### Fase 6: Reporte final

Genera un reporte con:

```markdown
## Reporte de Configuración — OpenCode SDLC System

### Estado de instalación
- [ ] InitPlugin funcional
- [ ] ContextLoaderPlugin funcional
- [ ] StateTrackerPlugin funcional
- [ ] ActionValidatorPlugin funcional
- [ ] CleanupPlugin funcional

### Stack detectado
- Lenguajes: [...]
- Frameworks: [...]
- Package manager: [...]
- Test runner: [...]

### Permisos configurados
| Agente | Edit | Bash | WebFetch |
|--------|------|------|----------|
| @orchestrator | deny | allow | allow |
| @sdlc-planner | deny | allow | allow |
| @sdlc-explorer | deny | allow | deny |
| @sdlc-implementer | allow | allow | allow |
| @sdlc-reviewer | deny | allow | allow |
| @sdlc-tester | allow | allow | allow |
| @sdlc-documenter | allow | deny | allow |

### Próximos pasos sugeridos
- [...]
```

## Comandos útiles por SO

```powershell
# Windows
ls "$env:USERPROFILE\.config\opencode\agents\"
ls "$env:USERPROFILE\.config\opencode\plugins\"
gc "$env:USERPROFILE\.config\opencode\opencode.json"
```

```bash
# macOS / Linux
ls ~/.config/opencode/agents/
ls ~/.config/opencode/plugins/
cat ~/.config/opencode/opencode.json
```
