import { createI18n } from 'vue-i18n'
import zhCN from '../locales/zh-CN.json'
import zhTW from '../locales/zh-TW.json'
import enUS from '../locales/en-US.json'
import es from '../locales/es.json'
import de from '../locales/de.json'
import fr from '../locales/fr.json'
import ptBR from '../locales/pt-BR.json'
import ko from '../locales/ko.json'
import ja from '../locales/ja.json'

const STORAGE_KEY = 'git-client-locale'
const SUPPORTED_LOCALES = [
  'en-US',
  'es',
  'de',
  'fr',
  'pt-BR',
  'ko',
  'ja',
  'zh-CN',
  'zh-TW'
]

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function mergeMessages(base, overrides) {
  const output = { ...base }
  for (const key of Object.keys(overrides || {})) {
    const baseValue = output[key]
    const overrideValue = overrides[key]
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      output[key] = mergeMessages(baseValue, overrideValue)
    } else {
      output[key] = overrideValue
    }
  }
  return output
}

function normalizeLocale(rawCode) {
  if (!rawCode) return ''
  const code = String(rawCode).trim()
  if (!code) return ''
  const lower = code.toLowerCase()
  if (lower.startsWith('en')) return 'en-US'
  if (lower.startsWith('es')) return 'es'
  if (lower.startsWith('de')) return 'de'
  if (lower.startsWith('fr')) return 'fr'
  if (lower.startsWith('pt-br')) return 'pt-BR'
  if (lower.startsWith('pt')) return 'pt-BR'
  if (lower.startsWith('ko')) return 'ko'
  if (lower.startsWith('ja')) return 'ja'
  if (lower === 'zh-tw' || lower.startsWith('zh-hant')) return 'zh-TW'
  if (lower.startsWith('zh')) return 'zh-CN'
  return SUPPORTED_LOCALES.includes(code) ? code : ''
}

function getInitialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const normalizedSaved = normalizeLocale(saved)
    if (normalizedSaved) return normalizedSaved
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    const normalizedLang = normalizeLocale(navigator.language)
    if (normalizedLang) return normalizedLang
  }
  return 'en-US'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: {
    'zh-CN': ['zh-CN', 'en-US'],
    'zh-TW': ['zh-TW', 'zh-CN', 'en-US'],
    default: ['en-US', 'zh-CN']
  },
  messages: {
    'en-US': enUS,
    es: mergeMessages(enUS, es),
    de: mergeMessages(enUS, de),
    fr: mergeMessages(enUS, fr),
    'pt-BR': mergeMessages(enUS, ptBR),
    ko: mergeMessages(enUS, ko),
    ja: mergeMessages(enUS, ja),
    'zh-CN': zhCN,
    'zh-TW': mergeMessages(zhCN, zhTW)
  }
})

export function persistLocale(code) {
  try {
    const normalized = normalizeLocale(code)
    if (!normalized) return
    localStorage.setItem(STORAGE_KEY, normalized)
  } catch {
    /* ignore */
  }
}
