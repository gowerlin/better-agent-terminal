// BUG-084 / T0374 — shared per-MTok model pricing for the Cache History cost view
// (previously duplicated inline in ClaudeAgentPanel.tsx and CodexAgentPanel.tsx).
//
// Exact model match only, no fallback: unknown IDs return null and the UI shows `—`.
// Ref: https://platform.claude.com/docs/en/about-claude/pricing

export interface ModelPricing {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

export function P(input: number, output: number, opts?: { cacheReadMultiplier?: number }): ModelPricing {
  const cacheReadMultiplier = opts?.cacheReadMultiplier ?? 0.1
  return { input, output, cacheRead: input * cacheReadMultiplier, cacheWrite5m: input * 1.25, cacheWrite1h: input * 2 }
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 5 — T0368 §4 (pricing page, 2026-10-04). Opus 5.5 / Fable 5.1 cache read is 0.05x / 0.025x.
  'opus-5-5':  P(4, 20, { cacheReadMultiplier: 0.05 }),
  'fable-5-1': P(10, 50, { cacheReadMultiplier: 0.025 }),
  'sonnet-5-5': P(2, 10),
  'opus-5':    P(5, 25),    'opus-4-8':  P(5, 25),
  'sonnet-5':  P(2, 10),    'fable-5':   P(10, 50),
  'opus-4-7':  P(5, 25),    'opus-4-6':  P(5, 25),    'opus-4-5':  P(5, 25),
  'opus-4-1':  P(15, 75),   'opus-4':    P(15, 75),   'opus-3': P(15, 75),
  'sonnet-4-6': P(3, 15),   'sonnet-4-5': P(3, 15),   'sonnet-4': P(3, 15),
  'sonnet-3-7': P(3, 15),   'sonnet-3-5': P(3, 15),
  'haiku-4-5': P(1, 5),     'haiku-3-5': P(0.80, 4),  'haiku-3': P(0.25, 1.25),
}

export function getModelPricing(model: string): ModelPricing | null {
  // `includes` is a prefix trap: the point releases must be checked before their base model.
  if (model.includes('opus-5-5')) return MODEL_PRICING['opus-5-5']
  if (model.includes('opus-5')) return MODEL_PRICING['opus-5']
  if (model.includes('opus-4-8')) return MODEL_PRICING['opus-4-8']
  if (model.includes('fable-5-1')) return MODEL_PRICING['fable-5-1']
  if (model.includes('fable-5')) return MODEL_PRICING['fable-5']
  if (model.includes('sonnet-5-5')) return MODEL_PRICING['sonnet-5-5']
  if (model.includes('sonnet-5')) return MODEL_PRICING['sonnet-5']
  if (model.includes('opus-4-7')) return MODEL_PRICING['opus-4-7']
  if (model.includes('opus-4-6')) return MODEL_PRICING['opus-4-6']
  if (model.includes('opus-4-5')) return MODEL_PRICING['opus-4-5']
  if (model.includes('opus-4-1')) return MODEL_PRICING['opus-4-1']
  if (model.includes('opus-4-0') || model.match(/opus-4(?!-)\b/) || model.match(/opus-4-2\d{7}/)) return MODEL_PRICING['opus-4']
  if (model.includes('opus-3') || model.includes('3-opus')) return MODEL_PRICING['opus-3']
  if (model.includes('sonnet-4-6')) return MODEL_PRICING['sonnet-4-6']
  if (model.includes('sonnet-4-5')) return MODEL_PRICING['sonnet-4-5']
  if (model.includes('sonnet-4-0') || model.match(/sonnet-4(?!-)\b/) || model.match(/sonnet-4-2\d{7}/)) return MODEL_PRICING['sonnet-4']
  if (model.includes('sonnet-3-7') || model.includes('3-7-sonnet')) return MODEL_PRICING['sonnet-3-7']
  if (model.includes('sonnet-3-5') || model.includes('3-5-sonnet')) return MODEL_PRICING['sonnet-3-5']
  if (model.includes('haiku-4') || model.includes('4-5-haiku')) return MODEL_PRICING['haiku-4-5']
  if (model.includes('haiku-3-5') || model.includes('3-5-haiku')) return MODEL_PRICING['haiku-3-5']
  if (model.includes('haiku-3') || model.includes('3-haiku')) return MODEL_PRICING['haiku-3']
  return null
}
