import { loadSettings, saveSettings } from './settings.js'

const form = document.getElementById('form')
const baseUrl = document.getElementById('base_url')
const token = document.getElementById('token')
const status = document.getElementById('status')

const current = await loadSettings()
baseUrl.value = current.base_url
token.value = current.token

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!/^https?:\/\//i.test(baseUrl.value.trim())) {
    status.textContent = 'URL must start with http:// or https://'
    return
  }
  await saveSettings({ base_url: baseUrl.value, token: token.value })
  baseUrl.value = baseUrl.value.trim().replace(/\/+$/, '')
  status.textContent = 'Saved ✓'
  setTimeout(() => { status.textContent = '' }, 2000)
})
