# Workflow: Corrección de Errores (Bug Fix)

Este flujo de trabajo optimizado permite diagnosticar, corregir y validar fallos de runtime o regresiones en el código.

---

## 📍 Fases del Workflow

```mermaid
graph TD
    A[Reporte de Bug / Log de Error] --> B[@sdlc-explorer]
    B --> C[@sdlc-implementer]
    C --> D[@sdlc-reviewer]
    C --> E[@sdlc-tester]
    D & E --> F[Bug Corregido y Verificado]
```

### 1. Diagnóstico y Mapeo (`@sdlc-explorer`)
- Inspecciona los logs y tracebacks de error.
- Identifica la función u objeto raíz causante de la falla.

### 2. Reparación Directa (`@sdlc-implementer`)
- Modifica el código afectando el menor número de líneas posible.
- Evita parches superficiales o try/catch silenciosos.

### 3. Validación y Pruebas en Paralelo
- **`@sdlc-reviewer`**: Audita la corrección para asegurar que no introduce regresiones.
- **`@sdlc-tester`**: Corre las pruebas existentes y añade un test de regresión para el bug.
