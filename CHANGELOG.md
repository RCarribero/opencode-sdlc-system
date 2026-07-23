## [1.3.0] - 2026-07-23

### Added
- **Modo Cavernícola Hyper-Terse**: Ahorro automático de ~80% de tokens de salida. Directiva global inyectada en `opencode.jsonc` y `ContextLoaderPlugin.ts`.
- **Comandos Slash Nativos**: Accesos directos `/sdlc`, `/plan`, `/review`, `/test`, `/docs` integrados en el chat.
- **Skill Integrada `opencode-best-practices`**: Guía técnica offline instalada en `~/.agents/skills/`.
- **Suite de Pruebas Integrada (`npm test`)**: 15 tests automatizados de integración real.
- **Workflows Guía**: Guías preparadas en `workflows/new-feature.md`, `workflows/bug-fix.md`, `workflows/security-audit.md`.

### Changed
- **`ActionValidatorPlugin`**: Refactorizado para permitir borrados de desarrollo local (`rm -rf node_modules`, `rd /s /q dist`), manteniendo bloqueada la destrucción del SO (`/`, `C:\Windows`, `format`).
- **`@sdlc-reviewer`**: Rediseñado a formato ultra-compacto (1 sola línea por hallazgo, sin preámbulos, sin elogios y sin preguntas finales).
- **Subagentes Ocultos**: Configuración `hidden: true` aplicada a los 6 subagentes para mantener limpia la UI del selector de agentes.

---

## [1.0.8] - 2026-07-21

### Added
- external_directory: configura permisos globales de external_directory a allow en opencode.jsonc y en orchestrator.md para permitir acceso sin confirmación a archivos fuera del directorio del proyecto

## [1.0.7] - 2026-07-20

### Added
- AutoDiscoveryPlugin: escanea package.json/Cargo.toml/go.mod/py al iniciar sesión, autoconfigura MCP servers (Stripe, Supabase, GitHub, Sentry, Vercel, AWS, Jira, PostgreSQL) e inyecta instrucción dinámica al orquestador para que use find-skills y descubra skills relevantes autónomamente
