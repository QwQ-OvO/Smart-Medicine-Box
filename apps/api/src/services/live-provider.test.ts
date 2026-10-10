import { it, expect, vi } from "vitest";
import { liveProvider } from "./live-provider";
it("sends only text and keeps credentials on the server", async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  status: "ready",
                  candidate: { medicineName: "布洛芬", locationText: "桌上" },
                  missingFields: [],
                  issues: [],
                }),
              },
            },
          ],
        }),
      ),
  );
  const provider = liveProvider(
    {
      url: "https://example.com/v1/chat/completions",
      key: "secret",
      model: "configured-model",
    },
    fetcher,
  );
  expect(
    await provider({ text: "布洛芬放在桌上" }, new AbortController().signal),
  ).toMatchObject({ mode: "live", status: "ready" });
  const options = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(options[1].headers).toMatchObject({ Authorization: "Bearer secret" });
  expect(JSON.parse(options[1].body as string).messages[1].content).toContain(
    "布洛芬放在桌上",
  );
});
it("does not follow redirects that could disclose credentials", async () => {
  const fetcher = vi.fn(async () => new Response("", { status: 302 }));
  await expect(
    liveProvider(
      { url: "https://example.com", key: "secret", model: "m" },
      fetcher,
    )({ text: "药放在桌上" }, new AbortController().signal),
  ).rejects.toThrow();
});
