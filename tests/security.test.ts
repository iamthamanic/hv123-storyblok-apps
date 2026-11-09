import { describe, expect, it } from "vitest";
import { isPublicHttpUrl } from "@/lib/http-status";
import { replaceScripts } from "@/lib/scripts";
import { initialScripts } from "@/lib/mock/fixtures";
import { assertMutatingOrigin } from "@/lib/server/security";

describe("Security hardening", () => {
  it("blocks SSRF-prone hosts in isPublicHttpUrl", () => {
    expect(isPublicHttpUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[fc00::1]/")).toBe(false);
    expect(isPublicHttpUrl("http://[fe80::1]/")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/")).toBe(false);
    expect(isPublicHttpUrl("https://halteverbot123.de/")).toBe(true);
  });

  it("strips client-controlled required flags on script replace", () => {
    const evil = {
      ...initialScripts[1]!,
      id: "evil",
      name: "evil",
      required: true,
      websiteUrl: "https://evil.example",
      details: "d",
      reason: "r",
      note: "n",
      snippet: "alert(1)",
    };
    const next = replaceScripts([...initialScripts, evil]);
    expect(next.find((script) => script.id === "evil")?.required).toBe(false);
    expect(next.find((script) => script.id === "termly")?.required).toBe(true);
  });

  it("rejects cross-site mutating requests without allowlisted Origin", () => {
    const request = new Request("http://127.0.0.1:43123/api/scripts", {
      method: "PUT",
      headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    });
    expect(() => assertMutatingOrigin(request)).toThrow(/Origin|Cross-Site/i);
  });

  it("allows same-origin mutating requests", () => {
    const request = new Request("http://127.0.0.1:43123/api/scripts", {
      method: "PUT",
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    expect(() => assertMutatingOrigin(request)).not.toThrow();
  });
});
