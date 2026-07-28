/**
 * VibeLens — SSRF guard.
 *
 * The MCP server drives a real browser on the developer's machine, so an
 * unvalidated URL is a server-side request forgery primitive: the model (or a
 * prompt-injected page) could point it at cloud metadata endpoints or internal
 * services. We therefore allow *only* loopback and private-range hosts, and we
 * reject hostnames that would require DNS resolution (which could otherwise be
 * rebound to a public address).
 */

import type { URL as NodeURL } from "node:url";

export type UrlValidation =
  | { ok: true; url: NodeURL }
  | { ok: false; reason: string };

/** Protocols we are willing to drive a browser to. */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Hostnames treated as loopback without DNS resolution.
 * `*.localhost` is reserved by RFC 6761 and always resolves locally.
 */
function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".localhost");
}

/** Parses a dotted-quad IPv4 address into octets, or `null` if not IPv4. */
export function parseIPv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) return null;

  const octets: number[] = [];
  for (const part of parts) {
    // Reject empty, non-numeric, and zero-padded forms (e.g. "0177" is octal).
    if (!/^\d{1,3}$/.test(part)) return null;
    if (part.length > 1 && part.startsWith("0")) return null;
    const value = Number(part);
    if (value > 255) return null;
    octets.push(value);
  }
  return octets as [number, number, number, number];
}

/**
 * Addresses that are technically "private" but are well-known SSRF targets
 * (instance metadata services). Blocked unconditionally — no dev server ever
 * listens here.
 */
const METADATA_DENYLIST = new Set([
  "169.254.169.254", // AWS / Azure / GCP / DigitalOcean IMDS
  "169.254.170.2", // AWS ECS task metadata
  "fd00:ec2::254", // AWS IMDS over IPv6
  "100.100.100.200", // Alibaba Cloud metadata
]);

/**
 * True for addresses that cannot leave the developer's own network:
 * loopback (127/8), unspecified (0.0.0.0) and the RFC 1918 private ranges.
 *
 * Link-local 169.254.0.0/16 is deliberately NOT allowed: dev servers never bind
 * there, and it is the home of the cloud instance-metadata endpoint.
 */
export function isPrivateIPv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0 — resolves to localhost in browsers
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  return false;
}

/**
 * IPv6 check. `URL.hostname` keeps the brackets for IPv6 literals, so they are
 * stripped first. Allowed: loopback (::1), unspecified (::), unique-local
 * (fc00::/7) and link-local (fe80::/10).
 */
export function isPrivateIPv6(hostname: string): boolean | null {
  if (!hostname.startsWith("[") || !hostname.endsWith("]")) return null;
  const address = hostname.slice(1, -1).toLowerCase();

  if (address === "::1" || address === "::") return true;

  // IPv4-mapped loopback, e.g. ::ffff:127.0.0.1
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped?.[1]) {
    const octets = parseIPv4(mapped[1]);
    return octets ? isPrivateIPv4(octets) : false;
  }

  const firstGroup = address.split(":")[0] ?? "";
  if (firstGroup.length === 0) return false;
  const value = Number.parseInt(firstGroup.padEnd(4, "0"), 16);
  if (Number.isNaN(value)) return false;

  if ((value & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((value & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/**
 * Validates that `input` is a local URL VibeLens is allowed to open.
 *
 * @returns the parsed URL on success, or a human-readable reason on failure.
 *          Never throws.
 */
export function validateLocalUrl(input: string): UrlValidation {
  if (typeof input !== "string" || input.trim().length === 0) {
    return { ok: false, reason: "URL is empty." };
  }

  const raw = input.trim();

  // Be forgiving about a missing scheme: "localhost:3000" is what people type.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw) ? raw : `http://${raw}`;

  let url: NodeURL;
  try {
    url = new URL(candidate) as unknown as NodeURL;
  } catch {
    return { ok: false, reason: `"${raw}" is not a parseable URL.` };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      reason: `Protocol "${url.protocol}" is not allowed. Use http:// or https://.`,
    };
  }

  // Embedded credentials are never needed for a local dev server and would be
  // leaked into logs, so refuse them outright.
  if (url.username || url.password) {
    return { ok: false, reason: "URLs containing credentials are not allowed." };
  }

  const hostname = url.hostname;
  if (!hostname) {
    return { ok: false, reason: "URL has no host." };
  }

  // Metadata endpoints are refused before any allowlist check.
  const bareHost = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (METADATA_DENYLIST.has(bareHost)) {
    return {
      ok: false,
      reason: `Host "${bareHost}" is a cloud instance-metadata endpoint and is always blocked.`,
    };
  }

  if (isLoopbackHostname(hostname)) {
    return { ok: true, url };
  }

  const ipv6 = isPrivateIPv6(hostname);
  if (ipv6 === true) return { ok: true, url };
  if (ipv6 === false) {
    return {
      ok: false,
      reason: `Host "${hostname}" is a public IPv6 address. VibeLens only inspects local addresses.`,
    };
  }

  const ipv4 = parseIPv4(hostname);
  if (ipv4) {
    if (isPrivateIPv4(ipv4)) return { ok: true, url };
    return {
      ok: false,
      reason: `Host "${hostname}" is not a private address. VibeLens only inspects localhost and private-network addresses.`,
    };
  }

  // Anything else is a DNS name. Resolving it could point anywhere (and is
  // vulnerable to DNS rebinding), so it is refused.
  return {
    ok: false,
    reason: `Host "${hostname}" is not a local address. Allowed: localhost, *.localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x, [::1] and other private ranges.`,
  };
}
