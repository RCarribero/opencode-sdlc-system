import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "InitPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;
    let hasGreeted = false;

    return {
      async event({ event }: any) {
        if (event.type === "session.created") {
          hasGreeted = false; // Resetear bandera para la nueva sesión
        }
      },
      async ["experimental.chat.messages.transform"](input: any, output: any) {
        if (hasGreeted) return;
        hasGreeted = true;

        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const readmePath = path.join(projectDir, 'README.md');

          // Comprobar si el directorio está vacío (excluyendo archivos ocultos)
          let files: string[] = [];
          try {
            if (fs.existsSync(projectDir)) {
              files = fs.readdirSync(projectDir).filter(f => !f.startsWith('.'));
            }
          } catch (e) {
            console.error('[InitPlugin] Error leyendo archivos:', e);
          }

          if (files.length === 0) {
            // Inicializar proyecto creando README.md básico
            try {
              fs.writeFileSync(readmePath, `# Proyecto OpenCode Inicializado\n\nEste workspace ha sido configurado e inicializado automáticamente por el módulo **InitPlugin**.\n`);
            } catch (e) {
              console.error('[InitPlugin] Error escribiendo README.md:', e);
            }
          }
        }
      }
    };
  }
};
