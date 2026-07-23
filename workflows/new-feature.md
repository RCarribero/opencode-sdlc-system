# Workflow: Implementación de Nueva Funcionalidad (New Feature)

Este flujo de trabajo guía el desarrollo de una nueva funcionalidad desde la concepción hasta la entrega documentada.

---

## 📍 Fases del Workflow

```mermaid
graph TD
    A[Requisitos de la Feature] --> B[@sdlc-planner]
    B --> C[@sdlc-explorer]
    C --> D[@sdlc-implementer]
    D --> E[@sdlc-reviewer]
    D --> F[@sdlc-tester]
    E & F --> G[@sdlc-documenter]
    G --> H[Feature Lista para Producción]
```

### 1. Planificación (`@sdlc-planner`)
- Analiza los requisitos de la funcionalidad.
- Define la lista de archivos a crear/modificar, riesgos de seguridad y criterios de aceptación.
- Registra las fases en `.agents/plan.json`.

### 2. Exploración y Carga de Contexto (`@sdlc-explorer`)
- Mapea el código existente y patrones del proyecto.
- Ejecuta la verificación de skills pre-dispatch (`find-skills` / `skill`).

### 3. Implementación (`@sdlc-implementer`)
- Crea/edita el código fuente siguiendo estrictamente el plan generado.
- Carga las skills del dominio (ej. `stripe-best-practices`, `tailwind-design-system`).

### 4. Revisión de Código y Ejecución de Pruebas (En Paralelo)
- **`@sdlc-reviewer`**: Revisa los diffs en busca de vulnerabilidades, fuga de tipos y bugs.
- **`@sdlc-tester`**: Ejecuta la suite de pruebas unitarias/integración e informa del resultado.

### 5. Documentación (`@sdlc-documenter`)
- Actualiza `README.md`, `CHANGELOG.md` e interfaces JSDoc/TSDoc sin alterar la lógica de negocio.
