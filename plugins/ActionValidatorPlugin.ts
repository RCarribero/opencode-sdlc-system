import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "ActionValidatorPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async ["tool.execute.before"](input: any, output: any) {
        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const toolName = input.tool || input.name || input.toolName;
          const terminalTools = ["shell", "bash", "command", "run_command"];

          if (terminalTools.includes(toolName)) {
            const args = { ...input.args, ...output?.args, ...output };
            const cmd = (args.command || args.cmd || args.CommandLine || "").trim();

            if (!cmd) return;

            // Normalizar barras para coincidencia unificada
            const normalizedCmd = cmd.replace(/\\/g, '/');

            // EVALUACIÓN DE COMANDOS DE SISTEMA DESTRUCTIVOS
            const dangerousPatterns = [
              /^\s*rm\s+-rf?\s+[\/\*]/i,               // rm -rf / o rm -rf *
              /^\s*(remove-item|rmdir|rd)\s+.*[\/\\]s/i, // Borrado destructivo en Windows (rd /s o rmdir /s)
              /^\s*mkfs/i,                             // Formateo de disco
              /^\s*(shutdown|reboot)/i,                 // Apagado del sistema
              />\s*\/dev\/sd[a-z]/i,                   // Sobrescritura directa de disco
              /format\s+[a-z]:\s*\/q/i                 // Formateo Windows (format c: /q)
            ];

            const isDangerous = dangerousPatterns.some(pattern => pattern.test(cmd) || pattern.test(normalizedCmd));

            if (isDangerous) {
              try {
                const agentsDir = path.join(projectDir, '.agents');
                const securityLogPath = path.join(agentsDir, 'security.log');
                if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

                const logEntry = `BLOCKED | tool: ${toolName} | command: ${cmd}\n`;
                fs.appendFileSync(securityLogPath, logEntry);
              } catch (e) {}

              throw new Error(`[ActionValidatorPlugin] Acción bloqueada por seguridad. Se detectó un comando destructivo de sistema.`);
            }
          }
        }
      }
    };
  }
};
