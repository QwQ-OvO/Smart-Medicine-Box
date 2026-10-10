import type { FromSchema } from "json-schema-to-ts";
export const parseRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: {
    text: { type: "string", minLength: 1, maxLength: 1000, pattern: "\\S" },
    selectedMedicineName: { type: "string", minLength: 1, maxLength: 120 },
  },
} as const;
export type ParseRequest = FromSchema<typeof parseRequestSchema>;
export const previewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "status", "candidate", "missingFields", "issues"],
  properties: {
    mode: { enum: ["live", "mock"] },
    status: { enum: ["ready", "needs-confirmation", "out-of-scope"] },
    candidate: {
      type: "object",
      additionalProperties: false,
      required: ["medicineName", "locationText"],
      properties: {
        medicineName: {
          type: ["string", "null"],
          minLength: 1,
          maxLength: 120,
        },
        locationText: {
          type: ["string", "null"],
          minLength: 1,
          maxLength: 200,
        },
      },
    },
    missingFields: {
      type: "array",
      uniqueItems: true,
      items: { enum: ["medicineName", "locationText"] },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "code"],
        properties: {
          field: { enum: ["medicineName", "locationText", "text"] },
          code: {
            enum: [
              "missing-field",
              "ambiguous",
              "conflicting-input",
              "out-of-scope",
            ],
          },
        },
      },
    },
  },
} as const;
export type ParsePreview = FromSchema<typeof previewSchema>;
export const parseResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["data", "requestId"],
  properties: { data: previewSchema, requestId: { type: "string" } },
} as const;
export function consistentPreview(p: ParsePreview): boolean {
  const missing = (["medicineName", "locationText"] as const).filter(
    (k) => p.candidate[k] === null,
  );
  if (p.status === "out-of-scope")
    return (
      missing.length === 2 &&
      p.missingFields.length === 0 &&
      p.issues.some((i) => i.code === "out-of-scope")
    );
  if (p.status === "ready")
    return (
      missing.length === 0 &&
      p.issues.length === 0 &&
      p.missingFields.length === 0 &&
      Object.values(p.candidate).every((v) => !!v?.trim())
    );
  return (
    p.issues.length > 0 &&
    missing.length === p.missingFields.length &&
    missing.every(
      (k) =>
        p.missingFields.includes(k) &&
        p.issues.some((i) => i.field === k && i.code === "missing-field"),
    )
  );
}
