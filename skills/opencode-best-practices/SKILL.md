---
name: opencode-best-practices
description: Comprehensive architecture guide, configuration schema reference, plugin lifecycle hooks, agent permissions, slash commands, and development best practices for OpenCode Desktop and OpenCode CLI.
---

# OpenCode Architecture & Best Practices Guide

This skill provides expert knowledge and reference specs for developing, configuring, and extending **OpenCode** (OpenCode Desktop & OpenCode CLI).

---

## 1. OpenCode Configuration Schema (`opencode.jsonc` / `opencode.json`)

Location: `~/.config/opencode/opencode.jsonc` (Global) or `<project>/.opencode/opencode.jsonc` (Project-level).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "orchestrator", // Primary agent loaded on session start
  
  // Custom Slash Commands (accessible in chat via /<cmd>)
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
    }
  },

  // Context Compaction Strategy
  "compaction": {
    "auto": true,
    "prune": false,
    "tail_turns": 2 // Preserves last N user/assistant turns verbatim
  },

  // Global Permissions
  "permission": {
    "external_directory": {
      "*": "allow"
    }
  },

  // Active Plugin List (relative paths or installed absolute paths)
  "plugin": [
    "./plugins/InitPlugin.ts",
    "./plugins/ContextLoaderPlugin.ts",
    "./plugins/AutoDiscoveryPlugin.ts",
    "./plugins/StateTrackerPlugin.ts",
    "./plugins/ActionValidatorPlugin.ts",
    "./plugins/CleanupPlugin.ts"
  ],

  // Model Context Protocol (MCP) Declarations
  "mcp": {
    "stripe": {
      "type": "local",
      "command": ["npx", "-y", "@stripe/mcp", "--tools=all"],
      "enabled": true
    }
  }
}
```

---

## 2. Plugin Lifecycle Hooks & Server API

Plugins are Node.js/TypeScript ES modules exported as default objects.

```typescript
export default {
  id: "MyPlugin",
  async server(ctx: { directory?: string; project?: { directory: string } }) {
    const projectDir = ctx.directory || ctx.project?.directory;

    return {
      // 1. Session & Server Events
      async event({ event }: { event: { type: string; properties?: any } }) {
        if (event.type === "session.created") {
          // Reset session flags or clean temp files
        }
      },

      // 2. Chat Messages Interceptor (ONCE or PER-TURN)
      async ["experimental.chat.messages.transform"](input: any, output: any) {
        // Runs before prompt construction. Use to scan manifests, initialize project state.
        // DO NOT push to output.messages (that consumes the model's turn).
      },

      // 3. System Prompt Transformer (Injections)
      async ["experimental.chat.system.transform"](input: any, output: any) {
        // Inject static context, reports, or setup instructions into output.system array
        if (output && Array.isArray(output.system)) {
          output.system.push("[SYSTEM NOTIFICATION]\nCustom context here.");
        }
      },

      // 4. Tool Execution Interceptors (Validation & Auditing)
      async ["tool.execute.before"](input: { tool: string; args: any }, output: any) {
        // Throw Error to block dangerous commands
      },

      async ["tool.execute.after"](input: { tool: string; args: any }, output: any) {
        // Track file modifications or update plan state
      }
    };
  }
};
```

---

## 3. Agent Definition Spec (`agents/<agent-name>.md`)

Location: `~/.config/opencode/agents/` or `<project>/.opencode/agents/`

```markdown
---
description: Brief description of when to route work to this agent
mode: primary | subagent | all
color: primary | secondary | accent | success | warning | error
permission:
  edit: allow | deny
  bash:
    "*": "deny"
    "git *": "allow"
  task:
    "*": "deny"
    "sdlc-*": "allow"
  todowrite: allow
  question: allow
  skill: allow
---

System prompt instructions for the agent...
```

---

## 4. MCP Configuration Rules

1. `command` MUST be an array of strings: `["npx", "-y", "@package/mcp-server"]`.
2. `enabled: true` MUST be explicitly set.
3. Project-level MCP configurations MUST be written to `.opencode/opencode.jsonc` (writing to global `~/.config/opencode/opencode.jsonc` at runtime causes OpenCode session reloads).

---

## 5. LLM Prompt Caching & Performance Best Practices

1. **Avoid Dynamic Timestamps in System Prompts**: Never append `new Date().toISOString()` into `system.transform` text blocks, as it invalidates LLM prompt caching (Gemini / Claude / Moonshot).
2. **Asynchronous Non-Blocking Tasks**: Execute skill downloads and external commands using `child_process.exec()` asynchronously instead of blocking `execSync()`.
3. **Dynamic Evaluation**: Check file existence dynamically in `system.transform` on each turn rather than relying on stale initialization flags.
