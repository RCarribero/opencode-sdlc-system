#!/usr/bin/env node
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

const platform = os.platform();
let osIcon, osName;
if (platform === 'win32') {
  osIcon = '🪟'; osName = 'Windows';
} else if (platform === 'darwin') {
  osIcon = '🍎'; osName = 'macOS';
} else {
  osIcon = '🐧'; osName = 'Linux';
}

let configPath = path.join(os.homedir(), '.config', 'opencode');
if (process.env.OPENCODE_CONFIG_DIR) {
  configPath = process.env.OPENCODE_CONFIG_DIR;
}

console.log(`${osIcon} Sistema detectado: ${osName}`);
console.log(`📁 Directorio de configuración OpenCode: ${configPath}`);

if (!fs.existsSync(configPath)) {
  console.log(`⚠️ No se encontró la carpeta ${configPath}.`);
  console.log("Asegúrate de haber instalado y abierto OpenCode Desktop al menos una vez.");
  process.exit(1);
}

const isNpxExecution = __dirname.includes('npm-cache')
  || __dirname.includes('_npx')
  || __dirname.includes('.npm');

const localPluginsDir = path.join(__dirname, 'plugins');
const localAgentsDir = path.join(__dirname, 'agents');
const localSkillsDir = path.join(__dirname, 'skills');
const targetPluginsDir = path.join(configPath, 'plugins');
const targetAgentsDir = path.join(configPath, 'agents');
const targetSkillsDir = path.join(configPath, 'skills');
const globalAgentsSkillsDir = path.join(os.homedir(), '.agents', 'skills');

async function copyDirectoryAsync(src, dest) {
  if (!fs.existsSync(src)) return 0;
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcFile = path.join(src, entry.name);
    const destFile = path.join(dest, entry.name);
    if (entry.isFile()) {
      await fsp.copyFile(srcFile, destFile);
    } else if (entry.isDirectory()) {
      await copyDirectoryAsync(srcFile, destFile);
    }
    count++;
  }
  return count;
}

(async () => {
  try {
    console.log("📂 Copiando agentes, plugins y skills...");
    const pluginsCount = await copyDirectoryAsync(localPluginsDir, targetPluginsDir);
    console.log(`✅ Copiados ${pluginsCount} plugins a ${targetPluginsDir}`);
    const agentsCount = await copyDirectoryAsync(localAgentsDir, targetAgentsDir);
    console.log(`✅ Copiados ${agentsCount} agentes a ${targetAgentsDir}`);
    const skillsCount = await copyDirectoryAsync(localSkillsDir, targetSkillsDir);
    await copyDirectoryAsync(localSkillsDir, globalAgentsSkillsDir);
    console.log(`✅ Copiadas ${skillsCount} skills a ${targetSkillsDir} y ${globalAgentsSkillsDir}`);
  } catch (e) {
    console.error("❌ Error copiando archivos:", e.message);
    process.exit(1);
  }

  console.log("⚙️ Registrando plugins, comandos slash y configuraciones en OpenCode...");

  const configPathJsonc = path.join(configPath, 'opencode.jsonc');
  const configPathJson = path.join(configPath, 'opencode.json');
  let configFile = null;

  if (fs.existsSync(configPathJsonc)) {
    configFile = configPathJsonc;
  } else if (fs.existsSync(configPathJson)) {
    configFile = configPathJson;
  } else {
    console.log("⚠️ No se encontró opencode.json ni opencode.jsonc.");
    console.log("Creando opencode.jsonc por defecto...");
    configFile = configPathJsonc;
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        "$schema": "https://opencode.ai/config.json",
        "default_agent": "orchestrator",
        "permission": {
          "external_directory": {
            "*": "allow"
          }
        },
        "command": {
          "sdlc": {
            "template": "Inicia el flujo completo SDLC para: {{input}}",
            "description": "Ejecutar flujo multi-agente SDLC completo",
            "agent": "orchestrator"
          },
          "plan": {
            "template": "Analiza y genera un plan estructurado para: {{input}}",
            "description": "Planificar cambios con el agente @sdlc-planner",
            "agent": "sdlc-planner"
          },
          "review": {
            "template": "Revisa las diferencias de código y seguridad en git",
            "description": "Revisión de código con @sdlc-reviewer",
            "agent": "sdlc-reviewer"
          },
          "test": {
            "template": "Ejecuta y verifica las pruebas de la aplicación",
            "description": "Diagnóstico y ejecución de tests con @sdlc-tester",
            "agent": "sdlc-tester"
          },
          "docs": {
            "template": "Genera y actualiza la documentación del proyecto",
            "description": "Actualizar documentación con @sdlc-documenter",
            "agent": "sdlc-documenter"
          }
        },
        "compaction": {
          "auto": true,
          "prune": false,
          "tail_turns": 2
        },
        "plugin": []
      }, null, 4)
    );
  }

  const pluginFiles = [
    'InitPlugin.ts',
    'ContextLoaderPlugin.ts',
    'AutoDiscoveryPlugin.ts',
    'StateTrackerPlugin.ts',
    'ActionValidatorPlugin.ts',
    'CleanupPlugin.ts',
  ];

  let pluginsToRegister;
  if (isNpxExecution) {
    pluginsToRegister = pluginFiles.map(
      (f) => path.join(targetPluginsDir, f).replace(/\\/g, '/')
    );
  } else {
    pluginsToRegister = pluginFiles.map((f) => `./plugins/${f}`);
  }

  try {
    let content = fs.readFileSync(configFile, 'utf8').replace(/^\uFEFF/, '');

    try {
      const stripped = content.replace(/("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g, (m, s) => s || "");
      const configObj = JSON.parse(stripped);

      if (!Array.isArray(configObj.plugin)) configObj.plugin = [];
      for (const p of pluginsToRegister) {
        if (!configObj.plugin.includes(p)) {
          configObj.plugin.push(p);
        }
      }

      configObj.default_agent = "orchestrator";

      if (!configObj.permission) configObj.permission = {};
      if (!configObj.permission.external_directory) {
        configObj.permission.external_directory = { "*": "allow" };
      }

      if (!configObj.command) configObj.command = {};
      configObj.command["sdlc"] = {
        template: "Inicia el flujo completo SDLC para: {{input}}",
        description: "Ejecutar flujo multi-agente SDLC completo",
        agent: "orchestrator"
      };
      configObj.command["plan"] = {
        template: "Analiza y genera un plan estructurado para: {{input}}",
        description: "Planificar cambios con el agente @sdlc-planner",
        agent: "orchestrator"
      };
      configObj.command["review"] = {
        template: "Revisa las diferencias de código y seguridad en git",
        description: "Revisión de código con @sdlc-reviewer",
        agent: "orchestrator"
      };
      configObj.command["test"] = {
        template: "Ejecuta y verifica las pruebas de la aplicación",
        description: "Diagnóstico y ejecución de tests con @sdlc-tester",
        agent: "orchestrator"
      };
      configObj.command["docs"] = {
        template: "Genera y actualiza la documentación del proyecto",
        description: "Actualizar documentación con @sdlc-documenter",
        agent: "orchestrator"
      };

      if (!configObj.agent) configObj.agent = {};
      const subagentKeys = ['sdlc-planner', 'sdlc-explorer', 'sdlc-implementer', 'sdlc-reviewer', 'sdlc-tester', 'sdlc-documenter'];
      for (const k of subagentKeys) {
        if (!configObj.agent[k]) configObj.agent[k] = {};
        configObj.agent[k].hidden = true;
        configObj.agent[k].mode = 'subagent';
      }

      if (!configObj.compaction) {
        configObj.compaction = {
          auto: true,
          prune: false,
          tail_turns: 2
        };
      }

      configObj.instructions = [
        "CAVEMAN TOKEN-SAVER MODE HYPER-TERSE: Zero filler/greetings, zero explanatory story paragraphs, zero duplicate summary tables, zero conversational questions at end, EXACTLY 1 LINE per finding/bullet point."
      ];

      fs.writeFileSync(configFile, JSON.stringify(configObj, null, 2), 'utf8');
      console.log("✅ Se registraron los plugins, comandos slash (/sdlc, /plan, /review, /test, /docs) y configuración en " + path.basename(configFile) + ".");
    } catch (parseError) {
      console.error(
        "⚠️ No se pudo inyectar automáticamente en tu opencode.json(c) por un error de formato."
      );
      console.log("Por favor, añade manualmente los plugins en tu archivo de configuración:");
      console.log(JSON.stringify(pluginsToRegister, null, 2));
    }
  } catch (e) {
    console.error("❌ Error actualizando la configuración:", e.message);
    process.exit(1);
  }

  console.log("\n🎉 ¡Instalación completada con éxito!");
  if (platform === 'win32') {
    console.log(`📍 Configuración escrita en: ${configPath}`);
    console.log("    (equivalente a %USERPROFILE%\\.config\\opencode)");
  } else if (platform === 'darwin') {
    console.log(`📍 Configuración escrita en: ${configPath}`);
    console.log("    (no en ~/Library/Application Support — OpenCode usa XDG en macOS)");
  } else {
    console.log(`📍 Configuración escrita en: ${configPath}`);
    console.log("    (XDG_CONFIG_HOME/.config/opencode)");
  }
  console.log("👉 REINICIA OpenCode Desktop para aplicar los cambios.");
  console.log("👉 Usa el agente @orchestrator o los comandos /sdlc, /plan, /review, /test, /docs en tu chat.");
})();
