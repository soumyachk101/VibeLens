import { describe, expect, it } from "vitest";

import { isPrivateIPv4, isPrivateIPv6, parseIPv4, validateLocalUrl } from "../src/security.js";

describe("validateLocalUrl — accepts local targets", () => {
  const allowed = [
    "http://localhost:3000",
    "http://localhost:3000/dashboard?tab=1#anchor",
    "https://localhost:8443",
    "http://app.localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.1.2.3:8080",
    "http://0.0.0.0:3000",
    "http://10.0.0.5:3000",
    "http://192.168.1.42:5173",
    "http://172.16.0.1:3000",
    "http://172.31.255.254:3000",
    "http://[::1]:3000",
    "http://[fe80::1]:3000",
    "http://[fd12:3456::1]:3000",
  ];

  for (const url of allowed) {
    it(`allows ${url}`, () => {
      expect(validateLocalUrl(url).ok, url).toBe(true);
    });
  }

  it("assumes http:// when the scheme is omitted", () => {
    const result = validateLocalUrl("localhost:3000/pricing");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url.toString()).toBe("http://localhost:3000/pricing");
  });

  it("tolerates surrounding whitespace", () => {
    expect(validateLocalUrl("  http://localhost:3000  ").ok).toBe(true);
  });

  it("relies on WHATWG canonicalization for obfuscated IP forms", () => {
    // These all normalize to 127.0.0.1 before the allowlist check runs, so they
    // are correctly treated as loopback rather than as opaque hostnames.
    for (const input of ["http://0177.0.0.1", "http://2130706433", "http://0x7f.1"]) {
      const result = validateLocalUrl(input);
      expect(result.ok, input).toBe(true);
      if (result.ok) expect(result.url.hostname).toBe("127.0.0.1");
    }
  });
});

describe("validateLocalUrl — blocks SSRF vectors", () => {
  const blocked: Array<[string, string]> = [
    ["http://example.com", "public DNS name"],
    ["https://google.com/", "public https site"],
    ["http://169.254.169.254/latest/meta-data/", "AWS/GCP instance metadata endpoint"],
    ["http://169.254.170.2/v2/credentials", "ECS task metadata endpoint"],
    ["http://[fd00:ec2::254]/", "IMDS over IPv6"],
    ["http://169.254.10.10:3000", "IPv4 link-local (never a dev server)"],
    ["http://8.8.8.8", "public IPv4"],
    ["http://1.1.1.1:3000", "public IPv4 with local-looking port"],
    ["http://[2606:4700::1111]", "public IPv6"],
    ["file:///etc/passwd", "file scheme"],
    ["ftp://localhost/", "ftp scheme"],
    ["javascript:alert(1)", "javascript scheme"],
    ["http://user:pass@localhost:3000", "embedded credentials"],
    ["http://localhost.evil.com", "suffix-spoofed localhost"],
    ["http://notlocalhost", "bare public-ish hostname"],
    ["http://internal.corp", "internal DNS name (rebinding risk)"],
    ["http://metadata.google.internal/", "metadata by DNS name"],
    ["", "empty string"],
    ["   ", "whitespace only"],
    ["http://0x08080808", "obfuscated public IP (canonicalizes to 8.8.8.8)"],
    ["http://3232235777.nip.io", "DNS name encoding a private IP"],
  ];

  for (const [url, why] of blocked) {
    it(`blocks ${JSON.stringify(url)} (${why})`, () => {
      const result = validateLocalUrl(url);
      expect(result.ok, url).toBe(false);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    });
  }

  it("never throws on hostile input", () => {
    const hostile = ["http://", "://", "http://[", "\u0000", "http://localhost:notaport"];
    for (const input of hostile) {
      expect(() => validateLocalUrl(input)).not.toThrow();
    }
  });
});

describe("parseIPv4", () => {
  it("parses dotted quads", () => {
    expect(parseIPv4("192.168.0.1")).toEqual([192, 168, 0, 1]);
  });

  it("rejects non-IPv4 shapes", () => {
    expect(parseIPv4("localhost")).toBeNull();
    expect(parseIPv4("1.2.3")).toBeNull();
    expect(parseIPv4("1.2.3.4.5")).toBeNull();
    expect(parseIPv4("256.1.1.1")).toBeNull();
    expect(parseIPv4("01.2.3.4")).toBeNull(); // zero-padded / octal
  });
});

describe("isPrivateIPv4", () => {
  it("classifies ranges", () => {
    expect(isPrivateIPv4([127, 0, 0, 1])).toBe(true);
    expect(isPrivateIPv4([10, 255, 255, 255])).toBe(true);
    expect(isPrivateIPv4([172, 15, 0, 1])).toBe(false);
    expect(isPrivateIPv4([172, 32, 0, 1])).toBe(false);
    expect(isPrivateIPv4([172, 20, 0, 1])).toBe(true);
    expect(isPrivateIPv4([169, 254, 169, 254])).toBe(false); // link-local excluded
    expect(isPrivateIPv4([203, 0, 113, 5])).toBe(false);
  });
});

describe("isPrivateIPv6", () => {
  it("returns null for non-bracketed hosts", () => {
    expect(isPrivateIPv6("localhost")).toBeNull();
  });

  it("classifies bracketed literals", () => {
    expect(isPrivateIPv6("[::1]")).toBe(true);
    expect(isPrivateIPv6("[fe80::abcd]")).toBe(true);
    expect(isPrivateIPv6("[fc00::1]")).toBe(true);
    expect(isPrivateIPv6("[::ffff:127.0.0.1]")).toBe(true);
    expect(isPrivateIPv6("[::ffff:8.8.8.8]")).toBe(false);
    expect(isPrivateIPv6("[2001:db8::1]")).toBe(false);
  });
});
