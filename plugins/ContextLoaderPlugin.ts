import * as fs from 'fs';
import * as path from 'path';

export function updateProjectContext(projectDir: string): any {
  if (!projectDir || projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') return null;

  const configDir = path.join(projectDir, '.agents');
  const contextPath = path.join(configDir, 'context.json');

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const pkgPath = path.join(projectDir, 'package.json');
    const contextData: any = {
      project: path.basename(projectDir),
      stack: { languages: [], frameworks: [], packageManager: 'npm', testRunner: null },
      keyDependencies: []
    };

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        contextData.stack.languages.push('JavaScript');
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        const keyLibs = ['react', 'next', 'vue', 'express', 'fastify', 'typescript', 'vitest', 'jest', 'stripe', '@supabase/supabase-js'];
        contextData.keyDependencies = Object.keys(allDeps).filter(d => keyLibs.some(k => d.includes(k)));

        if (allDeps['express']) contextData.stack.frameworks.push('Express');
        if (allDeps['next']) contextData.stack.frameworks.push('Next.js');
        if (allDeps['react']) contextData.stack.frameworks.push('React');
        if (allDeps['vue']) contextData.stack.frameworks.push('Vue');
        if (allDeps['fastify']) contextData.stack.frameworks.push('Fastify');

        if (allDeps['typescript'] || fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
          contextData.stack.languages.push('TypeScript');
        }
      } catch (e) {}
    }

    fs.writeFileSync(contextPath, JSON.stringify(contextData, null, 2));
    return contextData;
  } catch (e) {
    console.error('[ContextLoaderPlugin] Error creando contexto:', e);
    return null;
  }
}

export default {
  id: "ContextLoaderPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async event() {},
      async ["experimental.chat.messages.transform"](input: any, output: any) {
        if (!projectDir || projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') return;

        const contextPath = path.join(projectDir, '.agents', 'context.json');
        let needsUpdate = true;

        if (fs.existsSync(contextPath)) {
          try {
            const existing = JSON.parse(fs.readFileSync(contextPath, 'utf8'));
            if (existing.stack?.languages?.length > 0 || existing.keyDependencies?.length > 0) {
              needsUpdate = false;
            }
          } catch {}
        }

        if (needsUpdate) {
          updateProjectContext(projectDir);
        }
      },
      async ["experimental.chat.system.transform"](input: any, output: any) {
        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const agentsDir = path.join(projectDir, '.agents');
          const contextPath = path.join(agentsDir, 'context.json');
          const statePath = path.join(agentsDir, 'state.json');
          const planPath = path.join(agentsDir, 'plan.json');
          const securityPath = path.join(agentsDir, 'security.log');
          const readmePath = path.join(projectDir, 'README.md');

          const readSafe = (p: string, maxChars: number = 2000): string => {
            try {
              if (!fs.existsSync(p)) return "";
              const content = fs.readFileSync(p, 'utf8');
              return content.length > maxChars ? content.substring(0, maxChars) + "\n...[Truncated for token optimization]" : content;
            } catch { return ""; }
          };

          let contextContent = readSafe(contextPath);
          let stateContent = readSafe(statePath, 1000);
          let planContent = readSafe(planPath, 1500);
          let securityContent = readSafe(securityPath, 500);
          let readmeContent = readSafe(readmePath, 2000);

          if (contextContent || stateContent || planContent || readmeContent || securityContent) {
            const sections = [
              contextContent ? `### Project Context (.agents/context.json)\n${contextContent}` : '',
              stateContent ? `### File Modification History (.agents/state.json)\n${stateContent}` : '',
              planContent ? `### Active Plan (.agents/plan.json)\n${planContent}` : '',
              securityContent ? `### Security Audit Trail (.agents/security.log)\n${securityContent}` : '',
              readmeContent ? `### Project README.md (Summary)\n${readmeContent}` : ''
            ].filter(Boolean).join('\n---\n');

            const injection = `
[SYSTEM NOTIFICATION - PROJECT WORKSPACE CONTEXT]
The following static project context is loaded for this session:
---
${sections}
---
Use this context to guide your answers.
`;
            if (output && Array.isArray(output.system)) {
              output.system.push(injection);
            }
          }
        }
      }
    };
  }
};
