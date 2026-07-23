import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "ActionValidatorPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async ["tool.execute.before"](input: any, output: any) {
        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const terminalTools = ["shell", "bash", "command", "run_command"];
          if (terminalTools.includes(input.tool)) {
            const args = { ...input.args, ...output?.args, ...output };
            const cmd = (args.command || args.cmd || args.CommandLine || "").trim();

            if (!cmd) return;

            // EVALUATION OF TRULY DANGEROUS SYSTEM COMMANDS (Avoiding false positives in git log/commit)
            const dangerousPatterns = [
              /^\s*rm\s+-rf?\s+[\/\*]/i,             // rm -rf / or rm -rf *
              /^\s*(remove-item|rmdir|rd)\s+.*\/s/i, // Destructive Windows deletion
              /^\s*mkfs/i,                           // Disk format
              /^\s*(shutdown|reboot)/i,               // System shutdown
              />\s*\/dev\/sd[a-z]/i                  // Direct disk overwrite
            ];

            const isDangerous = dangerousPatterns.some(pattern => pattern.test(cmd));

            if (isDangerous) {
              try {
                const agentsDir = path.join(projectDir, '.agents');
                const securityLogPath = path.join(agentsDir, 'security.log');
                if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

                const logEntry = `BLOCKED | tool: ${input.tool} | command: ${cmd}\n`;
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
