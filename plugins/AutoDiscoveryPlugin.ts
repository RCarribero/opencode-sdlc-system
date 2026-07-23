import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';

/*
 * ============================================================================
 * AutoDiscoveryPlugin v1.0.7
 * ============================================================================
 * Runs on first message of each session:
 *   1. Scans package.json / Cargo.toml / go.mod / requirements.txt
 *   2. Installs relevant skills to ~/.agents/skills/ (async, non-blocking)
 *   3. Configures MCP servers in PROJECT-level .opencode/opencode.jsonc
 *      (NOT global — writing to global causes OpenCode to reload the session)
 *   4. Persists results to .agents/auto-discovery.json
 *   5. Injects a concise report + skill load instructions into system prompt
 *      for ALL projects (not just new ones)
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// MCP Registry (8 servers)
// ---------------------------------------------------------------------------
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
    args: ['-y', '@stripe/mcp', '--tools=all'],
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

// ---------------------------------------------------------------------------
// Package → MCP mapping
// ---------------------------------------------------------------------------
const PACKAGE_TO_MCP: Record<string, string[]> = {
  stripe: ['stripe'],
  '@stripe/react-stripe-js': ['stripe'],
  '@stripe/stripe-js': ['stripe'],
  supabase: ['supabase'],
  '@supabase/supabase-js': ['supabase'],
  pg: ['postgres'],
  'pg-promise': ['postgres'],
  prisma: ['postgres'],
  '@prisma/client': ['postgres'],
  '@sentry/node': ['sentry'],
  '@sentry/react': ['sentry'],
  '@sentry/nextjs': ['sentry'],
  '@octokit/rest': ['github'],
};

// ---------------------------------------------------------------------------
// Tech → Skill mapping
// ---------------------------------------------------------------------------
const TECH_TO_SKILL: Record<string, string[]> = {
  'stripe': ['stripe-best-practices'],
  '@stripe/react-stripe-js': ['stripe-best-practices'],
  '@stripe/stripe-js': ['stripe-best-practices'],
  'tailwindcss': ['tailwind-design-system'],
};

const SKILL_INSTALL_SOURCE: Record<string, string> = {
  'stripe-best-practices': 'stripe/ai',
  'tailwind-design-system': 'giuseppe-trisciuoglio/developer-kit',
};

// ---------------------------------------------------------------------------
// Detected tech interface
// ---------------------------------------------------------------------------
interface DetectedTech {
  packageName: string;
  version?: string;
  isDev: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getProjectDir(ctx: any): string | null {
  const dir = ctx.directory || ctx.project?.directory;
  if (!dir || dir === 'C:\\' || dir === 'C:/' || dir === '/') return null;
  return dir;
}

function readJsonSafe(filePath: string): any {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Dependency scanners
// ---------------------------------------------------------------------------
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

function scanCargoToml(projectDir: string): DetectedTech[] {
  const cargoPath = path.join(projectDir, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return [];
  try {
    const content = fs.readFileSync(cargoPath, 'utf8');
    const result: DetectedTech[] = [];
    const depSection = content.match(/\[dependencies\]([^[]*)/);
    if (depSection) {
      for (const line of depSection[1].split('\n')) {
        const match = line.match(/^\s*(\S+)\s*=/);
        if (match) result.push({ packageName: match[1], isDev: false });
      }
    }
    return result;
  } catch { return []; }
}

function scanGoMod(projectDir: string): DetectedTech[] {
  const goPath = path.join(projectDir, 'go.mod');
  if (!fs.existsSync(goPath)) return [];
  try {
    const content = fs.readFileSync(goPath, 'utf8');
    const result: DetectedTech[] = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^\s+(\S+)\s+/);
      if (match) result.push({ packageName: match[1], isDev: false });
    }
    return result;
  } catch { return []; }
}

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
          if (pkgMatch) result.push({ packageName: pkgMatch[1].toLowerCase(), isDev: false });
        }
      }
    } catch {}
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
    } catch {}
  }

  return result;
}

// ---------------------------------------------------------------------------
// MCP resolution
// ---------------------------------------------------------------------------
function resolveMcpServers(deps: DetectedTech[]): Set<string> {
  const mcpIds = new Set<string>();
  for (const dep of deps) {
    const pkgName = dep.packageName.toLowerCase();
    if (MCP_REGISTRY[pkgName]) mcpIds.add(pkgName);
    const mapped = PACKAGE_TO_MCP[pkgName];
    if (mapped) for (const id of mapped) mcpIds.add(id);
  }
  return mcpIds;
}

// ---------------------------------------------------------------------------
// Skill resolution + async install
// ---------------------------------------------------------------------------
function resolveSkills(deps: DetectedTech[]): string[] {
  const skillIds = new Set<string>();
  for (const dep of deps) {
    const pkgName = dep.packageName.toLowerCase();
    for (const [key, skills] of Object.entries(TECH_TO_SKILL)) {
      if (pkgName === key || pkgName.includes(key)) {
        for (const s of skills) skillIds.add(s);
      }
    }
  }
  return Array.from(skillIds);
}

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function ensureSkillInProject(skillId: string, projectDir?: string): boolean {
  const globalSkillDir = path.join(os.homedir(), '.agents', 'skills', skillId);
  const hasGlobal = fs.existsSync(path.join(globalSkillDir, 'SKILL.md'));

  if (projectDir && projectDir !== 'C:\\' && projectDir !== 'C:/' && projectDir !== '/') {
    const projectOpencodeSkillDir = path.join(projectDir, '.opencode', 'skills', skillId);
    const projectAgentsSkillDir = path.join(projectDir, '.agents', 'skills', skillId);

    const hasLocalOpencode = fs.existsSync(path.join(projectOpencodeSkillDir, 'SKILL.md'));
    const hasLocalAgents = fs.existsSync(path.join(projectAgentsSkillDir, 'SKILL.md'));

    if (hasGlobal) {
      if (!hasLocalOpencode) copyDirSync(globalSkillDir, projectOpencodeSkillDir);
      if (!hasLocalAgents) copyDirSync(globalSkillDir, projectAgentsSkillDir);
      return true;
    }

    if (hasLocalOpencode || hasLocalAgents) {
      const src = hasLocalOpencode ? projectOpencodeSkillDir : projectAgentsSkillDir;
      if (!hasGlobal) copyDirSync(src, globalSkillDir);
      if (!hasLocalOpencode) copyDirSync(src, projectOpencodeSkillDir);
      if (!hasLocalAgents) copyDirSync(src, projectAgentsSkillDir);
      return true;
    }
  }

  return hasGlobal;
}

function getInstalledSkills(skillIds: string[], projectDir?: string): string[] {
  return skillIds.filter(id => ensureSkillInProject(id, projectDir));
}

function installMissingSkillsAsync(skillIds: string[], projectDir: string): void {
  for (const skillId of skillIds) {
    if (ensureSkillInProject(skillId, projectDir)) continue;
    const source = SKILL_INSTALL_SOURCE[skillId];
    if (source) {
      exec(`npx skills add ${source}@${skillId} -g -y`, { windowsHide: true }, (err) => {
        if (err) {
          console.error(`[AutoDiscoveryPlugin] Error installing skill ${skillId}:`, err.message);
        } else {
          console.log(`[AutoDiscoveryPlugin] Skill installed: ${skillId}`);
          ensureSkillInProject(skillId, projectDir);
          try {
            const resultPath = path.join(projectDir, '.agents', 'auto-discovery.json');
            if (fs.existsSync(resultPath)) {
              const res = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
              res.skillsInstalled = getInstalledSkills(res.skillsDetected || [], projectDir);
              fs.writeFileSync(resultPath, JSON.stringify(res, null, 2), 'utf8');
            }
          } catch {}
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Stack summary builder
// ---------------------------------------------------------------------------
function buildStackSummary(deps: DetectedTech[]): string {
  const frameworks = new Set<string>();
  const highlights: string[] = [];

  for (const dep of deps) {
    const pkg = dep.packageName.toLowerCase();
    if (pkg === 'next') frameworks.add('Next.js');
    else if (pkg === 'react') frameworks.add('React');
    else if (pkg === 'vue' || pkg === 'nuxt') frameworks.add('Vue');
    else if (pkg === 'express') frameworks.add('Express');
    else if (pkg === 'fastify') frameworks.add('Fastify');
    else if (pkg === '@angular/core') frameworks.add('Angular');
    else if (pkg === 'svelte' || pkg === '@sveltejs/kit') frameworks.add('Svelte');
    else if (pkg.includes('stripe')) highlights.push('stripe');
    else if (pkg.includes('supabase')) highlights.push('supabase');
    else if (pkg === 'pg' || pkg.includes('prisma')) highlights.push('database');
    else if (pkg.includes('sentry')) highlights.push('sentry');
  }

  const parts: string[] = [];
  if (frameworks.size > 0) parts.push(Array.from(frameworks).join(', '));
  if (highlights.length > 0) parts.push('integrations: ' + [...new Set(highlights)].join(', '));
  return parts.join(' | ') || 'JavaScript/TypeScript';
}

// ---------------------------------------------------------------------------
// MCP config — writes to PROJECT-level .opencode/opencode.jsonc
// NEVER writes to global config (that causes OpenCode to reload the session)
// ---------------------------------------------------------------------------
function setupProjectMcpConfig(
  projectDir: string,
  mcpIds: Set<string>
): { configured: string[]; pendingKeys: string[] } {
  try {
    const opencodeDir = path.join(projectDir, '.opencode');
    const configPath = path.join(opencodeDir, 'opencode.jsonc');

    if (!fs.existsSync(opencodeDir)) {
      fs.mkdirSync(opencodeDir, { recursive: true });
    }

    let config: any = {};
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const stripped = raw.replace(
          /"((?:[^"\\]|\\.)*)"|\/\/.*|\/\*[\s\S]*?\*\//g,
          (m: string, s: string) => (s !== undefined ? `"${s}"` : '')
        );
        config = JSON.parse(stripped);
      } catch { config = {}; }
    }

    if (!config.mcp) config.mcp = {};

    const configured: string[] = [];
    const pendingKeys: string[] = [];

    for (const mcpId of mcpIds) {
      const entry = MCP_REGISTRY[mcpId];
      if (!entry) continue;

      const cmdArray = Array.isArray(entry.command)
        ? entry.command
        : [entry.command, ...(entry.args || [])];

      if (config.mcp[mcpId]) {
        if (typeof config.mcp[mcpId].command === 'string' || !config.mcp[mcpId].enabled) {
          config.mcp[mcpId].type = 'local';
          config.mcp[mcpId].command = cmdArray;
          config.mcp[mcpId].enabled = true;
          delete config.mcp[mcpId].args;
          configured.push(mcpId);
        } else {
          configured.push(mcpId);
        }
        continue;
      }

      config.mcp[mcpId] = {
        type: 'local',
        command: cmdArray,
        enabled: true,
      };
      configured.push(mcpId);

      if (entry.requiresApiKey) pendingKeys.push(mcpId);
    }

    if (configured.length > 0) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }

    return { configured, pendingKeys };
  } catch (e) {
    console.error('[AutoDiscoveryPlugin] Error in setupProjectMcpConfig:', e);
    return { configured: [], pendingKeys: [] };
  }
}

// ---------------------------------------------------------------------------
// Plugin export
// ---------------------------------------------------------------------------
export default {
  id: 'AutoDiscoveryPlugin',
  async server(ctx: any) {
    const projectDir = getProjectDir(ctx);
    let discoveryDone = false;
    let isNewProject = false;

    return {
      // -----------------------------------------------------------------
      // session.created — detect if project is new
      // -----------------------------------------------------------------
      async event({ event }: any) {
        if (event.type === 'session.created') {
          discoveryDone = false;
          if (projectDir) {
            const agentsDir = path.join(projectDir, '.agents');
            isNewProject = !fs.existsSync(agentsDir);
            if (isNewProject) {
              try { fs.mkdirSync(agentsDir, { recursive: true }); } catch {}
            }
          }
        }
      },

      // -----------------------------------------------------------------
      // experimental.chat.messages.transform
      // Runs ONCE per session on the first message.
      // Scans deps, installs skills, configures project-level MCPs,
      // persists auto-discovery.json.
      // Does NOT push to output.messages (that consumes the model's turn).
      // -----------------------------------------------------------------
      async ['experimental.chat.messages.transform'](input: any, output: any) {
        if (discoveryDone || !projectDir) return;

        // 1. Scan all dependency manifests
        const allDeps: DetectedTech[] = [
          ...scanPackageJson(projectDir),
          ...scanCargoToml(projectDir),
          ...scanGoMod(projectDir),
          ...scanPythonDeps(projectDir),
        ];
        if (allDeps.length === 0) return;

        discoveryDone = true;

        // 2. Resolve MCPs and skills
        const mcpIds = resolveMcpServers(allDeps);
        const skillIds = resolveSkills(allDeps);
        const installedSkills = getInstalledSkills(skillIds, projectDir);

        // 3. Install any missing skills (async, non-blocking)
        installMissingSkillsAsync(skillIds, projectDir);

        // 4. Configure MCPs in PROJECT-level config (deferred to avoid blocking)
        const pendingKeys = Array.from(mcpIds).filter(id => MCP_REGISTRY[id]?.requiresApiKey);
        if (mcpIds.size > 0) {
          setTimeout(() => {
            try {
              setupProjectMcpConfig(projectDir, mcpIds);
            } catch (e) {
              console.error('[AutoDiscoveryPlugin] Deferred MCP config error:', e);
            }
          }, 100);
        }

        // 5. Persist auto-discovery.json
        try {
          const agentsDir = path.join(projectDir, '.agents');
          if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });

          const resultPath = path.join(agentsDir, 'auto-discovery.json');
          const result = {
            detectedAt: new Date().toISOString(),
            isNewProject,
            dependenciesFound: allDeps.length,
            mcpDetected: Array.from(mcpIds),
            mcpPendingKeys: pendingKeys,
            skillsDetected: skillIds,
            skillsInstalled: installedSkills,
            stackSummary: buildStackSummary(allDeps),
          };
          fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
        } catch (e) {
          console.error('[AutoDiscoveryPlugin] Error writing auto-discovery.json:', e);
        }
      },

      // -----------------------------------------------------------------
      // experimental.chat.system.transform
      // Injects discovery report + skill load instructions into system
      // prompt for EVERY project (not just new ones).
      // -----------------------------------------------------------------
      async ['experimental.chat.system.transform'](input: any, output: any) {
        if (!projectDir) return;

        const resultPath = path.join(projectDir, '.agents', 'auto-discovery.json');
        if (!fs.existsSync(resultPath)) return;

        try {
          const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
          const sections: string[] = [];

          // -- Discovery report header
          sections.push(
            '### Auto-Discovery Report (.agents/auto-discovery.json)\n' +
            'AutoDiscoveryPlugin detected the following for this project:\n' +
            `- Stack: **${result.stackSummary || 'Standard'}**`
          );

          // -- MCP Server Auto-Configuration Notice & Setup Instructions
          if (result.mcpDetected?.length > 0) {
            sections.push('\n### 🔧 Auto-Configured MCP Servers (.opencode/opencode.jsonc)');
            sections.push('AutoDiscoveryPlugin automatically added the following MCP server(s) to `.opencode/opencode.jsonc`:');

            for (const id of result.mcpDetected) {
              const entry = MCP_REGISTRY[id];
              if (!entry) continue;
              const cmdStr = `npx ${entry.packageName} ${entry.args.join(' ')}`;
              sections.push(`- **${entry.displayName}** (\`${cmdStr}\`) — Configured in project \`.opencode/opencode.jsonc\``);
            }

            if (result.mcpPendingKeys?.length > 0) {
              sections.push('\n#### ⚠️ Required API Keys & Setup Instructions:');
              for (const id of result.mcpPendingKeys) {
                const entry = MCP_REGISTRY[id];
                if (!entry) continue;
                sections.push(`\n##### 🔌 ${entry.displayName}`);
                if (entry.apiKeyEnvVar) sections.push(`- **Environment Variable:** \`${entry.apiKeyEnvVar}\``);
                if (entry.apiKeyUrl) sections.push(`- **Dashboard URL:** ${entry.apiKeyUrl}`);
                if (entry.apiKeyFieldLabel) sections.push(`- **Value to paste:** ${entry.apiKeyFieldLabel}`);
                if (entry.installNote) {
                  sections.push(`- **Setup Instructions:**\n  ${entry.installNote.replace(/\n/g, '\n  ')}`);
                }
              }
              sections.push('\n> **Note:** After setting up the required environment variables or keys, **restart OpenCode Desktop** for the MCP server tools to activate.');
            }
          }

          // -- Skill load instructions (dynamically check installed skills on every turn)
          const currentlyInstalled = getInstalledSkills(result.skillsDetected || [], projectDir);
          const uninstalled = (result.skillsDetected || []).filter(s => !currentlyInstalled.includes(s));

          if (currentlyInstalled.length > 0) {
            sections.push(
              '\n### Installed Skills — LOAD THESE\n' +
              'The following skills are installed globally and relevant to this project. ' +
              '**Before starting work, use the `skill` tool to load each one:**'
            );
            for (const skillId of currentlyInstalled) {
              sections.push(`- Load \`${skillId}\` via the \`skill\` tool to activate its specialized knowledge.`);
            }
          }
          if (uninstalled.length > 0) {
            sections.push(
              '\n### Recommended Skills (not yet installed)\n' +
              'The following skills are recommended for this project stack but are not installed yet:'
            );
            for (const skillId of uninstalled) {
              const source = SKILL_INSTALL_SOURCE[skillId];
              if (source) {
                sections.push(`- \`${skillId}\` — install with: \`npx skills add ${source}@${skillId} -g -y\``);
              }
            }
          }

          if (sections.length === 0) return;

          const injection = `
[SYSTEM NOTIFICATION - AUTO-DISCOVERY]
${sections.join('\n')}
---
`;
          if (output && Array.isArray(output.system)) {
            output.system.push(injection);
          }
        } catch (e) {
          console.error('[AutoDiscoveryPlugin] Error in system.transform:', e);
        }
      },
    };
  },
};
