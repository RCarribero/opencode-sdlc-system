# Contribuyendo a OpenCode SDLC System

Gracias por tu interés en contribuir. Este proyecto acepta contribuciones de la comunidad.

## Cómo contribuir

### Reportar bugs

1. Verifica que el bug no haya sido reportado antes
2. Abre un issue describiendo:
   - Comportamiento esperado vs actual
   - Pasos para reproducir
   - Versión de OpenCode Desktop y Node.js
   - Sistema operativo

### Sugerir mejoras

Abre un issue con la etiqueta `enhancement` describiendo:
- El problema que resuelve
- Cómo debería funcionar
- Ejemplos de uso si aplica

### Enviar código

1. Haz fork del repositorio
2. Crea una rama con nombre descriptivo: `feat/nombre-cambio` o `fix/nombre-cambio`
3. Haz tus cambios siguiendo las guías de estilo del proyecto
4. Asegúrate de que `node install.js` funcione correctamente
5. Envía un Pull Request a la rama `main`

## Guías de estilo

### Archivos de agente (`.md`)

- Usa frontmatter YAML con `description`, `mode`, `color` y `permission`
- Los subagentes deben usar `mode: subagent`
- Prefijos de nombre: `sdlc-*` para que el orquestador pueda invocarlos

### Archivos de plugin (`.ts`)

- Exporta un objeto por defecto con `id` (string) y `server` (función async)
- El `id` debe terminar en `Plugin`
- Usa hooks de OpenCode: `event`, `chat.message`, `tool.execute.before`, `experimental.chat.messages.transform`
- No uses dependencias externas (solo Node.js stdlib)

### Commits

Usa commits semánticos:

```
feat: añade nueva funcionalidad
fix: corrige un bug
docs: cambios en documentación
refactor: cambios en código sin alterar funcionalidad
chore: tareas de mantenimiento
```

## Pull Requests

- Describe claramente qué cambia y por qué
- Referencia el issue correspondiente si existe
- Mantén PRs pequeños y enfocados (un cambio por PR)
- Responde a los comentarios del revisor

## Licencia

Al contribuir, aceptas que tu código se publique bajo la licencia MIT del proyecto.
