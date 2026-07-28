#!/usr/bin/env node
/**
 * Validates the plugin/marketplace manifests and keeps their versions in sync
 * with package.json. CI has no Claude Code CLI, so this reimplements the checks
 * that matter: valid JSON, required fields, and one single source of truth for
 * the version number.
 *
 * Run `claude plugin validate .` locally for the full schema check.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";

let failed = false;

function fail(message) {
  console.error(`FAIL: ${message}`);
  failed = true;
}

function ok(message) {
  console.log(`ok — ${message}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
    return null;
  }
}

const pkg = readJson("package.json");
const plugin = readJson("plugin/.claude-plugin/plugin.json");
const marketplace = readJson(".claude-plugin/marketplace.json");
const mcp = readJson("plugin/.mcp.json");
const rootMcp = readJson(".mcp.json");

if (pkg && plugin && marketplace && mcp && rootMcp) {
  ok("all five manifests parse");

  // --- plugin.json ---
  for (const field of ["name", "description", "version"]) {
    if (!plugin[field]) fail(`plugin.json is missing "${field}"`);
  }
  if (!/^[a-z0-9-]+$/.test(plugin.name ?? "")) {
    fail(`plugin.json name "${plugin.name}" must be kebab-case`);
  } else {
    ok(`plugin name "${plugin.name}" is kebab-case`);
  }

  // --- marketplace.json ---
  if (!marketplace.name) fail("marketplace.json is missing \"name\"");
  if (!marketplace.owner?.name) fail("marketplace.json is missing owner.name");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail("marketplace.json lists no plugins");
  } else {
    ok(`marketplace lists ${marketplace.plugins.length} plugin(s)`);
  }

  const entry = marketplace.plugins?.[0];
  if (entry && entry.name !== plugin.name) {
    fail(`marketplace entry "${entry.name}" does not match plugin "${plugin.name}"`);
  } else if (entry) {
    ok("marketplace entry name matches plugin.json");
  }
  if (entry && "version" in entry) {
    // plugin.json always wins, so a version here is dead config that can mask it.
    fail("marketplace entry should not set `version`; plugin.json is the authority");
  }
  // The plugin MUST live in its own subdirectory. Pointing `source` at the repo
  // root makes Claude Code npm-install this package's devDependencies (~112 MB)
  // into every user's plugin cache, because the root has a package.json.
  if (entry && entry.source !== "./plugin") {
    fail(`marketplace source must be "./plugin", not "${entry.source}" — a repo-root source drags package.json into the plugin cache`);
  } else if (entry) {
    ok("marketplace source points at the package.json-free ./plugin directory");
  }

  // --- version sync ---
  if (plugin.version !== pkg.version) {
    fail(`plugin.json version ${plugin.version} != package.json version ${pkg.version}`);
  } else {
    ok(`versions in sync at ${pkg.version}`);
  }

  // --- .mcp.json ---
  const server = mcp.mcpServers?.vibelens;
  if (!server) {
    fail("plugin/.mcp.json has no `vibelens` server entry");
  } else {
    const args = (server.args ?? []).join(" ");
    if (!args.includes(pkg.name)) {
      fail(`plugin/.mcp.json args (${args}) do not reference the package name ${pkg.name}`);
    } else {
      ok(`plugin/.mcp.json launches ${pkg.name}`);
    }
  }

  // The root copy is what people get when they clone the repo; keep them equal.
  if (JSON.stringify(mcp) !== JSON.stringify(rootMcp)) {
    fail(".mcp.json and plugin/.mcp.json have drifted apart");
  } else {
    ok(".mcp.json and plugin/.mcp.json match");
  }

  // --- plugin components ---
  // Claude Code only loads components from the plugin root, never from inside
  // .claude-plugin/, so assert they are where they need to be.
  const expectedSkills = [
    "a11y-audit",
    "before-after",
    "check-ui",
    "color-system",
    "console-triage",
    "design-review",
    "layout-audit",
    "micro-interactions",
    "motion-system",
    "polish-pass",
    "responsive-audit",
    "type-system",
  ];
  const skillDirs = existsSync("plugin/skills")
    ? readdirSync("plugin/skills").sort()
    : [];
  if (JSON.stringify(skillDirs) !== JSON.stringify(expectedSkills)) {
    fail(`plugin/skills has ${JSON.stringify(skillDirs)}, expected ${JSON.stringify(expectedSkills)}`);
  } else {
    ok(`${skillDirs.length} skills present`);
  }
  for (const skill of skillDirs) {
    const file = `plugin/skills/${skill}/SKILL.md`;
    if (!existsSync(file)) {
      fail(`${file} is missing`);
      continue;
    }
    // Without frontmatter carrying a description, the model never invokes it.
    const head = readFileSync(file, "utf8").slice(0, 400);
    if (!head.startsWith("---") || !/\ndescription:/.test(head)) {
      fail(`${file} needs YAML frontmatter with a description`);
    }
  }

  for (const agent of ["design-reviewer", "frontend-builder", "ui-debugger", "ui-reviewer"]) {
    const file = `plugin/agents/${agent}.md`;
    if (!existsSync(file)) {
      fail(`${file} is missing`);
    } else {
      const head = readFileSync(file, "utf8").slice(0, 400);
      if (!head.startsWith("---") || !/\nname:/.test(head)) {
        fail(`${file} needs YAML frontmatter with a name`);
      }
    }
  }
  ok("4 agents present");

  if (!existsSync("plugin/hooks/hooks.json")) {
    fail("plugin/hooks/hooks.json is missing");
  } else {
    const hooks = readJson("plugin/hooks/hooks.json");
    const entries = hooks?.hooks?.PostToolUse;
    if (!Array.isArray(entries) || entries.length === 0) {
      fail("hooks.json has no PostToolUse entry");
    } else {
      // Every hook is advisory: it must not be able to block a tool call.
      const commands = entries.flatMap((entry) => (entry.hooks ?? []).map((h) => h.command ?? ""));
      const notSafe = commands.filter((c) => !c.includes("exit 0"));
      if (notSafe.length > 0) {
        fail(`${notSafe.length} hook command(s) do not end with an explicit exit 0`);
      } else {
        ok(`${commands.length} advisory hook command(s), all exit 0`);
      }
    }
  }

  // --- design knowledge base ---
  // The design skills link here instead of restating the rules; a dead link
  // makes them useless.
  const designDocs = [
    "README.md",
    "ANTI-SLOP.md",
    "TYPOGRAPHY.md",
    "COLOR.md",
    "SPACING-LAYOUT.md",
    "MOTION.md",
  ];
  const missingDesign = designDocs.filter((f) => !existsSync(`docs/design/${f}`));
  if (missingDesign.length > 0) {
    fail(`docs/design is missing: ${missingDesign.join(", ")}`);
  } else {
    ok(`design knowledge base complete (${designDocs.length} files)`);
  }

  // The whole reason the plugin lives in a subdirectory.
  if (existsSync("plugin/package.json")) {
    fail("plugin/package.json exists — Claude Code would npm install into the plugin cache");
  } else {
    ok("plugin/ has no package.json");
  }

  // --- README links and assets ---
  // A broken image or doc link is the first thing a visitor hits.
  const readme = readFileSync("README.md", "utf8");
  const referenced = [
    ...[...readme.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)].map((m) => m[1]),
    ...[...readme.matchAll(/\]\(\.\/([^)#]+)\)/g)].map((m) => m[1]),
  ].map((p) => p.replace(/\/$/, ""));
  const unique = [...new Set(referenced)];
  const missing = unique.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    fail(`README references missing paths: ${missing.join(", ")}`);
  } else {
    ok(`all ${unique.length} README-referenced paths exist`);
  }
}

if (failed) {
  console.error("\nManifest validation failed.");
  process.exit(1);
}
console.log("\nMANIFESTS OK");
