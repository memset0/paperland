import { getConfig } from '../config.js'
import { codexProvider } from './model_providers/codex_provider.js'
import { openAIProvider } from './model_providers/openai_provider.js'
import type { ModelCapabilities, ModelInput, ModelInvokeOptions, ModelProvider } from './model_providers/types.js'
import { toModelInput } from './model_providers/types.js'

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
  input: string | ModelInput,
  modelName: string,
  options: ModelInvokeOptions = {},
): Promise<string> {
  const { modelConfig, provider } = resolveModel(modelName)
  return provider.invoke(toModelInput(input), modelConfig, options)
}

/** Whether a configured model runs on Codex app-server, the only path that can attach MCP tools. */
export function modelSupportsAgentTools(modelName: string): boolean {
  const { modelConfig } = resolveModel(modelName)
  return modelConfig.type === 'codex' && modelConfig.stream === true
}

/** Whether a configured model accepts image input (`vision: true`). */
export function modelSupportsVision(modelName: string): boolean {
  return resolveModel(modelName).modelConfig.vision === true
}

export type { ModelCapabilities, ModelInput, ModelInputPart, ModelInvokeOptions, ModelUsage } from './model_providers/types.js'
