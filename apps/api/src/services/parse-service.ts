import Ajv from "ajv";
import {
  previewSchema,
  consistentPreview,
  type ParseRequest,
  type ParsePreview,
} from "@medicine/contracts";
export type Provider = (
  input: ParseRequest,
  signal: AbortSignal,
) => Promise<unknown>;
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const validate = new Ajv({ strict: false }).compile(previewSchema);
export const mockProvider: Provider = async (input) => {
  if (/吃什么|推荐.*药|剂量|诊断|怎么治/.test(input.text))
    return {
      mode: "mock",
      status: "out-of-scope",
      candidate: { medicineName: null, locationText: null },
      missingFields: [],
      issues: [{ field: "text", code: "out-of-scope" }],
    };
  // Explicit, deterministic demonstration grammar; not advertised as a real model.
  const match = input.text.match(
    /^(?:这盒)?([^（(]+?)(?:[（(][^）)]+[）)])?放在(.+?)[。.!！]?$/,
  );
  const extractedName = match?.[1]?.trim() ?? null;
  const medicineName =
    extractedName && !/^(药|药品|它|这个|那盒药)$/.test(extractedName)
      ? extractedName
      : (input.selectedMedicineName ?? null);
  const locationText = /或者|还是|可能|好像|不确定|忘了/.test(input.text)
    ? null
    : (match?.[2]?.trim() ?? null);
  const missingFields = (["medicineName", "locationText"] as const).filter(
    (k) => ({ medicineName, locationText })[k] === null,
  );
  return {
    mode: "mock",
    status: missingFields.length ? "needs-confirmation" : "ready",
    candidate: { medicineName, locationText },
    missingFields,
    issues: missingFields.map((field) => ({ field, code: "missing-field" })),
  };
};
export async function parseText(
  input: ParseRequest,
  provider: Provider,
  mode: "mock" | "live",
  timeoutMs = 12000,
): Promise<ParsePreview> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const raw = await Promise.race([
      provider(input, controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ApiError(504, "PARSE_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
    if (!validate(raw) || !consistentPreview(raw as ParsePreview))
      throw new ApiError(502, "INVALID_PROVIDER_RESPONSE");
    const data = { ...(raw as ParsePreview), mode };
    if (
      input.selectedMedicineName &&
      data.candidate.medicineName &&
      data.candidate.medicineName !== input.selectedMedicineName
    ) {
      data.status = "needs-confirmation";
      data.issues = [
        ...data.issues,
        { field: "medicineName", code: "conflicting-input" },
      ];
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(502, "PROVIDER_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
