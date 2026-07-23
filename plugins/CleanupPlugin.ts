import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "CleanupPlugin",
  async server(ctx: any) {
    const serverProjectDir = ctx.directory || ctx.project?.directory;

    return {
      async event({ event }: any) {
        if (event.type === "session.created") {
          const projectDir = serverProjectDir || event.properties?.info?.directory;
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
                  if (onlyMatchTempPatterns) {
                    if (isTemporaryFileName(file)) {
                      moveFileToTrash(filePath, file);
                    }
                  } else {
                    moveFileToTrash(filePath, file);
                  }
                }
              });
            } catch (err) {
              console.error(`[Cleanup] Error en directorio ${dir}:`, err);
            }
          };

          processTempFiles(WORKFLOW_DIR, false);
          processTempFiles(projectDir, true);
        }
      }
    };
  }
};
