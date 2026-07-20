import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "ActionValidatorPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async ["chat.message"](input: any, output: any) {
        // Validación de peticiones silenciosa en producción
      },
      async ["tool.execute.before"](input: any, output: any) {
        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const terminalTools = ["shell", "bash", "command", "run_command"];
          if (terminalTools.includes(input.tool)) {
            const args = { ...input.args, ...output?.args, ...output };

            const forbiddenKeywords = [
              "rm -", "rm ", "remove-item", "rmdir", "rd ", "del ", "erase",
              "format ", "mkfs", "shutdown", "reboot"
            ];

            const argsString = JSON.stringify(args).toLowerCase();
            const isDangerous = forbiddenKeywords.some(keyword => argsString.includes(keyword));

            if (isDangerous) {
              // --- Mejora 4: Registrar el intento bloqueado en .agents/security.log ---
              try {
                const agentsDir = path.join(projectDir, '.agents');
                const securityLogPath = path.join(agentsDir, 'security.log');

                if (!fs.existsSync(agentsDir)) {
                  fs.mkdirSync(agentsDir, { recursive: true });
                }

                const logEntry = `[${new Date().toISOString()}] BLOCKED | tool: ${input.tool} | command: ${argsString}\n`;
                fs.appendFileSync(securityLogPath, logEntry);
              } catch (e) {
                // No bloquear el flujo si el log falla
              }

              throw new Error(`[ActionValidatorPlugin] Acción bloqueada por seguridad. Se detectó un comando de eliminación/peligroso prohibido.`);
            }
          }
        }
      }
    };
  }
};
