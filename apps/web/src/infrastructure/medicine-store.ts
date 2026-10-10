import Dexie, { type Table } from "dexie";
import {
  DomainError,
  deriveClue,
  field,
  normalize,
  type Package,
  type Observation,
  type Feedback,
  type Photo,
  type Command,
  type Receipt,
} from "../domain/medicine";
export class MedicineDB extends Dexie {
  packages!: Table<Package, string>;
  observations!: Table<Observation, string>;
  feedback!: Table<Feedback, string>;
  photos!: Table<Photo, string>;
  commands!: Table<
    { id: string; fingerprint: string; receipt: Receipt },
    string
  >;
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      packages: "id,nameKey,&[nameKey+labelKey]",
      observations: "id,packageId,&[packageId+seq]",
      feedback: "id,packageId,observationId,&[packageId+seq]",
      photos: "id,&observationId",
      commands: "id",
    });
  }
}
function fingerprint(command: Command) {
  const photo = command.kind === "feedback" ? null : command.photo;
  const meta = photo
    ? {
        sha256: photo.sha256,
        mimeType: photo.mimeType,
        width: photo.width,
        height: photo.height,
        byteSize: photo.byteSize,
        addedAt: photo.addedAt,
        capturedAt: photo.capturedAt,
      }
    : null;
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, stable(v)]),
          )
        : value;
  return JSON.stringify(
    stable({
      ...command,
      ...(command.kind === "feedback" ? {} : { photo: meta }),
    }),
  );
}
export class MedicineStore {
  readonly db: MedicineDB;
  constructor(public name = "medicine-location-v1") {
    this.db = new MedicineDB(name);
  }
  async execute(input: Command): Promise<Receipt> {
    const command = structuredClone(input);
    if (!command.commandId) throw new DomainError("VALIDATION_ERROR");
    if (command.kind !== "feedback") {
      command.locationText = field(command.locationText, 200);
      if (
        !["manual", "ai-confirmed", "mock-confirmed"].includes(command.source)
      )
        throw new DomainError("VALIDATION_ERROR");
      if (
        command.photo &&
        (!(command.photo.blob instanceof Blob) ||
          command.photo.blob.size > 2 * 1024 * 1024 ||
          command.photo.blob.type !== "image/jpeg")
      )
        throw new DomainError("PHOTO_INVALID");
    }
    if (command.kind === "create-record") {
      command.medicineName = field(command.medicineName, 120);
      command.label = field(command.label, 40, true);
    }
    const fp = fingerprint(command);
    try {
      return await this.db.transaction("rw", this.db.tables, async () => {
        const previous = await this.db.commands.get(command.commandId);
        if (previous) {
          if (previous.fingerprint !== fp)
            throw new DomainError("COMMAND_CONFLICT");
          return previous.receipt;
        }
        const now = new Date().toISOString();
        let pack: Package;
        if (command.kind === "create-record") {
          const nameKey = normalize(command.medicineName),
            labelKey = normalize(command.label);
          const same = await this.db.packages
            .where("nameKey")
            .equals(nameKey)
            .toArray();
          if (
            same.some((p) => p.labelKey === labelKey) ||
            (same.length > 0 && !labelKey)
          )
            throw new DomainError("DUPLICATE_PACKAGE");
          pack = {
            id: crypto.randomUUID(),
            medicineName: command.medicineName,
            label: command.label,
            nameKey,
            labelKey,
            revision: 1,
            createdAt: now,
          };
        } else {
          const current = await this.db.packages.get(command.packageId);
          if (!current) throw new DomainError("NOT_FOUND");
          if (current.revision !== command.expectedRevision)
            throw new DomainError("STALE_RECORD");
          pack = { ...current, revision: current.revision + 1 };
        }
        let observationId: string;
        let feedbackId: string | null = null;
        if (command.kind === "feedback") {
          const latest = await this.db.observations
            .where("packageId")
            .equals(pack.id)
            .sortBy("seq");
          if (latest.at(-1)?.id !== command.observationId)
            throw new DomainError("STALE_RECORD");
          if (!["found", "not-found"].includes(command.outcome))
            throw new DomainError("VALIDATION_ERROR");
          observationId = command.observationId;
          feedbackId = crypto.randomUUID();
          await this.db.feedback.add({
            id: feedbackId,
            packageId: pack.id,
            observationId,
            seq: pack.revision,
            outcome: command.outcome,
            recordedAt: now,
          });
        } else {
          observationId = crypto.randomUUID();
          const photoId = command.photo ? crypto.randomUUID() : null;
          await this.db.observations.add({
            id: observationId,
            packageId: pack.id,
            seq: pack.revision,
            locationText: command.locationText,
            confirmedAt: now,
            source: command.source,
            photoId,
          });
          if (command.photo && photoId)
            await this.db.photos.add({
              ...command.photo,
              id: photoId,
              observationId,
            });
        }
        await this.db.packages.put(pack);
        const receipt = {
          commandId: command.commandId,
          packageId: pack.id,
          observationId,
          feedbackId,
          revision: pack.revision,
          committedAt: now,
        };
        await this.db.commands.add({
          id: command.commandId,
          fingerprint: fp,
          receipt,
        });
        return receipt;
      });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(
        e instanceof Error && e.name === "QuotaExceededError"
          ? "STORAGE_FULL"
          : "SAVE_FAILED",
      );
    }
  }
  async search(q: string, offset = 0, limit = 20) {
    const query = normalize(q);
    if (!query) return [];
    const all = await this.db.packages
      .filter((p) => p.nameKey.includes(query))
      .toArray();
    return all
      .sort(
        (a, b) =>
          a.nameKey.localeCompare(b.nameKey) ||
          a.labelKey.localeCompare(b.labelKey) ||
          a.id.localeCompare(b.id),
      )
      .slice(
        Math.max(0, offset),
        Math.max(0, offset) + Math.min(100, Math.max(1, limit)),
      );
  }
  async clue(id: string) {
    return this.db.transaction(
      "r",
      this.db.packages,
      this.db.observations,
      this.db.feedback,
      async () => {
        const pack = await this.db.packages.get(id);
        if (!pack) throw new DomainError("NOT_FOUND");
        return {
          package: pack,
          ...deriveClue(
            await this.db.observations.where("packageId").equals(id).toArray(),
            await this.db.feedback.where("packageId").equals(id).toArray(),
          ),
        };
      },
    );
  }
  async history(id: string, beforeSeq = Infinity, limit = 20) {
    const observations = await this.db.observations
      .where("packageId")
      .equals(id)
      .toArray();
    const feedback = await this.db.feedback
      .where("packageId")
      .equals(id)
      .toArray();
    return [
      ...observations.map((o) => ({ ...o, type: "location" as const })),
      ...feedback.map((f) => ({
        ...f,
        type: "feedback" as const,
        locationText:
          observations.find((o) => o.id === f.observationId)?.locationText ??
          "",
      })),
    ]
      .filter((e) => e.seq < beforeSeq)
      .sort((a, b) => b.seq - a.seq)
      .slice(0, Math.min(100, limit));
  }
  async photo(id: string) {
    return this.db.photos.get(id);
  }
  async close() {
    this.db.close();
  }
}
