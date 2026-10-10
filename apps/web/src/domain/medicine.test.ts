import { describe, it, expect } from "vitest";
import { normalize, deriveClue } from "./medicine";
describe("medicine domain", () => {
  it("normalizes full width names and whitespace for duplicate detection", () => {
    expect(normalize("  ＡＢＣ  ")).toBe("abc");
  });
  it("uses sequence instead of device clock and ignores old-location feedback", () => {
    const observations = [
      { id: "a", seq: 1, confirmedAt: "2026-10-10", locationText: "背包" },
      { id: "b", seq: 3, confirmedAt: "2026-10-09", locationText: "行李箱" },
    ];
    expect(
      deriveClue(observations, [
        { observationId: "a", seq: 2, outcome: "not-found" },
      ]),
    ).toMatchObject({ observation: { id: "b" }, state: "recorded" });
  });
  it("a later found feedback supersedes a miss without changing photo time", () => {
    expect(
      deriveClue(
        [{ id: "a", seq: 1, photoId: "photo" }],
        [
          { observationId: "a", seq: 2, outcome: "not-found" },
          { observationId: "a", seq: 3, outcome: "found" },
        ],
      ),
    ).toMatchObject({
      state: "found-at-time",
      observation: { photoId: "photo" },
      latestFeedback: { seq: 3 },
    });
  });
  it("does not treat no records as no inventory", () => {
    expect(deriveClue([], [])).toMatchObject({ state: "empty" });
  });
});
