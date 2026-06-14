import {
  encodingForModel,
  getEncoding,
  type Tiktoken,
  type TiktokenModel,
} from "js-tiktoken";

export const maxUserMessageTokens = 120;

let cachedEncoding: Tiktoken | null = null;
let cachedModel: string | null = null;

export function countUserMessageTokens(message: string) {
  return getUserMessageEncoding(process.env.API_MODEL).encode(message).length;
}

function getUserMessageEncoding(model: string | undefined) {
  const normalizedModel = model?.trim() ?? "";

  if (cachedEncoding && cachedModel === normalizedModel) {
    return cachedEncoding;
  }

  cachedModel = normalizedModel;

  try {
    cachedEncoding = normalizedModel
      ? encodingForModel(normalizedModel as TiktokenModel)
      : getEncoding("o200k_base");
  } catch {
    cachedEncoding = getEncoding("o200k_base");
  }

  return cachedEncoding;
}
