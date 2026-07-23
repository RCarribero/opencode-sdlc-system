# Workflow: Auditoría de Seguridad y Code Review

Flujo especializado para auditar la calidad, seguridad y cumplimiento de normativas en el código.

---

## 📍 Fases del Workflow

```mermaid
graph TD
    A[Solicitud de Auditoría] --> B[@sdlc-explorer]
    B --> C[@sdlc-reviewer]
    C --> D[Informe de Auditoría en .agents/security.log]
```

### 1. Mapeo de Archivos Sensibles (`@sdlc-explorer`)
- Localiza puntos de entrada API, validaciones de entrada, consultas DB y manejo de variables de entorno/secretos.

### 2. Auditoría Estricta (`@sdlc-reviewer`)
- Evalúa inyecciones SQL/NoSQL, XSS, sanitización de entradas, fugas de secretos y comandos bloqueados.
- Genera recomendaciones clasificadas por severidad (CRITICAL, HIGH, MEDIUM, LOW).
