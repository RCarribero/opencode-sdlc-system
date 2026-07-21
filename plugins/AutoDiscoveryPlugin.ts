import * as fs from 'fs';
import * as path from 'path';

/*
 * ============================================================================
 * AutoDiscoveryPlugin
 * ----------------------------------------------------------------------------
 * Hook de auto-descubrimiento que:
 *   1. Detecta si el proyecto es nuevo (carpeta .agents/ no existe)
 *   2. Escanea package.json, Cargo.toml, go.mod, requirements.txt, pyproject.toml
 *   3. Identifica la pila tecnológica
 *   4. Configura automáticamente Skills y MCP servers relevantes
 *   5. Para servicios que requieren API Key (Stripe, etc.), envía un mensaje
 *      proactivo al chat con instrucciones exactas
 * ============================================================================
 */

/* ---------------------------------------------------------------------------
 * Catálogo de integraciones MCP conocidas
 * Cada entrada define: tecnología que la dispara, comando MCP, args, y
 * metadatos para el mensaje al usuario.
 * -------------------------------------------------------------------------*/
interface McpEntry {
  id: string;
  displayName: string;
  packageName: string;
  command: string;
  args: string[];
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  apiKeyUrl?: string;
  apiKeyFieldLabel?: string;
  installNote?: string;
}

const MCP_REGISTRY: Record<string, McpEntry> = {
  stripe: {
    id: 'stripe',
    displayName: 'Stripe MCP',
    packageName: '@stripe/mcp',
    command: 'npx',
    args: ['-y', '@stripe/mcp', '--api-key', '${STRIPE_API_KEY}'],
    requiresApiKey: true,
    apiKeyEnvVar: 'STRIPE_API_KEY',
    apiKeyUrl: 'https://dashboard.stripe.com/apikeys',
    apiKeyFieldLabel: 'Stripe Secret Key (sk_live_... o sk_test_...)',
    installNote:
      '1. Ve a https://dashboard.stripe.com/apikeys\n' +
      '2. Crea o copia una Secret Key (sk_test_...)\n' +
      '3. En OpenCode: Settings → MCP Servers → Stripe → pega la key\n' +
      '   O define la variable de entorno STRIPE_API_KEY\n' +
      '4. Reinicia OpenCode Desktop para que el MCP se active',
  },
  supabase: {
    id: 'supabase',
    displayName: 'Supabase MCP',
    packageName: '@supabase/mcp-server-supabase',
    command: 'npx',
    args: ['-y', '@supabase/mcp-server-supabase'],
    requiresApiKey: true,
    apiKeyEnvVar: 'SUPABASE_URL',
    apiKeyUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    apiKeyFieldLabel: 'Supabase URL + anon/service key',
    installNote:
      '1. Ve a https://supabase.com/dashboard/project/<tu-proyecto>/settings/api\n' +
      '2. Copia la Project URL y la service_role key\n' +
      '3. Configúralas como SUPABASE_URL y SUPABASE_SERVICE_KEY\n' +
      '4. Reinicia OpenCode',
  },
  postgres: {
    id: 'postgres',
    displayName: 'PostgreSQL MCP',
    packageName: '@anthropic/mcp-postgres',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-postgres'],
    requiresApiKey: false,
    installNote: 'Se configura con variable de entorno DATABASE_URL',
  },
  github: {
    id: 'github',
    displayName: 'GitHub MCP',
    packageName: '@anthropic/mcp-github',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-github'],
    requiresApiKey: true,
    apiKeyEnvVar: 'GITHUB_TOKEN',
    apiKeyUrl: 'https://github.com/settings/tokens',
    apiKeyFieldLabel: 'GitHub Personal Access Token (classic, repo scope)',
    installNote:
      '1. Ve a https://github.com/settings/tokens\n' +
      '2. Genera un token con scope repo y workflow\n' +
      '3. Configúralo como GITHUB_TOKEN\n' +
      '4. Reinicia OpenCode',
  },
  sentry: {
    id: 'sentry',
    displayName: 'Sentry MCP',
    packageName: '@getsentry/mcp',
    command: 'npx',
    args: ['-y', '@getsentry/mcp'],
    requiresApiKey: true,
    apiKeyEnvVar: 'SENTRY_AUTH_TOKEN',
    apiKeyUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
    apiKeyFieldLabel: 'Sentry Auth Token',
    installNote:
      '1. Ve a https://sentry.io/settings/account/api/auth-tokens/\n' +
      '2. Crea un token con los scopes necesarios\n' +
      '3. Configúralo como SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT\n' +
      '4. Reinicia OpenCode',
  },
  vercel: {
    id: 'vercel',
    displayName: 'Vercel MCP',
    packageName: '@anthropic/mcp-vercel',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-vercel'],
    requiresApiKey: true,
    apiKeyEnvVar: 'VERCEL_TOKEN',
    apiKeyUrl: 'https://vercel.com/account/tokens',
    apiKeyFieldLabel: 'Vercel Access Token',
    installNote:
      '1. Ve a https://vercel.com/account/tokens\n' +
      '2. Crea un token\n' +
      '3. Configúralo como VERCEL_TOKEN\n' +
      '4. Reinicia OpenCode',
  },
  aws: {
    id: 'aws',
    displayName: 'AWS MCP',
    packageName: '@anthropic/mcp-aws',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-aws'],
    requiresApiKey: true,
    apiKeyEnvVar: 'AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY',
    apiKeyUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
    apiKeyFieldLabel: 'AWS Access Key ID + Secret Access Key',
    installNote:
      '1. Ve a https://console.aws.amazon.com/iam/home#/security_credentials\n' +
      '2. Crea una Access Key\n' +
      '3. Configura AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY y AWS_REGION\n' +
      '4. Reinicia OpenCode',
  },
  jira: {
    id: 'jira',
    displayName: 'Jira MCP',
    packageName: '@anthropic/mcp-jira',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-jira'],
    requiresApiKey: true,
    apiKeyEnvVar: 'JIRA_API_TOKEN',
    apiKeyUrl: 'https://id.atlassian.com/manage/api-tokens',
    apiKeyFieldLabel: 'Jira API Token + JIRA_URL + JIRA_EMAIL',
    installNote:
      '1. Ve a https://id.atlassian.com/manage/api-tokens\n' +
      '2. Crea un API token\n' +
      '3. Configura JIRA_URL, JIRA_EMAIL y JIRA_API_TOKEN\n' +
      '4. Reinicia OpenCode',
  },
};

/* Detección: mapea nombres de paquetes npm a entradas MCP */
const PACKAGE_TO_MCP: Record<string, string[]> = {
  stripe: ['stripe'],
  '@stripe/react-stripe-js': ['stripe'],
  supabase: ['supabase'],
  '@supabase/supabase-js': ['supabase'],
  pg: ['postgres'],
  'pg-promise': ['postgres'],
  '@sentry/node': ['sentry'],
  '@sentry/react': ['sentry'],
  '@sentry/nextjs': ['sentry'],
  '@octokit/rest': ['github'],
  '@anthropic/mcp-github': ['github'],
};

/* ---------------------------------------------------------------------------
 * Estructura de tecnología detectada
 * -------------------------------------------------------------------------*/
interface DetectedTech {
  packageName: string;
  version?: string;
  isDev: boolean;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/
function getProjectDir(ctx: any): string | null {
  const dir = ctx.directory || ctx.project?.directory;
  if (!dir || dir === 'C:\\' || dir === 'C:/' || dir === '/') return null;
  return dir;
}

function readJsonSafe(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    /* ignorar */
  }
  return null;
}

/** Escanea package.json y extrae todas las dependencias */
function scanPackageJson(projectDir: string): DetectedTech[] {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = readJsonSafe(pkgPath);
  if (!pkg) return [];

  const result: DetectedTech[] = [];
  const seen = new Set<string>();

  const add = (deps: Record<string, string> | undefined, isDev: boolean) => {
    if (!deps) return;
    for (const [name, ver] of Object.entries(deps)) {
      if (!seen.has(name)) {
        seen.add(name);
        result.push({ packageName: name, version: ver as string, isDev });
      }
    }
  };

  add(pkg.dependencies, false);
  add(pkg.devDependencies, true);
  return result;
}

/** Escanea Cargo.toml buscando dependencias Rust */
function scanCargoToml(projectDir: string): DetectedTech[] {
  const cargoPath = path.join(projectDir, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return [];
  try {
    const content = fs.readFileSync(cargoPath, 'utf8');
    const result: DetectedTech[] = [];
    const depSection = content.match(/\[dependencies\]([^[]*)/);
    if (depSection) {
      const lines = depSection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*(\S+)\s*=/);
        if (match) {
          result.push({ packageName: match[1], isDev: false });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** Escanea go.mod buscando dependencias Go */
function scanGoMod(projectDir: string): DetectedTech[] {
  const goPath = path.join(projectDir, 'go.mod');
  if (!fs.existsSync(goPath)) return [];
  try {
    const content = fs.readFileSync(goPath, 'utf8');
    const result: DetectedTech[] = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^\s+(\S+)\s+/);
      if (match) {
        result.push({ packageName: match[1], isDev: false });
      }
    }
    return result;
  } catch {
    return [];
  }
}

/** Escanea requirements.txt / pyproject.toml buscando Python packages */
function scanPythonDeps(projectDir: string): DetectedTech[] {
  const result: DetectedTech[] = [];

  const reqPath = path.join(projectDir, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-')) {
          const pkgMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)/);
          if (pkgMatch) {
            result.push({ packageName: pkgMatch[1].toLowerCase(), isDev: false });
          }
        }
      }
    } catch { /* ignorar */ }
  }

  const pyprojectPath = path.join(projectDir, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, 'utf8');
      const depSection = content.match(/\[tool\.poetry\.dependencies\]([^[]*)/);
      if (depSection) {
        for (const line of depSection[1].split('\n')) {
          const match = line.match(/^\s*(\S+)\s*=/);
          if (match && match[1] !== 'python') {
            result.push({ packageName: match[1].toLowerCase(), isDev: false });
          }
        }
      }
    } catch { /* ignorar */ }
  }

  return result;
}

/** Resuelve qué MCP servers aplicar según las tecnologías detectadas */
function resolveMcpServers(deps: DetectedTech[]): Set<string> {
  const mcpIds = new Set<string>();

  for (const dep of deps) {
    const pkgName = dep.packageName.toLowerCase();

    // Coincidencia exacta en el registro
    if (MCP_REGISTRY[pkgName]) {
      mcpIds.add(pkgName);
    }

    // Coincidencia por mapeo paquete → MCP
    const mapped = PACKAGE_TO_MCP[pkgName];
    if (mapped) {
      for (const id of mapped) mcpIds.add(id);
    }

    // Coincidencia por substring (ej. sentry en @sentry/xyz)
    for (const [key, ids] of Object.entries(PACKAGE_TO_MCP)) {
      if (pkgName.includes(key)) {
        for (const id of ids) mcpIds.add(id);
      }
    }

    // Coincidencia en el registro por substring
    for (const [mcpId, entry] of Object.entries(MCP_REGISTRY)) {
      if (pkgName.includes(mcpId)) {
        mcpIds.add(mcpId);
      }
    }
  }

  return mcpIds;
}

/** Lee la configuración de OpenCode (opencode.json / opencode.jsonc) */
function getOpenCodeConfigPath(): string | null {
  const homeDir = process.env.OPENCODE_CONFIG_DIR
    || path.join(require('os').homedir(), '.config', 'opencode');
  console.log('[AutoDiscoveryPlugin] getOpenCodeConfigPath homeDir:', homeDir);

  const jsonc = path.join(homeDir, 'opencode.jsonc');
  const json = path.join(homeDir, 'opencode.json');

  if (fs.existsSync(jsonc)) {
    console.log('[AutoDiscoveryPlugin] encontrado opencode.jsonc');
    return jsonc;
  }
  if (fs.existsSync(json)) {
    console.log('[AutoDiscoveryPlugin] encontrado opencode.json');
    return json;
  }
  console.log('[AutoDiscoveryPlugin] NO encontrado opencode.json ni .jsonc');
  return null;
}

/** Añade entradas MCP a la configuración de OpenCode */
function registerMcpInConfig(mcpIds: Set<string>): { configured: string[]; pendingKeys: string[] } {
  const configPath = getOpenCodeConfigPath();
  if (!configPath) {
    console.log('[AutoDiscoveryPlugin] registerMcpInConfig: sin configPath, abortando');
    return { configured: [], pendingKeys: [] };
  }
  console.log('[AutoDiscoveryPlugin] registerMcpInConfig configPath:', configPath);

  try {
    let content = fs.readFileSync(configPath, 'utf8');
    console.log('[AutoDiscoveryPlugin] config leído, longitud:', content.length);
    let config: any;

    try {
      const stripped = content.replace(
        /("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g,
        (m: string, s: string) => s || ''
      );
      config = JSON.parse(stripped);
      console.log('[AutoDiscoveryPlugin] config parseado OK, tiene mcpServers:', !!config.mcpServers);
    } catch (e) {
      console.log('[AutoDiscoveryPlugin] error parseando config:', e);
      return { configured: [], pendingKeys: [] };
    }

    if (!config.mcpServers) config.mcpServers = {};

    const configured: string[] = [];
    const pendingKeys: string[] = [];

    for (const mcpId of mcpIds) {
      const entry = MCP_REGISTRY[mcpId];
      if (!entry) {
        console.log('[AutoDiscoveryPlugin] MCP no encontrado en registro:', mcpId);
        continue;
      }

      if (config.mcpServers[mcpId]) {
        console.log('[AutoDiscoveryPlugin] MCP ya configurado:', mcpId);
        configured.push(mcpId);
        continue;
      }

      const serverConfig: any = {
        command: entry.command,
        args: entry.args,
      };

      config.mcpServers[mcpId] = serverConfig;
      configured.push(mcpId);
      console.log('[AutoDiscoveryPlugin] MCP registrado:', mcpId, 'requiresApiKey:', !!entry.requiresApiKey);

      if (entry.requiresApiKey) {
        pendingKeys.push(mcpId);
      }
    }

    if (configured.length > 0) {
      content = content.replace(/,\s*"mcpServers"\s*:\s*\{[\s\S]*?\}/, '');
      console.log('[AutoDiscoveryPlugin] mcpServers existente eliminado del content');

      content = content.replace(
        /([\s\S]*)\}\s*$/,
        (match: string, before: string) =>
          (before.endsWith(',') || before.endsWith('{') ? before : before + ',') +
          '\n    "mcpServers": ' + JSON.stringify(config.mcpServers, null, 4) + '\n}'
      );

      fs.writeFileSync(configPath, content, 'utf8');
      console.log('[AutoDiscoveryPlugin] opencode.json actualizado con mcpServers');
    } else {
      console.log('[AutoDiscoveryPlugin] no hay MCPs nuevos que configurar');
    }

    return { configured, pendingKeys };
  } catch (e) {
    console.log('[AutoDiscoveryPlugin] error en registerMcpInConfig:', e);
    return { configured: [], pendingKeys: [] };
  }
}

/** Construye el mensaje proactivo para el chat */
function buildProactiveMessage(
  configured: string[],
  pendingKeys: string[]
): string {
  const parts: string[] = [];

  if (configured.length === 0 && pendingKeys.length === 0) return '';

  parts.push('🔧 **AutoDiscoveryPlugin** — Configuración automática completada\n');

  if (configured.length > 0) {
    parts.push(
      '### MCP Servers configurados\n' +
      configured.map((id) => {
        const entry = MCP_REGISTRY[id];
        return `- **${entry?.displayName || id}** \`npx ${entry?.packageName || ''}\``;
      }).join('\n')
    );
  }

  if (pendingKeys.length > 0) {
    parts.push('\n### ⚠️ API Keys requeridas\n');
    for (const id of pendingKeys) {
      const entry = MCP_REGISTRY[id];
      if (!entry) continue;

      parts.push(`#### ${entry.displayName}`);
      parts.push(`- **Dashboard:** ${entry.apiKeyUrl}`);
      parts.push(`- **Variable:** \`${entry.apiKeyEnvVar}\``);
      parts.push(`- **Qué pegar:** ${entry.apiKeyFieldLabel}`);
      parts.push(`- **Instrucciones:**`);
      parts.push('  ```');
      parts.push(entry.installNote);
      parts.push('  ```');
      parts.push('');
    }
    parts.push(
      'Una vez configuradas las keys, **reinicia OpenCode Desktop** para que los MCPs se activen.'
    );
  }

  return parts.join('\n');
}

/** Construye un resumen legible del stack detectado para la instrucción al orquestador */
function buildStackSummary(deps: DetectedTech[]): string {
  const frameworks = new Set<string>();
  const languages = new Set<string>();
  const highlights: string[] = [];

  for (const dep of deps) {
    const pkg = dep.packageName.toLowerCase();
    if (pkg === 'next' || pkg === 'next.js') frameworks.add('Next.js');
    else if (pkg === 'react') frameworks.add('React');
    else if (pkg === 'vue' || pkg === 'nuxt') frameworks.add('Vue');
    else if (pkg === 'express') frameworks.add('Express');
    else if (pkg === 'fastify') frameworks.add('Fastify');
    else if (pkg === '@angular/core') frameworks.add('Angular');
    else if (pkg === 'svelte' || pkg === '@sveltejs/kit') frameworks.add('Svelte');
    else if (pkg.includes('stripe')) highlights.push('stripe');
    else if (pkg.includes('supabase')) highlights.push('supabase');
    else if (pkg === 'pg' || pkg.includes('postgres') || pkg.includes('prisma')) highlights.push('database');
    else if (pkg.includes('sentry')) highlights.push('sentry');
    else if (pkg.includes('aws')) highlights.push('aws');
    else if (pkg === 'vitest' || pkg === 'jest' || pkg === 'mocha' || pkg === 'playwright') highlights.push('testing');
  }

  if (deps.some((d) => d.packageName.endsWith('.ts') || d.packageName === 'typescript')) languages.add('TypeScript');
  languages.add('JavaScript');

  const parts: string[] = [];
  if (frameworks.size > 0) parts.push(Array.from(frameworks).join(', '));
  if (highlights.length > 0) parts.push('integrations: ' + highlights.join(', '));
  parts.push(Array.from(languages).join(', '));

  return parts.join(' | ') || 'JavaScript';
}

/* ---------------------------------------------------------------------------
 * Export del plugin
 * -------------------------------------------------------------------------*/
export default {
  id: 'AutoDiscoveryPlugin',
  async server(ctx: any) {
    const projectDir = getProjectDir(ctx);
    let discoveryDone = false;
    let isNewProject = false;

    console.log('[AutoDiscoveryPlugin] server() iniciado, projectDir:', projectDir);

    return {
      /* ---------------------------------------------------------------
       * session.created — Determinar si el proyecto es nuevo
       * ---------------------------------------------------------------*/
      async event({ event }: any) {
        if (event.type === 'session.created') {
          discoveryDone = false;
          console.log('[AutoDiscoveryPlugin] session.created disparado');

          if (projectDir) {
            const agentsDir = path.join(projectDir, '.agents');
            isNewProject = !fs.existsSync(agentsDir);
            console.log('[AutoDiscoveryPlugin] isNewProject:', isNewProject, 'agentsDir:', agentsDir);

            if (isNewProject) {
              try {
                fs.mkdirSync(agentsDir, { recursive: true });
                console.log('[AutoDiscoveryPlugin] .agents/ creado');
              } catch (e) {
                console.log('[AutoDiscoveryPlugin] error creando .agents/', e);
              }
            }
          } else {
            console.log('[AutoDiscoveryPlugin] projectDir es null, no se puede continuar');
          }
        }
      },

      /* ---------------------------------------------------------------
       * experimental.chat.messages.transform
       * Se ejecuta después de que ContextLoaderPlugin haya inyectado el
       * contexto. Aquí escaneamos el proyecto y configuramos MCPs.
       * ---------------------------------------------------------------*/
      async ['experimental.chat.messages.transform'](input: any, output: any) {
        if (discoveryDone || !projectDir) {
          console.log('[AutoDiscoveryPlugin] messages.transform saltado: discoveryDone=' + discoveryDone + ', projectDir=' + projectDir);
          return;
        }
        discoveryDone = true;
        console.log('[AutoDiscoveryPlugin] messages.transform iniciado, projectDir:', projectDir);

        const allDeps: DetectedTech[] = [
          ...scanPackageJson(projectDir),
          ...scanCargoToml(projectDir),
          ...scanGoMod(projectDir),
          ...scanPythonDeps(projectDir),
        ];
        console.log('[AutoDiscoveryPlugin] dependencias detectadas:', allDeps.length);

        if (allDeps.length === 0) {
          console.log('[AutoDiscoveryPlugin] 0 dependencias, abortando');
          return;
        }

        const mcpIds = resolveMcpServers(allDeps);
        console.log('[AutoDiscoveryPlugin] MCPs resueltos:', Array.from(mcpIds));

        if (mcpIds.size === 0 && !isNewProject) {
          console.log('[AutoDiscoveryPlugin] sin MCPs y proyecto existente, abortando');
          return;
        }

        const { configured, pendingKeys } = registerMcpInConfig(mcpIds);
        console.log('[AutoDiscoveryPlugin] MCPs configurados:', configured, 'pendingKeys:', pendingKeys);

        if (projectDir) {
          try {
            const resultPath = path.join(projectDir, '.agents', 'auto-discovery.json');
            const result = {
              detectedAt: new Date().toISOString(),
              isNewProject,
              dependenciesFound: allDeps.length,
              mcpConfigured: configured,
              mcpPendingKeys: pendingKeys,
              stackSummary: buildStackSummary(allDeps),
            };
            fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
            console.log('[AutoDiscoveryPlugin] auto-discovery.json escrito en:', resultPath);
          } catch (e) {
            console.log('[AutoDiscoveryPlugin] error escribiendo auto-discovery.json:', e);
          }
        }

      },

      /* ---------------------------------------------------------------
       * experimental.chat.system.transform
       * Inyecta en el system prompt:
       *   - El reporte de MCPs configurados
       *   - Si es proyecto nuevo: instrucción dinámica al orquestador
       *     para que use find-skills y descubra skills autónomamente
       * ---------------------------------------------------------------*/
      async ['experimental.chat.system.transform'](input: any, output: any) {
        if (!projectDir) {
          console.log('[AutoDiscoveryPlugin] system.transform saltado: sin projectDir');
          return;
        }

        const resultPath = path.join(projectDir, '.agents', 'auto-discovery.json');
        console.log('[AutoDiscoveryPlugin] system.transform buscando:', resultPath);
        if (!fs.existsSync(resultPath)) {
          console.log('[AutoDiscoveryPlugin] auto-discovery.json no existe, abortando');
          return;
        }

        try {
          const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          console.log('[AutoDiscoveryPlugin] auto-discovery.json leído:', JSON.stringify(result).substring(0, 200));
          const sections: string[] = [];

          if (result.mcpConfigured?.length > 0 || result.mcpPendingKeys?.length > 0) {
            const mcpLines: string[] = [
              '### Auto-Discovery Report (.agents/auto-discovery.json)',
              'AutoDiscoveryPlugin configured the following MCP servers for this project:',
            ];
            if (result.mcpConfigured?.length > 0) {
              mcpLines.push('- MCP servers configured: ' + result.mcpConfigured.join(', '));
            }
            if (result.mcpPendingKeys?.length > 0) {
              mcpLines.push('- MCP servers pending API keys: ' + result.mcpPendingKeys.join(', '));
            }
            sections.push(mcpLines.join('\n'));
          }

          if (result.isNewProject && result.stackSummary) {
            sections.push(
              '### 🧠 AUTO-SKILLS: INSTRUCCIÓN OBLIGATORIA PARA EL ORQUESTADOR\n' +
              'SISTEMA: Este es un proyecto nuevo. He analizado el package.json y detectado el stack: **' +
              result.stackSummary +
              '**. Tienes instalada la herramienta find-skills. Tu primera acción obligatoria antes de planificar es usar find-skills para buscar en la comunidad e instalar de forma autónoma las skills más relevantes para estas tecnologías. Evalúa los resultados de búsqueda y elige las mejores.'
            );
          }

          if (sections.length === 0) {
            console.log('[AutoDiscoveryPlugin] sin secciones para inyectar');
            return;
          }

          const injection = `
[SYSTEM NOTIFICATION - AUTO-DISCOVERY]
${sections.join('\n\n')}
---
`;
          console.log('[AutoDiscoveryPlugin] inyección construida, longitud:', injection.length);

          if (output && Array.isArray(output.system)) {
            output.system.push(injection);
            console.log('[AutoDiscoveryPlugin] inyección agregada al system prompt');
          } else {
            console.log('[AutoDiscoveryPlugin] output.system no es un array:', typeof output?.system);
          }
        } catch (e) {
          console.log('[AutoDiscoveryPlugin] error en system.transform:', e);
        }
      },
    };
  },
};
