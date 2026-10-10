import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { MedicineStore } from "./medicine-store";
import type { Command } from "../domain/medicine";
const names: string[] = [];
function store() {
  const name = crypto.randomUUID();
  names.push(name);
  return new MedicineStore(name);
}
const create = (more = {}): Extract<Command, { kind: "create-record" }> => ({
  kind: "create-record",
  commandId: crypto.randomUUID(),
  medicineName: "布洛芬",
  label: "随身盒",
  locationText: "黑色背包前袋",
  source: "manual",
  photo: null,
  ...more,
});
afterEach(async () => {
  for (const name of names.splice(0)) await Dexie.delete(name);
});
describe("atomic local records", () => {
  it("rolls back every table when saving a photo fails", async () => {
    const s = store();
    const fail = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    s.db.photos.hook("creating", fail);
    await expect(
      s.execute(
        create({
          photo: {
            blob: new Blob(["x"], { type: "image/jpeg" }),
            sha256: "x",
            mimeType: "image/jpeg",
            width: 1,
            height: 1,
            byteSize: 1,
            addedAt: new Date().toISOString(),
            capturedAt: null,
          },
        }),
      ),
    ).rejects.toThrow();
    expect(await s.db.packages.count()).toBe(0);
    expect(await s.db.observations.count()).toBe(0);
    expect(await s.db.commands.count()).toBe(0);
    await s.close();
  });
  it("serializes competing updates and rejects the stale writer", async () => {
    const s = store();
    const r = await s.execute(create());
    const results = await Promise.allSettled(
      ["书桌", "柜子"].map((locationText) =>
        s.execute({
          kind: "record-location",
          commandId: crypto.randomUUID(),
          packageId: r.packageId,
          expectedRevision: 1,
          locationText,
          source: "manual",
          photo: null,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await s.history(r.packageId)).toHaveLength(2);
    await s.close();
  });
  it("persists a confirmed record across reopen", async () => {
    const s = store();
    const r = await s.execute(create());
    await s.close();
    const again = new MedicineStore(s.name);
    expect(await again.clue(r.packageId)).toMatchObject({
      package: { medicineName: "布洛芬" },
      observation: { locationText: "黑色背包前袋" },
      state: "recorded",
    });
    await again.close();
  });
  it("retries one command without inserting a second observation", async () => {
    const s = store(),
      c = create();
    const a = await s.execute(c);
    expect(await s.execute(c)).toEqual(a);
    expect(await s.history(a.packageId)).toHaveLength(1);
    await s.close();
  });
  it("rejects changed content under the same command id", async () => {
    const s = store(),
      c = create();
    await s.execute(c);
    await expect(s.execute({ ...c, locationText: "桌子" })).rejects.toThrow(
      "COMMAND_CONFLICT",
    );
    await s.close();
  });
  it("separates same-name packages and refuses duplicate normalized labels", async () => {
    const s = store();
    await s.execute(create());
    await s.execute(create({ label: "家用盒" }));
    expect(await s.search("布洛")).toHaveLength(2);
    await expect(s.execute(create({ label: " 随身盒 " }))).rejects.toThrow(
      "DUPLICATE_PACKAGE",
    );
    await s.close();
  });
  it("permits one unnamed package but requires a label for the next", async () => {
    const s = store();
    await s.execute(create({ label: "" }));
    await expect(s.execute(create({ label: "" }))).rejects.toThrow(
      "DUPLICATE_PACKAGE",
    );
    await s.close();
  });
  it("rejects blank location without creating a package", async () => {
    const s = store();
    await expect(s.execute(create({ locationText: "  " }))).rejects.toThrow(
      "VALIDATION_ERROR",
    );
    expect(await s.search("布洛芬")).toHaveLength(0);
    await s.close();
  });
  it("keeps miss history while new location becomes current", async () => {
    const s = store(),
      a = await s.execute(create());
    await s.execute({
      kind: "feedback",
      commandId: crypto.randomUUID(),
      packageId: a.packageId,
      expectedRevision: 1,
      observationId: a.observationId,
      outcome: "not-found",
    });
    expect(await s.clue(a.packageId)).toMatchObject({ state: "not-found" });
    await s.execute({
      kind: "record-location",
      commandId: crypto.randomUUID(),
      packageId: a.packageId,
      expectedRevision: 2,
      locationText: "行李箱内侧袋",
      source: "manual",
      photo: null,
    });
    expect(await s.clue(a.packageId)).toMatchObject({
      state: "recorded",
      observation: { locationText: "行李箱内侧袋", photoId: null },
    });
    expect(await s.history(a.packageId)).toHaveLength(3);
    await s.close();
  });
  it("rejects stale feedback rather than applying it to a newer observation", async () => {
    const s = store(),
      a = await s.execute(create());
    await s.execute({
      kind: "record-location",
      commandId: crypto.randomUUID(),
      packageId: a.packageId,
      expectedRevision: 1,
      locationText: "桌上",
      source: "manual",
      photo: null,
    });
    await expect(
      s.execute({
        kind: "feedback",
        commandId: crypto.randomUUID(),
        packageId: a.packageId,
        expectedRevision: 1,
        observationId: a.observationId,
        outcome: "found",
      }),
    ).rejects.toThrow("STALE_RECORD");
    await s.close();
  });
  it("stores photo bytes with the observation and never inherits them on move", async () => {
    const s = store();
    const photo = {
      blob: new Blob(["fixture"], { type: "image/jpeg" }),
      sha256: "fixture",
      mimeType: "image/jpeg",
      width: 10,
      height: 10,
      byteSize: 7,
      addedAt: "2026-10-10T00:00:00Z",
      capturedAt: null,
    };
    const a = await s.execute(create({ photo }));
    const old = await s.clue(a.packageId);
    expect((await s.photo(old.observation.photoId!))!.blob.size).toBe(7);
    await s.execute({
      kind: "record-location",
      commandId: crypto.randomUUID(),
      packageId: a.packageId,
      expectedRevision: 1,
      locationText: "柜子",
      source: "manual",
      photo: null,
    });
    expect((await s.clue(a.packageId)).observation.photoId).toBeNull();
    expect((await s.photo(old.observation.photoId!))!.capturedAt).toBeNull();
    await s.close();
  });
});
