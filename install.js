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
const targetPluginsDir = path.join(configPath, 'plugins');
const targetAgentsDir = path.join(configPath, 'agents');

async function copyDirectoryAsync(src, dest) {
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
    console.log("📂 Copiando agentes y plugins...");
    const pluginsCount = await copyDirectoryAsync(localPluginsDir, targetPluginsDir);
    console.log(`✅ Copiados ${pluginsCount} plugins a ${targetPluginsDir}`);
    const agentsCount = await copyDirectoryAsync(localAgentsDir, targetAgentsDir);
    console.log(`✅ Copiados ${agentsCount} agentes a ${targetAgentsDir}`);
  } catch (e) {
    console.error("❌ Error copiando archivos:", e.message);
    process.exit(1);
  }

  console.log("⚙️ Registrando plugins en la configuración de OpenCode...");

  const configPathJsonc = path.join(configPath, 'opencode.jsonc');
  const configPathJson = path.join(configPath, 'opencode.json');
  let configFile = null;
  let isJsonc = false;

  if (fs.existsSync(configPathJsonc)) {
    configFile = configPathJsonc;
    isJsonc = true;
  } else if (fs.existsSync(configPathJson)) {
    configFile = configPathJson;
  } else {
    console.log("⚠️ No se encontró opencode.json ni opencode.jsonc.");
    console.log("Creando un opencode.json básico...");
    configFile = configPathJson;
    fs.writeFileSync(
      configFile,
      JSON.stringify({ "$schema": "https://opencode.ai/config.json", plugin: [] }, null, 4)
    );
  }

  const pluginFiles = [
    'InitPlugin.ts',
    'ContextLoaderPlugin.ts',
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
    let content = fs.readFileSync(configFile, 'utf8');

    try {
      const stripped = content.replace(/("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g, (m, s) => s || "");
      const configObj = JSON.parse(stripped);
      if (!Array.isArray(configObj.plugin)) configObj.plugin = [];

      let added = 0;
      for (const p of pluginsToRegister) {
        if (!configObj.plugin.includes(p)) {
          configObj.plugin.push(p);
          added++;
        }
      }

      if (added > 0) {
        // Remove existing "plugin" key if present
        content = content.replace(/,\s*"plugin"\s*:\s*\[[\s\S]*?\]/, "");
        // Build clean array and append before the final closing brace
        const pluginLines = configObj.plugin.map(p => '        "' + p + '"').join(",\n");
        content = content.replace(
          /([\s\S]*)}\s*$/,
          (match, before) => before + ',\n    "plugin": [\n' + pluginLines + '\n    ]\n}'
        );
        content = content.replace(/,\s*\]/g, "]");
        fs.writeFileSync(configFile, content);
        console.log("\u2705 Se registraron los plugins en " + path.basename(configFile) + " (" + added + " nuevos).");
      } else {
        console.log("\u2705 Los plugins ya estaban registrados.");
      }
    } catch (parseError) {
      console.error(
        "\u26a0\ufe0f No se pudo inyectar autom\u00e1ticamente en tu opencode.json(c) por un error de formato."
      );
      console.log("Por favor, a\u00f1ade manualmente lo siguiente en tu array 'plugin':");
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
  console.log("👉 Usa el agente @orchestrator en tu chat para empezar a trabajar.");
})();
