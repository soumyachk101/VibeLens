#!/usr/bin/env node
/**
 * Validates the plugin/marketplace manifests and keeps their versions in sync
 * with package.json. CI has no Claude Code CLI, so this reimplements the checks
 * that matter: valid JSON, required fields, and one single source of truth for
 * the version number.
 *
 * Run `claude plugin validate .` locally for the full schema check.
 */

import { readFileSync } from "node:fs";

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
}

if (failed) {
  console.error("\nManifest validation failed.");
  process.exit(1);
}
console.log("\nMANIFESTS OK");
