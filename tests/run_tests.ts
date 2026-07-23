import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

// Import local plugin modules and helpers
import InitPlugin, { isUninitializedProject, initializeExistingProjectFiles } from '../plugins/InitPlugin.ts';
import ContextLoaderPlugin, { updateProjectContext } from '../plugins/ContextLoaderPlugin.ts';
import AutoDiscoveryPlugin from '../plugins/AutoDiscoveryPlugin.ts';
import StateTrackerPlugin from '../plugins/StateTrackerPlugin.ts';
import ActionValidatorPlugin from '../plugins/ActionValidatorPlugin.ts';
import CleanupPlugin from '../plugins/CleanupPlugin.ts';

// Helper to create a temporary test directory
function createTestDir(name: string): string {
  const tmpDir = path.join(os.tmpdir(), `opencode_test_${name}_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

// Helper to clean up temporary test directory
function removeTestDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {}
}

// ============================================================================
// TEST GROUP 1: InitPlugin
// ============================================================================
test('InitPlugin - isUninitializedProject on empty folder', async () => {
  const testDir = createTestDir('empty');
  try {
    const isUninit = isUninitializedProject(testDir);
    assert.equal(isUninit, true, 'Empty folder must be identified as uninitialized');
  } finally {
    removeTestDir(testDir);
  }
});

test('InitPlugin - isUninitializedProject on folder with dotfiles only (.git, .vscode)', async () => {
  const testDir = createTestDir('dotfiles');
  try {
    fs.mkdirSync(path.join(testDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(testDir, '.vscode'), { recursive: true });

    const isUninit = isUninitializedProject(testDir);
    assert.equal(isUninit, true, 'Folder with dotfiles only must be identified as uninitialized');
  } finally {
    removeTestDir(testDir);
  }
});

test('InitPlugin - isUninitializedProject on folder with source code (src/index.ts)', async () => {
  const testDir = createTestDir('src_code');
  try {
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'console.log("hello");');

    const isUninit = isUninitializedProject(testDir);
    assert.equal(isUninit, false, 'Folder with src/index.ts must NOT be uninitialized');
  } finally {
    removeTestDir(testDir);
  }
});

test('InitPlugin - isUninitializedProject on folder with package.json', async () => {
  const testDir = createTestDir('pkg_json');
  try {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

    const isUninit = isUninitializedProject(testDir);
    assert.equal(isUninit, false, 'Folder with package.json must NOT be uninitialized');
  } finally {
    removeTestDir(testDir);
  }
});

test('InitPlugin - messages.transform & system.transform execution on empty project', async () => {
  const testDir = createTestDir('init_flow');
  try {
    const serverInstance = await InitPlugin.server({ directory: testDir });
    
    // First message transform on empty folder
    await serverInstance['experimental.chat.messages.transform']({}, {});
    
    const statusPath = path.join(testDir, '.agents', 'init-status.json');
    assert.equal(fs.existsSync(statusPath), true, 'init-status.json must be created');
    const statusObj = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    assert.equal(statusObj.status, 'pending_interactive_setup');

    // System transform on empty folder
    const outputSystem: any = { system: [] };
    await serverInstance['experimental.chat.system.transform']({}, outputSystem);
    assert.equal(outputSystem.system.length, 1);
    assert.match(outputSystem.system[0], /UNINITIALIZED EMPTY PROJECT DETECTED/);

    // Now simulate agent creating package.json
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'created-app' }));

    // Second message transform
    await serverInstance['experimental.chat.messages.transform']({}, {});
    const updatedStatusObj = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    assert.equal(updatedStatusObj.status, 'ready', 'Status must transition to ready once package.json is created');
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 2: ContextLoaderPlugin
// ============================================================================
test('ContextLoaderPlugin - updateProjectContext detects languages & key dependencies', async () => {
  const testDir = createTestDir('context_loader');
  try {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'my-express-app',
      dependencies: { express: '^4.18.2' },
      devDependencies: { typescript: '^5.0.0', '@types/express': '^4.17.0' }
    }));
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), '{}');

    const ctxData = updateProjectContext(testDir);
    assert.notEqual(ctxData, null);
    assert.deepEqual(ctxData.stack.languages, ['JavaScript', 'TypeScript']);
    assert.deepEqual(ctxData.stack.frameworks, ['Express']);
    assert.equal(ctxData.keyDependencies.includes('express'), true);
    assert.equal(ctxData.keyDependencies.includes('typescript'), true);

    const contextJsonPath = path.join(testDir, '.agents', 'context.json');
    assert.equal(fs.existsSync(contextJsonPath), true);
  } finally {
    removeTestDir(testDir);
  }
});

test('ContextLoaderPlugin - handles corrupted package.json gracefully without crashing', async () => {
  const testDir = createTestDir('corrupted_pkg');
  try {
    fs.writeFileSync(path.join(testDir, 'package.json'), '{ invalid json content... ');

    const ctxData = updateProjectContext(testDir);
    assert.notEqual(ctxData, null);
    assert.deepEqual(ctxData.stack.languages, []);
    assert.deepEqual(ctxData.keyDependencies, []);
  } finally {
    removeTestDir(testDir);
  }
});

test('ContextLoaderPlugin - system.transform injects workspace context', async () => {
  const testDir = createTestDir('context_sys');
  try {
    updateProjectContext(testDir);
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Test Project Readme');

    const serverInstance = await ContextLoaderPlugin.server({ directory: testDir });
    const outputSystem: any = { system: [] };
    await serverInstance['experimental.chat.system.transform']({}, outputSystem);

    assert.equal(outputSystem.system.length, 1);
    assert.match(outputSystem.system[0], /PROJECT WORKSPACE CONTEXT/);
    assert.match(outputSystem.system[0], /Test Project Readme/);
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 3: AutoDiscoveryPlugin
// ============================================================================
test('AutoDiscoveryPlugin - scans Node deps, configures MCP and writes auto-discovery.json', async () => {
  const testDir = createTestDir('auto_disc');
  try {
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'stripe-demo',
      dependencies: { stripe: '^14.0.0', express: '^4.18.0' }
    }));

    const serverInstance = await AutoDiscoveryPlugin.server({ directory: testDir });
    await serverInstance['experimental.chat.messages.transform']({}, {});

    const resultPath = path.join(testDir, '.agents', 'auto-discovery.json');
    assert.equal(fs.existsSync(resultPath), true, 'auto-discovery.json must be created');

    const autoDisc = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(autoDisc.dependenciesFound, 2);
    assert.equal(autoDisc.mcpDetected.includes('stripe'), true);
    assert.match(autoDisc.stackSummary, /Express/);

    // Wait 150ms for deferred MCP project setup
    await new Promise(r => setTimeout(r, 150));

    const opencodeJsoncPath = path.join(testDir, '.opencode', 'opencode.jsonc');
    assert.equal(fs.existsSync(opencodeJsoncPath), true, '.opencode/opencode.jsonc must be created');

    const opencodeConfig = JSON.parse(fs.readFileSync(opencodeJsoncPath, 'utf8'));
    assert.equal(opencodeConfig.mcp.stripe.type, 'local');
    assert.equal(Array.isArray(opencodeConfig.mcp.stripe.command), true);
    assert.equal(opencodeConfig.mcp.stripe.enabled, true);
  } finally {
    removeTestDir(testDir);
  }
});

test('AutoDiscoveryPlugin - scans Rust Cargo.toml, Go go.mod and Python requirements.txt', async () => {
  const testDir = createTestDir('multi_manifest');
  try {
    fs.writeFileSync(path.join(testDir, 'Cargo.toml'), `
[package]
name = "rust_test"
version = "0.1.0"
[dependencies]
serde = "1.0"
tokio = "1.0"
`);

    fs.writeFileSync(path.join(testDir, 'go.mod'), `
module example.com/test
go 1.20
require (
  github.com/gin-gonic/gin v1.9.0
)
`);

    fs.writeFileSync(path.join(testDir, 'requirements.txt'), `
flask==2.3.0
requests>=2.28.0
# comment
-e .
`);

    const serverInstance = await AutoDiscoveryPlugin.server({ directory: testDir });
    await serverInstance['experimental.chat.messages.transform']({}, {});

    const resultPath = path.join(testDir, '.agents', 'auto-discovery.json');
    assert.equal(fs.existsSync(resultPath), true);
    const autoDisc = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    assert.equal(autoDisc.dependenciesFound >= 4, true, 'Must detect Rust, Go and Python dependencies');
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 4: StateTrackerPlugin
// ============================================================================
test('StateTrackerPlugin - tracks file modifications and ignores .agents files', async () => {
  const testDir = createTestDir('state_tracker');
  try {
    const serverInstance = await StateTrackerPlugin.server({ directory: testDir });

    // Track write to src/index.ts
    await serverInstance['tool.execute.after']({
      tool: 'write_to_file',
      args: { TargetFile: path.join(testDir, 'src', 'index.ts') }
    }, {});

    const statePath = path.join(testDir, '.agents', 'state.json');
    assert.equal(fs.existsSync(statePath), true);
    let stateObj = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(stateObj.modifications.length, 1);
    assert.equal(stateObj.modifications[0].file.replace(/\\/g, '/'), 'src/index.ts');

    // Track write to .agents/context.json (MUST BE IGNORED)
    await serverInstance['tool.execute.after']({
      tool: 'write_to_file',
      args: { TargetFile: path.join(testDir, '.agents', 'context.json') }
    }, {});

    stateObj = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(stateObj.modifications.length, 1, 'Modifications to .agents/ files must be ignored');

    // Track todowrite
    await serverInstance['tool.execute.after']({
      tool: 'todowrite',
      args: { todos: [{ title: 'Phase 1: Setup', status: 'completed' }] }
    }, {});

    const planPath = path.join(testDir, '.agents', 'plan.json');
    assert.equal(fs.existsSync(planPath), true);
    const planObj = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    assert.equal(planObj.phases.length, 1);
    assert.equal(planObj.phases[0].title, 'Phase 1: Setup');
  } finally {
    removeTestDir(testDir);
  }
});

test('StateTrackerPlugin - caps modification history at 30 items', async () => {
  const testDir = createTestDir('state_cap');
  try {
    const serverInstance = await StateTrackerPlugin.server({ directory: testDir });

    for (let i = 1; i <= 35; i++) {
      await serverInstance['tool.execute.after']({
        tool: 'write_to_file',
        args: { TargetFile: path.join(testDir, 'src', `file_${i}.ts`) }
      }, {});
    }

    const statePath = path.join(testDir, '.agents', 'state.json');
    const stateObj = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(stateObj.modifications.length, 30, 'Modifications history must be capped at 30');
    assert.equal(stateObj.modifications[0].file.replace(/\\/g, '/'), 'src/file_6.ts');
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 5: ActionValidatorPlugin
// ============================================================================
test('ActionValidatorPlugin - allows safe commands and blocks destructive system commands', async () => {
  const testDir = createTestDir('action_val');
  try {
    const serverInstance = await ActionValidatorPlugin.server({ directory: testDir });

    // Safe command 1
    await assert.doesNotReject(async () => {
      await serverInstance['tool.execute.before']({
        tool: 'run_command',
        args: { CommandLine: 'git commit -m "fix: remove item from array"' }
      }, {});
    });

    // Safe command 2 with /s in text
    await assert.doesNotReject(async () => {
      await serverInstance['tool.execute.before']({
        tool: 'run_command',
        args: { CommandLine: 'npm run test -- /s' }
      }, {});
    });

    // Destructive command 1: rm -rf /
    await assert.rejects(async () => {
      await serverInstance['tool.execute.before']({
        tool: 'run_command',
        args: { CommandLine: 'rm -rf /' }
      }, {});
    }, /Acción bloqueada por seguridad/);

    // Destructive command 2: Windows rd /s /q C:\
    await assert.rejects(async () => {
      await serverInstance['tool.execute.before']({
        tool: 'run_command',
        args: { CommandLine: 'rd /s /q C:\\' }
      }, {});
    }, /Acción bloqueada por seguridad/);

    // Destructive command 3: Windows rmdir \s \q C:\Windows
    await assert.rejects(async () => {
      await serverInstance['tool.execute.before']({
        tool: 'run_command',
        args: { CommandLine: 'rmdir \\s \\q C:\\Windows' }
      }, {});
    }, /Acción bloqueada por seguridad/);

    const securityLogPath = path.join(testDir, '.agents', 'security.log');
    assert.equal(fs.existsSync(securityLogPath), true);
    const logContent = fs.readFileSync(securityLogPath, 'utf8');
    assert.match(logContent, /BLOCKED/);
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 6: CleanupPlugin
// ============================================================================
test('CleanupPlugin - moves temp test files to trash without touching source code', async () => {
  const testDir = createTestDir('cleanup');
  try {
    // Temp file in root
    fs.writeFileSync(path.join(testDir, 'test.js'), 'console.log("temp test");');
    // Actual source code file in root
    fs.writeFileSync(path.join(testDir, 'app.js'), 'console.log("main app");');

    const serverInstance = await CleanupPlugin.server({ directory: testDir });
    await serverInstance.event({ event: { type: 'session.created' } });

    assert.equal(fs.existsSync(path.join(testDir, 'app.js')), true, 'Actual app.js MUST NOT be deleted');
    assert.equal(fs.existsSync(path.join(testDir, 'test.js')), false, 'Root test.js MUST be moved to trash');

    const trashFilePath = path.join(testDir, '.agents', 'workflow', 'trash', 'test.js');
    assert.equal(fs.existsSync(trashFilePath), true, 'test.js MUST exist in trash directory');
  } finally {
    removeTestDir(testDir);
  }
});

// ============================================================================
// TEST GROUP 7: Installer (install.js) Schema & Config Validation
// ============================================================================
test('Installer (install.js) - generates valid opencode.jsonc with slash commands & hidden subagents', async () => {
  const testConfigDir = createTestDir('install_cfg');
  try {
    const baseDir = import.meta.dirname || path.dirname(new URL(import.meta.url).pathname);
    const installScriptPath = path.resolve(baseDir, '..', 'install.js');
    
    // Execute install.js with custom OPENCODE_CONFIG_DIR
    execSync(`node "${installScriptPath}"`, {
      env: { ...process.env, OPENCODE_CONFIG_DIR: testConfigDir },
      encoding: 'utf8'
    });

    const configPath = path.join(testConfigDir, 'opencode.jsonc');
    assert.equal(fs.existsSync(configPath), true, 'opencode.jsonc must be generated');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.equal(config.default_agent, 'orchestrator');
    assert.equal(config.command.sdlc.agent, 'orchestrator');
    assert.equal(config.command.plan.agent, 'orchestrator');
    assert.equal(config.agent['sdlc-planner'].hidden, true);
    assert.equal(config.agent['sdlc-planner'].mode, 'subagent');
    assert.equal(config.compaction.auto, true);
  } finally {
    removeTestDir(testConfigDir);
  }
});
