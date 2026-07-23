import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "ActionValidatorPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async ["tool.execute.before"](input: any, output: any) {
        if (!projectDir) return;

        const toolName = input.tool || input.name || input.toolName;
        const terminalTools = ["shell", "bash", "command", "run_command"];

        if (terminalTools.includes(toolName)) {
          const args = { ...input.args, ...output?.args, ...output };
          const cmd = (args.command || args.cmd || args.CommandLine || "").trim();

          if (!cmd) return;

          // Normalizar barras e ignorar mayúsculas/minúsculas
          const normalizedCmd = cmd.replace(/\\/g, '/').toLowerCase();

          // EVALUACIÓN EXCLUSIVA DE DESTRUCCIÓN CATASTRÓFICA DEL SISTEMA OPERATIVO
          const catastrophicPatterns = [
            // Destrucción de la raíz del sistema Unix o directorio Home (~, $HOME, %USERPROFILE%, /)
            /^\s*rm\s+-[a-z]*r[a-z]*\s+([\/]\s*$|[\/]\*\s*$|~\s*$|\$home|%userprofile%)/i,
            // Destrucción de raíz de Windows o directorios de sistema (C:\, C:\Windows, C:\Program Files)
            /^\s*(rd|rmdir|remove-item|del|erase)\s+.*(c:\/$|c:\/windows|c:\/program files)/i,
            /^\s*rm\s+-[a-z]*r[a-z]*\s+(c:\/$|c:\/windows|c:\/program files)/i,
            // Formateo directo de particiones o discos
            /^\s*format\s+[a-z]:/i,
            /^\s*mkfs/i,
            // Apagado o reinicio del equipo
            /^\s*(shutdown|reboot|init\s+0|poweroff)/i,
            // Sobrescritura directa de dispositivos de bloque
            />\s*\/dev\/sd[a-z]/i,
            />\s*\/dev\/nvme/i
          ];

          const isCatastrophic = catastrophicPatterns.some(pattern => 
            pattern.test(cmd) || pattern.test(normalizedCmd)
          );

          if (isCatastrophic) {
            try {
              const agentsDir = path.join(projectDir, '.agents');
              const securityLogPath = path.join(agentsDir, 'security.log');
              if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

              const logEntry = `BLOCKED_CATASTROPHIC | tool: ${toolName} | command: ${cmd}\n`;
              fs.appendFileSync(securityLogPath, logEntry);
            } catch (e) {}

            throw new Error(`[ActionValidatorPlugin] Acción bloqueada por seguridad. Se intentó ejecutar un comando destructivo del sistema operativo.`);
          }
        }
      }
    };
  }
};
