import { getConfig } from '../config.js'
import { codexProvider } from './model_providers/codex_provider.js'
import { openAIProvider } from './model_providers/openai_provider.js'
import type { ModelCapabilities, ModelInvokeOptions, ModelProvider } from './model_providers/types.js'

const providers: Partial<Record<string, ModelProvider>> = {
  openai_api: openAIProvider,
  codex: codexProvider,
}

function resolveModel(modelName: string) {
  const config = getConfig()
  const modelConfig = config.models.available.find((model) => model.name === modelName)
  if (!modelConfig) throw new Error(`Model ${modelName} not found in config`)

  const provider = providers[modelConfig.type]
  if (!provider) {
    throw new Error(`Unsupported legacy model type ${modelConfig.type}; migrate to openai_api or codex`)
  }
  return { modelConfig, provider }
}

export function getModelCapabilities(modelName: string): ModelCapabilities {
  const { modelConfig, provider } = resolveModel(modelName)
  return provider.capabilities(modelConfig)
}

/** Resolve a configured model to its first-class provider and return authoritative final text. */
export async function callModel(
  prompt: string,
  modelName: string,
  options: ModelInvokeOptions = {},
): Promise<string> {
  const { modelConfig, provider } = resolveModel(modelName)
  return provider.invoke(prompt, modelConfig, options)
}

export type { ModelCapabilities, ModelInvokeOptions } from './model_providers/types.js'
