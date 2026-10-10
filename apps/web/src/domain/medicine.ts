export type Source = "manual" | "ai-confirmed" | "mock-confirmed";
export type Package = {
  id: string;
  medicineName: string;
  nameKey: string;
  label: string;
  labelKey: string;
  revision: number;
  createdAt: string;
};
export type Observation = {
  id: string;
  packageId: string;
  seq: number;
  locationText: string;
  confirmedAt: string;
  source: Source;
  photoId: string | null;
};
export type Feedback = {
  id: string;
  packageId: string;
  observationId: string;
  seq: number;
  outcome: "found" | "not-found";
  recordedAt: string;
};
export type PreparedPhoto = {
  blob: Blob;
  sha256: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  byteSize: number;
  addedAt: string;
  capturedAt: string | null;
};
export type Photo = PreparedPhoto & { id: string; observationId: string };
export type Command = { commandId: string } & (
  | {
      kind: "create-record";
      medicineName: string;
      label: string;
      locationText: string;
      source: Source;
      photo: PreparedPhoto | null;
    }
  | {
      kind: "record-location";
      packageId: string;
      expectedRevision: number;
      locationText: string;
      source: Source;
      photo: PreparedPhoto | null;
    }
  | {
      kind: "feedback";
      packageId: string;
      expectedRevision: number;
      observationId: string;
      outcome: "found" | "not-found";
    }
);
export type Receipt = {
  commandId: string;
  packageId: string;
  observationId: string;
  feedbackId: string | null;
  revision: number;
  committedAt: string;
};
export type Clue = ReturnType<typeof deriveClue> & { package: Package };
export class DomainError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "DomainError";
  }
}
export function normalize(value: string) {
  return value.trim().normalize("NFKC").toLowerCase();
}
export function field(value: string, max: number, optional = false) {
  if (
    typeof value !== "string" ||
    (!optional && !normalize(value)) ||
    [...value.trim()].length > max
  )
    throw new DomainError("VALIDATION_ERROR");
  return value.trim();
}
export function deriveClue<
  O extends { id: string; seq: number },
  F extends { observationId: string; seq: number; outcome: string },
>(observations: O[], feedback: F[]) {
  const observation =
    [...observations].sort((a, b) => b.seq - a.seq)[0] ?? null;
  const latestFeedback = observation
    ? ([...feedback]
        .filter((f) => f.observationId === observation.id)
        .sort((a, b) => b.seq - a.seq)[0] ?? null)
    : null;
  const state: "empty" | "recorded" | "not-found" | "found-at-time" =
    !observation
      ? "empty"
      : latestFeedback?.outcome === "not-found"
        ? "not-found"
        : latestFeedback?.outcome === "found"
          ? "found-at-time"
          : "recorded";
  return { observation, latestFeedback, state };
}
