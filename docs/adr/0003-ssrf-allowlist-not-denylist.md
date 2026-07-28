# ADR 0003: SSRF allowlist, not denylist

## Status

Accepted, 2026-07-28

## Context

The `url` argument to `inspect_localhost_ui` is chosen by a language model that
has read the developer's prompt, project files, and — via this very tool — the
text of rendered web pages. Page content is untrusted input, so the URL can be
influenced by an attacker who controls anything the model has read.

VibeLens then opens that URL in a real browser, on the developer's machine, with
the developer's local network access. Unconstrained, that is a textbook SSRF
primitive, and the interesting targets are close by: cloud instance-metadata
services (`169.254.169.254` and friends) that hand out credentials to anything
that asks, internal services on a corporate LAN, and any public URL at all.

A denylist approach — block metadata IPs and a few known-bad hosts, allow the rest —
fails for well-understood reasons. Addresses can be written in octal, decimal or hex;
IPv6 has multiple textual forms and IPv4-mapped addresses; and a hostname that
resolves correctly at validation time can resolve elsewhere microseconds later (DNS
rebinding). Enumerating what is bad is unbounded work. Enumerating what is good is a
short list: a dev server listens on loopback or a private-range address, and that is
the whole legitimate target set.

## Decision

`validateLocalUrl()` in `src/security.ts` is an allowlist, and it runs as the first
statement of `captureUIState()` — before any process is launched.

Allowed: hostnames `localhost` and `*.localhost` (RFC 6761 reserves these as
always-local, so they need no DNS lookup); IPv4 `127.0.0.0/8`, `0.0.0.0`,
`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`; IPv6 `[::1]`, `[::]`, unique-local
`fc00::/7`, link-local `fe80::/10`, and IPv4-mapped forms whose embedded address is
itself private.

Refused, with a reason string the model can act on: any other hostname (it is **not
resolved** — a DNS name is rejected outright, because resolving it is what makes
rebinding possible); any public IP address; cloud metadata endpoints
`169.254.169.254`, `169.254.170.2`, `fd00:ec2::254` and `100.100.100.200`, checked
*before* the allowlist so no future edit can accidentally permit them, with all of
IPv4 link-local `169.254.0.0/16` excluded from the allowlist too because no dev server
binds there; schemes other than `http:` and `https:`; URLs carrying credentials
(`http://user:pass@...`); and unparseable input.

Two implementation details carry weight. Parsing goes through the WHATWG `URL`
constructor first, so obfuscated forms are canonicalized before evaluation:
`0177.0.0.1` is judged as `127.0.0.1`, and `0x08080808` as `8.8.8.8`, which is then
rejected. And `parseIPv4()` refuses zero-padded octets, so an octal literal cannot
slip past as a decimal one. The function returns a discriminated union and never
throws.

## Consequences

- The failure mode is closed. An unrecognised address is refused, so a parser bug tends
  toward rejecting valid input rather than accepting hostile input. Rejection is also free:
  `INVALID_URL` is raised before Chromium starts, so a model probing addresses in a loop
  cannot exhaust the machine.
- The rule is small enough to audit. `security.ts` is one pure module with no I/O, and
  `tests/security.test.ts` is table-driven, so any change to the module requires new
  cases: obfuscated IPs, spoofed `localhost` suffixes, credentialed URLs, non-HTTP
  schemes, and hostile-input fuzz that must not throw.
- **Given up: inspecting anything but a local address.** Staging URLs, preview
  deployments, a Docker host reached by container hostname, a `*.test` domain in
  `/etc/hosts` — all refused. A permanent non-goal, not a missing feature, and the most
  likely source of user surprise. Because no DNS name is resolved, a dev server reachable
  as `myapp.local` must be addressed by IP.
- **Given up: an escape hatch.** There is deliberately no flag or environment variable to
  relax the rule. An opt-out would become the first thing an injected prompt tries to talk
  the model into setting.
- Redirects remain a residual gap: Chromium follows them itself, so validation applies
  only to the URL VibeLens was given. `summary.url` reports the final URL, so a redirect
  off-host is at least visible. Page content is untrusted regardless — the allowlist
  bounds where the browser goes, not what the page says.

## Alternatives considered

**Denylist of known-dangerous ranges.** Rejected. Unbounded enumeration, and every
new cloud provider's metadata address is a silent hole until someone notices.

**Resolve the hostname, then check the resolved IP.** Rejected. The check and the
browser's own lookup are two separate resolutions, and an attacker-controlled zone
with a short TTL wins the race. Refusing hostnames removes the race.

**Allow any URL and rely on per-call developer approval.** Rejected. Approval fatigue
is real, and the URL looks innocuous precisely when it is not
(`http://169.254.169.254/latest/meta-data/` reads as local to a hurrying human).

**Enforce it at the browser layer with request interception.** Rejected as the primary
control: it runs after a browser has been launched and depends on intercepting every
request type correctly. Still a plausible defence in depth for redirects later.
