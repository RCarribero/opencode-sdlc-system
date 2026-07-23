import * as fs from 'fs';
import * as path from 'path';

/**
 * Lista de manifiestos/archivos de configuración esenciales que determinan si un proyecto está inicializado.
 */
const ESSENTIAL_MANIFEST_FILES = [
  'package.json',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'build.gradle',
  'pom.xml',
  'Makefile',
  'docker-compose.yml',
  'Dockerfile'
];

/**
 * 1. Función modular de verificación:
 * Comprueba si el directorio del proyecto está vacío o si carece de manifiestos esenciales.
 */
export function isUninitializedProject(projectDir: string): boolean {
  if (!projectDir || !fs.existsSync(projectDir)) return true;

  try {
    const entries = fs.readdirSync(projectDir);
    
    // Filtrar archivos y carpetas ocultos (ej. .git, .agents, .vscode)
    const visibleEntries = entries.filter(name => !name.startsWith('.'));
    
    // Si no hay archivos ni carpetas visibles, la carpeta está vacía
    if (visibleEntries.length === 0) {
      return true;
    }

    // Comprobar si existe al menos un manifiesto de proyecto esencial
    const hasEssentialManifest = ESSENTIAL_MANIFEST_FILES.some(manifest =>
      fs.existsSync(path.join(projectDir, manifest))
    );

    // Si hay muy pocos archivos y ninguno es un manifiesto esencial, se considera no inicializado
    return !hasEssentialManifest && visibleEntries.length <= 2;
  } catch (e) {
    console.error('[InitPlugin] Error comprobando estado del proyecto:', e);
    return true;
  }
}

/**
 * Lógica de inicialización para proyectos existentes que no están vacíos.
 */
export function initializeExistingProjectFiles(projectDir: string): void {
  const readmePath = path.join(projectDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    try {
      fs.writeFileSync(
        readmePath,
        `# Proyecto OpenCode Inicializado\n\nEste workspace ha sido configurado e inicializado automáticamente por el módulo **InitPlugin**.\n`
      );
    } catch (e) {
      console.error('[InitPlugin] Error escribiendo README.md:', e);
    }
  }
}

export default {
  id: "InitPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async event() {},

      /**
       * Transformación de mensajes: Evalúa dinámicamente el estado del proyecto en cada turno
       */
      async ["experimental.chat.messages.transform"](input: any, output: any) {
        if (!projectDir || projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') return;

        const isUninitialized = isUninitializedProject(projectDir);
        const configDir = path.join(projectDir, '.agents');
        const statusPath = path.join(configDir, 'init-status.json');

        if (!fs.existsSync(configDir)) {
          try { fs.mkdirSync(configDir, { recursive: true }); } catch {}
        }

        if (isUninitialized) {
          // CASO A: Proyecto Vacío / Sin Inicializar
          try {
            fs.writeFileSync(statusPath, JSON.stringify({
              status: "pending_interactive_setup",
              isUninitialized: true,
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (e) {
            console.error('[InitPlugin] Error registrando init-status:', e);
          }
        } else {
          // CASO B: Proyecto Inicializado (se creó package.json o similar)
          initializeExistingProjectFiles(projectDir);
          try {
            fs.writeFileSync(statusPath, JSON.stringify({
              status: "ready",
              isUninitialized: false,
              timestamp: new Date().toISOString()
            }, null, 2));
          } catch (e) {
            console.error('[InitPlugin] Error registrando init-status:', e);
          }
        }
      },

      /**
       * Transformación del System Prompt: Inyecta instrucción interactiva si la carpeta no tiene manifiesto
       */
      async ["experimental.chat.system.transform"](input: any, output: any) {
        if (!projectDir || projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') return;

        const isUninitialized = isUninitializedProject(projectDir);

        if (isUninitialized) {
          const initInstruction = `
[SYSTEM NOTIFICATION - UNINITIALIZED EMPTY PROJECT DETECTED]
⚠️ Este espacio de trabajo está VACÍO o no tiene un manifiesto de proyecto esencial (package.json, Cargo.toml, etc.).

INSTRUCCIÓN DE INICIALIZACIÓN INTERACTIVA OBLIGATORIA PARA EL AGENTE:
1. NO asumas la pila tecnológica ni generes estructura a ciegas.
2. Presenta una consulta al usuario (mediante la herramienta 'question' o mensaje directo) para obtener los datos clave:
   - Stack tecnológico principal (Node.js/TypeScript, Python, Rust, Go, etc.)
   - Framework / librería deseada (Express, Next.js, React, Fastify, etc.)
   - Tipo de arquitectura u objetivo del proyecto
3. Tras recibir las respuestas, crea el archivo manifiesto base (ej. package.json o similar) para activar la auto-detección de skills y MCPs.
---
`;
          if (output && Array.isArray(output.system)) {
            output.system.push(initInstruction);
          }
        }
      }
    };
  }
};
