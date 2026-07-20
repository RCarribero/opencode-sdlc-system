import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "ContextLoaderPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;
    let hasLoadedContext = false;

    return {
      async event({ event }: any) {
        if (event.type === "session.created") {
          hasLoadedContext = false;
        }
      },
      async ["experimental.chat.messages.transform"](input: any, output: any) {
        if (hasLoadedContext) return;
        hasLoadedContext = true;

        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const configDir = path.join(projectDir, '.agents');
          const contextPath = path.join(configDir, 'context.json');

          try {
            if (!fs.existsSync(configDir)) {
              fs.mkdirSync(configDir, { recursive: true });
            }

            // --- Mejora 2: Auto-detección del stack técnico ---
            const contextData: any = {
              project: path.basename(projectDir),
              initializedAt: new Date().toISOString(),
              status: "active",
              stack: {
                languages: [],
                frameworks: [],
                packageManager: null,
                testRunner: null
              },
              dependencies: {}
            };

            // Detectar package.json (Node/JS/TS)
            const pkgPath = path.join(projectDir, 'package.json');
            if (fs.existsSync(pkgPath)) {
              try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                contextData.stack.languages.push('JavaScript');
                contextData.stack.packageManager = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml')) ? 'pnpm'
                  : fs.existsSync(path.join(projectDir, 'yarn.lock')) ? 'yarn'
                  : fs.existsSync(path.join(projectDir, 'bun.lockb')) ? 'bun' : 'npm';

                if (pkg.dependencies) contextData.dependencies = { ...pkg.dependencies };
                if (pkg.devDependencies) contextData.dependencies = { ...contextData.dependencies, ...pkg.devDependencies };

                // Detectar frameworks
                const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
                if (allDeps['next']) contextData.stack.frameworks.push('Next.js');
                if (allDeps['react']) contextData.stack.frameworks.push('React');
                if (allDeps['vue']) contextData.stack.frameworks.push('Vue');
                if (allDeps['svelte'] || allDeps['@sveltejs/kit']) contextData.stack.frameworks.push('Svelte');
                if (allDeps['express']) contextData.stack.frameworks.push('Express');
                if (allDeps['fastify']) contextData.stack.frameworks.push('Fastify');
                if (allDeps['@angular/core']) contextData.stack.frameworks.push('Angular');

                // Detectar test runner
                if (allDeps['vitest']) contextData.stack.testRunner = 'vitest';
                else if (allDeps['jest']) contextData.stack.testRunner = 'jest';
                else if (allDeps['mocha']) contextData.stack.testRunner = 'mocha';
                else if (allDeps['playwright'] || allDeps['@playwright/test']) contextData.stack.testRunner = 'playwright';

                // Scripts relevantes
                if (pkg.scripts) contextData.scripts = pkg.scripts;
              } catch (e) { /* ignore malformed package.json */ }
            }

            // Detectar TypeScript
            if (fs.existsSync(path.join(projectDir, 'tsconfig.json'))) {
              if (!contextData.stack.languages.includes('TypeScript')) contextData.stack.languages.push('TypeScript');
            }

            // Detectar Python
            if (fs.existsSync(path.join(projectDir, 'requirements.txt')) || fs.existsSync(path.join(projectDir, 'pyproject.toml'))) {
              contextData.stack.languages.push('Python');
              if (fs.existsSync(path.join(projectDir, 'pyproject.toml'))) contextData.stack.packageManager = contextData.stack.packageManager || 'poetry/pip';
            }

            // Detectar Rust
            if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
              contextData.stack.languages.push('Rust');
              contextData.stack.packageManager = contextData.stack.packageManager || 'cargo';
            }

            // Detectar Go
            if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
              contextData.stack.languages.push('Go');
              contextData.stack.packageManager = contextData.stack.packageManager || 'go modules';
            }

            fs.writeFileSync(contextPath, JSON.stringify(contextData, null, 2));
          } catch (e) {
            console.error('[ContextLoaderPlugin] Error creando contexto:', e);
          }
        }
      },
      // --- Mejora 1 + 3 + 4: Inyectar context.json, state.json, plan.json y security.log en el System Prompt ---
      async ["experimental.chat.system.transform"](input: any, output: any) {
        if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
          const agentsDir = path.join(projectDir, '.agents');
          const contextPath = path.join(agentsDir, 'context.json');
          const statePath = path.join(agentsDir, 'state.json');
          const planPath = path.join(agentsDir, 'plan.json');
          const securityPath = path.join(agentsDir, 'security.log');
          const readmePath = path.join(projectDir, 'README.md');

          const readSafe = (p: string): string => {
            try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ""; } catch { return ""; }
          };

          const contextContent = readSafe(contextPath);
          const stateContent = readSafe(statePath);
          const planContent = readSafe(planPath);
          const securityContent = readSafe(securityPath);
          const readmeContent = readSafe(readmePath);

          if (contextContent || stateContent || planContent || readmeContent || securityContent) {
            const sections = [
              contextContent ? `### Project Context (.agents/context.json)\n${contextContent}` : '',
              stateContent ? `### File Modification History (.agents/state.json)\n${stateContent}` : '',
              planContent ? `### Active Plan (.agents/plan.json)\nA prior session left an unfinished plan. Review it and resume if the user confirms.\n${planContent}` : '',
              securityContent ? `### Security Audit Trail (.agents/security.log)\nThe following dangerous commands were blocked by ActionValidatorPlugin:\n${securityContent}` : '',
              readmeContent ? `### Project README.md\n${readmeContent}` : ''
            ].filter(s => s).join('\n---\n');

            const injection = `
[SYSTEM NOTIFICATION - PROJECT WORKSPACE CONTEXT]
The following project context has been auto-loaded by the infrastructure plugins:
---
${sections}
---
Use this context to guide your answers. If a prior plan exists, offer to resume it.
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
