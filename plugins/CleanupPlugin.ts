import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "CleanupPlugin",
  async server(ctx: any) {
    return {
      async event({ event }: any) {
        if (event.type === "session.created") {
          const projectDir = event.properties?.info?.directory;
          if (!projectDir) return;

          // Evitar la raíz del sistema
          if (projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') {
            return;
          }

          const WORKFLOW_DIR = path.join(projectDir, '.agents', 'workflow');
          const TRASH_DIR = path.join(WORKFLOW_DIR, 'trash');
          const TEMP_EXTENSIONS = ['.py', '.js'];

          const moveFileToTrash = (filePath: string, fileName: string) => {
            if (!fs.existsSync(TRASH_DIR)) {
              fs.mkdirSync(TRASH_DIR, { recursive: true });
            }
            const destination = path.join(TRASH_DIR, fileName);
            fs.renameSync(filePath, destination);
          };

          // Función para identificar si un archivo en la raíz es de prueba/temporal
          const isTemporaryFileName = (fileName: string): boolean => {
            const lowerName = fileName.toLowerCase();
            return (
              lowerName === 'test.js' || lowerName === 'test.py' ||
              lowerName === 'temp.js' || lowerName === 'temp.py' ||
              lowerName === 'tmp.js' || lowerName === 'tmp.py' ||
              lowerName.startsWith('test_') || lowerName.startsWith('temp_') ||
              lowerName.startsWith('tmp_')
            );
          };

          const processTempFiles = (dir: string, onlyMatchTempPatterns: boolean) => {
            if (!fs.existsSync(dir)) return;
            try {
              fs.readdirSync(dir).forEach((file) => {
                const filePath = path.join(dir, file);
                const ext = path.extname(file);

                if (filePath !== TRASH_DIR && fs.statSync(filePath).isFile() && TEMP_EXTENSIONS.includes(ext)) {
                  // Si estamos en la raíz, solo mover si coincide con patrones de prueba (evitando borrar app.js)
                  if (onlyMatchTempPatterns) {
                    if (isTemporaryFileName(file)) {
                      moveFileToTrash(filePath, file);
                    }
                  } else {
                    // Si estamos en la carpeta de workflow del agente, mover todo
                    moveFileToTrash(filePath, file);
                  }
                }
              });
            } catch (err) {
              console.error(`[Cleanup] Error en directorio ${dir}:`, err);
            }
          };

          // 1. En la carpeta temporal del agente (workflow), limpiamos TODOS los archivos .js y .py
          processTempFiles(WORKFLOW_DIR, false);

          // 2. En la raíz del proyecto, SOLO limpiamos archivos que coincidan con patrones de prueba/temporales (ej: test.js, tmp.py, etc.)
          processTempFiles(projectDir, true);
        }
      }
    };
  }
};
