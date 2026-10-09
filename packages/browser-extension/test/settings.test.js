import { describe, it, expect } from 'bun:test'
import { mergeSettings } from '../src/settings.js'

describe('mergeSettings', () => {
  const preset = { base_url: 'https://preset.example', token: 'preset-token' }

  it('uses the preset when nothing is saved', () => {
    expect(mergeSettings({}, preset)).toEqual(preset)
  })

  it('prefers saved values, per field', () => {
    expect(mergeSettings({ base_url: 'https://saved.example', token: 'saved' }, preset))
      .toEqual({ base_url: 'https://saved.example', token: 'saved' })
    expect(mergeSettings({ token: 'saved' }, preset)).toEqual({ base_url: 'https://preset.example', token: 'saved' })
  })

  it('treats a missing or malformed preset as empty', () => {
    expect(mergeSettings({}, null)).toEqual({ base_url: '', token: '' })
    expect(mergeSettings({}, { base_url: 42, token: ['x'] })).toEqual({ base_url: '', token: '' })
  })
})
