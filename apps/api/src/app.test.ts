import { describe, it, expect } from "vitest";
import { buildApp } from "./app";
async function request(payload: unknown, opts: any = {}) {
  const app = buildApp(opts);
  try {
    return await app.inject({
      method: "POST",
      url: "/api/v1/parse-previews",
      payload: payload as any,
    });
  } finally {
    await app.close();
  }
}
describe("parse API", () => {
  it("reports its actual mode", async () => {
    const a = buildApp();
    const r = await a.inject("/api/v1/capabilities");
    expect(r.statusCode).toBe(200);
    expect(r.json().data.parseMode).toBe("mock");
    await a.close();
  });
  it("returns a labelled mock draft without guessing missing packaging", async () => {
    const r = await request({ text: "这盒布洛芬放在黑色背包前袋" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toMatchObject({
      mode: "mock",
      status: "ready",
      candidate: { medicineName: "布洛芬", locationText: "黑色背包前袋" },
    });
  });
  it("does not fabricate unknown text into the fixed demo", async () => {
    const r = await request({ text: "那盒药放回原处了" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toMatchObject({
      status: "needs-confirmation",
      candidate: { medicineName: null, locationText: null },
    });
  });
  it("rejects extra properties", async () => {
    expect((await request({ text: "foo", apiKey: "secret" })).statusCode).toBe(
      422,
    );
  });
  it("rejects whitespace-only input", async () => {
    expect((await request({ text: "  " })).statusCode).toBe(422);
  });
  it("does not provide medication advice", async () => {
    const r = await request({ text: "头痛应该吃什么药" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.status).toBe("out-of-scope");
  });
  it("sanitizes upstream errors", async () => {
    const r = await request(
      { text: "记录" },
      {
        mode: "live",
        provider: async () => {
          throw new Error("SECRET_PROVIDER_TOKEN");
        },
      },
    );
    expect(r.statusCode).toBe(502);
    expect(r.body).not.toContain("SECRET_PROVIDER_TOKEN");
  });
  it("rejects malformed provider output", async () => {
    const r = await request(
      { text: "记录" },
      { mode: "live", provider: async () => ({ location: "invented" }) },
    );
    expect(r.statusCode).toBe(502);
  });
  it("times out a provider rather than hanging forever", async () => {
    const r = await request(
      { text: "记录" },
      { mode: "live", timeoutMs: 10, provider: () => new Promise(() => {}) },
    );
    expect(r.statusCode).toBe(504);
  });
  it("rejects an untrusted browser origin", async () => {
    const a = buildApp();
    const r = await a.inject({
      method: "POST",
      url: "/api/v1/parse-previews",
      headers: { origin: "https://bad.example" },
      payload: { text: "record" },
    });
    expect(r.statusCode).toBe(403);
    await a.close();
  });
});
