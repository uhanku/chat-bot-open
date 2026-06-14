export type OpenAIModel = "gpt-5.4-nano" | "gpt-5.4-mini";

type ModelPricing = {
  inputPricePer1M: number;
  cachedInputPricePer1M: number;
  outputPricePer1M: number;
};

const pricing: Record<OpenAIModel, ModelPricing> = {
  "gpt-5.4-nano": {
    inputPricePer1M: 0.2,
    cachedInputPricePer1M: 0.02,
    outputPricePer1M: 1.25,
  },
  "gpt-5.4-mini": {
    inputPricePer1M: 0.75,
    cachedInputPricePer1M: 0.075,
    outputPricePer1M: 4.5,
  },
};

export function getOpenAIModelPricing(model: OpenAIModel): ModelPricing {
  return pricing[model];
}

export function isOpenAIModel(model: string | undefined): model is OpenAIModel {
  return model === "gpt-5.4-nano" || model === "gpt-5.4-mini";
}

export function calculateOpenAIChatPrice(
  model: OpenAIModel,
  inputTokens: number,
  outputTokens: number,
) {
  const modelPricing = getOpenAIModelPricing(model);

  return (
    (inputTokens / 1_000_000) * modelPricing.inputPricePer1M +
    (outputTokens / 1_000_000) * modelPricing.outputPricePer1M
  );
}
