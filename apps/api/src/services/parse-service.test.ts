import { it, expect } from "vitest";
import { mockProvider, parseText } from "./parse-service";
it("does not accept alternative locations as one certain location", async () => {
  expect(
    await parseText({ text: "布洛芬放在桌上或者抽屉里" }, mockProvider, "mock"),
  ).toMatchObject({
    status: "needs-confirmation",
    candidate: { locationText: null },
  });
});
it("does not mistake a pronoun for a medicine name", async () => {
  expect(
    await parseText({ text: "这盒药放在桌上" }, mockProvider, "mock"),
  ).toMatchObject({
    status: "needs-confirmation",
    candidate: { medicineName: null },
  });
});
