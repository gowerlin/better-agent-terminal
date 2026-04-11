// OpenCC simplified-to-traditional Chinese converter (lazy singleton)
//
// Dictionary is loaded once on first use. If opencc-js fails to initialize
// (missing package, corrupt dictionary), we log a warning and fall back to
// returning the original text — never throw.

import { logger } from './logger'

// opencc-js ships without TypeScript declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const openccJs: {
  Converter: (opts: { from: string; to: string }) => (text: string) => string
} = require('opencc-js')

let converter: ((text: string) => string) | null = null
let initAttempted = false

function ensureConverter(): ((text: string) => string) | null {
  if (converter) return converter
  if (initAttempted) return null
  initAttempted = true
  try {
    converter = openccJs.Converter({ from: 'cn', to: 'tw' })
    logger.log('[voice] OpenCC s2t converter initialized')
    return converter
  } catch (err) {
    logger.error('[voice] OpenCC initialization failed:', err)
    return null
  }
}

/**
 * Convert simplified Chinese text to traditional Chinese.
 * Returns the original text unchanged if OpenCC is unavailable or conversion fails.
 */
export function convertSimplifiedToTraditional(text: string): string {
  const conv = ensureConverter()
  if (!conv) {
    logger.warn('[voice] OpenCC not available, returning original text')
    return text
  }
  try {
    return conv(text)
  } catch (err) {
    logger.warn('[voice] OpenCC conversion failed, returning original text:', err)
    return text
  }
}
