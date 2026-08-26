import { describe, expect, test } from 'bun:test'
import { resolveRegenerationPrompt } from './qa_prompt.js'

describe('resolveRegenerationPrompt', () => {
  test('preset reruns always use the latest config text', () => {
    expect(resolveRegenerationPrompt({
      type: 'template',
      entry_prompt: 'old preset text',
      template_prompt: 'latest preset text',
      legacy_result_prompt: 'older result text',
    })).toBe('latest preset text')
  })

  test('free reruns use the immutable entry text', () => {
    expect(resolveRegenerationPrompt({
      type: 'free',
      entry_prompt: 'original user question',
      legacy_result_prompt: 'different historical result prompt',
    })).toBe('original user question')
  })

  test('legacy free entries can recover from a previous result', () => {
    expect(resolveRegenerationPrompt({
      type: 'free',
      entry_prompt: null,
      legacy_result_prompt: 'recoverable legacy question',
    })).toBe('recoverable legacy question')
  })

  test('a never-successful legacy free entry remains unrecoverable', () => {
    expect(resolveRegenerationPrompt({
      type: 'free',
      entry_prompt: null,
      legacy_result_prompt: null,
    })).toBeNull()
  })
})
