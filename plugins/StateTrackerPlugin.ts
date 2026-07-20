import * as fs from 'fs';
import * as path from 'path';

export default {
  id: "StateTrackerPlugin",
  async server(ctx: any) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      async event({ event }: any) {
        if (event.type === "session.created") {
          if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
            const stateDir = path.join(projectDir, '.agents');
            const statePath = path.join(stateDir, 'state.json');

            try {
              if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
              }

              if (!fs.existsSync(statePath)) {
                const initialState = {
                  lastUpdated: new Date().toISOString(),
                  modifications: []
                };
                fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2));
              }
            } catch (e) {
              console.error('[StateTrackerPlugin] Error inicializando state.json:', e);
            }
          }
        }
      },
      async ["tool.execute.after"](input: any, output: any) {
        if (!projectDir || projectDir === 'C:\\' || projectDir === 'C:/' || projectDir === '/') return;

        const agentsDir = path.join(projectDir, '.agents');
        const statePath = path.join(agentsDir, 'state.json');
        const planPath = path.join(agentsDir, 'plan.json');

        try {
          // --- Rastreo de modificaciones de archivos ---
          const fileTools = ["write_to_file", "replace_file_content", "multi_replace_file_content", "write", "edit"];
          if (fileTools.includes(input.tool)) {
            const args = { ...input.args, ...output?.args, ...output };
            const filePath = args.filePath || args.TargetFile || args.path || args.targetFile || args.filename || args.file;

            if (!filePath) return;

            const relativePath = path.isAbsolute(filePath) ? path.relative(projectDir, filePath) : filePath;

            if (relativePath.includes('.agents/') || relativePath.includes('state.json') || relativePath.includes('opencode_plugin_runs.log')) {
              return;
            }

            let currentState: any = { lastUpdated: null, modifications: [] };

            if (fs.existsSync(statePath)) {
              try { currentState = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (e) { /* fallback */ }
            }

            currentState.lastUpdated = new Date().toISOString();
            if (!Array.isArray(currentState.modifications)) currentState.modifications = [];

            currentState.modifications.push({
              file: relativePath,
              timestamp: new Date().toISOString()
            });

            if (currentState.modifications.length > 30) currentState.modifications.shift();

            fs.writeFileSync(statePath, JSON.stringify(currentState, null, 2));
          }

          // --- Mejora 3: Persistencia del plan (interceptar todowrite) ---
          if (input.tool === "todowrite") {
            const args = { ...input.args, ...output?.args, ...output };
            const todos = args.todos || args.items || args.content;

            if (todos) {
              if (!fs.existsSync(agentsDir)) {
                fs.mkdirSync(agentsDir, { recursive: true });
              }

              let currentPlan: any = { lastUpdated: null, phases: [] };

              if (fs.existsSync(planPath)) {
                try { currentPlan = JSON.parse(fs.readFileSync(planPath, 'utf8')); } catch (e) { /* fallback */ }
              }

              currentPlan.lastUpdated = new Date().toISOString();

              // Si viene como array, registrar cada item
              if (Array.isArray(todos)) {
                currentPlan.phases = todos.map((t: any) => ({
                  title: t.title || t.content || t.text || String(t),
                  status: t.status || 'pending'
                }));
              } else if (typeof todos === 'string') {
                // Si es un string (contenido del todo), actualizar como bloque
                currentPlan.rawContent = todos;
              }

              fs.writeFileSync(planPath, JSON.stringify(currentPlan, null, 2));
            }
          }
        } catch (e: any) {
          console.error('[StateTrackerPlugin] Error procesando herramienta:', e);
        }
      }
    };
  }
};
