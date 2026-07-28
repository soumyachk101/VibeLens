# ADR 0001: MCP over stdio

## Status

Accepted, 2026-07-28

## Context

VibeLens has to be callable by an AI coding assistant mid-conversation, inside
whatever IDE the developer already uses: Claude Code, Cursor, OpenAI Codex, Google
Antigravity, Windsurf, VS Code in Copilot agent mode, Claude Desktop.

Two things constrain the integration surface. The tool drives a real browser
against a dev server bound to `localhost`, reachable only from the developer's own
machine, so the component that opens it must run on that machine — any hosted
design would need a tunnel back into the developer's loopback interface, which is a
worse security story and a worse setup story. And the assistant needs to *decide*
to call the tool, which means the capability must be advertised to the model with a
name, a description and a schema it can read, and the response must come back as
content the model can consume — including an image block, since a screenshot is the
point.

The Model Context Protocol solves exactly this: JSON-RPC with a `tools/list` and
`tools/call` surface, an official TypeScript SDK, and image content blocks. It has
two transports of interest — stdio, where the host spawns the server as a child
process, and HTTP with Server-Sent Events for remote servers. Notably, some hosts
support stdio only; OpenAI Codex is one.

## Decision

VibeLens is an MCP server that speaks stdio, and nothing else.

`src/index.ts` connects `createServer()` to `StdioServerTransport` and that is
the whole transport story. There is no HTTP listener, no port, no auth layer,
because there is no remote caller to authenticate. Every IDE configuration in
the README reduces to the same three lines: command `npx`, args
`["-y", "mcp-vibelens@1"]`.

The consequence that needs enforcing is that **stdout belongs to the transport**.
JSON-RPC frames are the only thing allowed there. `server.ts` exports a `log()`
helper that writes to stderr with a `[vibelens]` prefix, and no module in `src/`
calls `console.log`.

## Consequences

- One config shape works across every MCP-capable IDE. Adding support for a new
  host is a documentation change, not a code change.
- No network attack surface exists. The only input channel is the stdio pipe
  from the parent process, which the developer's own IDE owns.
- Lifecycle is free. The host spawns the process and reaps it when the session
  ends; there is no daemon to install, supervise, or leave running.
- No authentication, TLS or multi-tenancy code to write or review: the trust
  model is "same user, same machine".
- **Given up: remote and shared usage.** VibeLens cannot be run as a team
  service, cannot be called from a CI runner that is not also hosting the MCP
  client, and cannot be shared between developers. Combined with ADR 0003 this
  is a permanent boundary, not a gap.
- **Given up: freedom on stdout.** A single stray `console.log` anywhere in the
  process — including from a dependency — corrupts the frame stream and breaks
  the integration silently, with no error the user can read. This is a real,
  ongoing tax: it is written into `CLAUDE.md` as invariant 1 and is the reason
  `scripts/smoke.mjs` exercises the server over real stdio rather than only
  in-memory.
- Debugging is slightly harder. Diagnostics are only visible in whatever the
  host does with the child process's stderr, which varies by IDE.

## Alternatives considered

**HTTP + SSE transport.** Rejected. It would add a listening socket, an auth
story, and CORS considerations to a tool whose entire job is to reach loopback on
the machine it already runs on. It would also exclude hosts that support stdio
only, which includes Codex.

**A CLI that writes screenshots to disk, invoked by the assistant's shell tool.**
Rejected. The model would have to be told to run it, remember the output path,
and read the file back; image content would depend on the host's file-reading
support. MCP's tool description and typed schema are what make the capability
discoverable by the model in the first place — that discoverability is the
feature, not the plumbing.

**An IDE extension per editor.** Rejected. It multiplies the implementation by
the number of editors and ties the tool to each editor's extension API and
release cycle. MCP is the layer that already abstracts this.

**Both transports, selected by a flag.** Rejected for v1 as unjustified surface
area: two transports means two code paths to test and a remote mode that ADR 0003
would refuse to make useful anyway.
