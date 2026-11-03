// @vitest-environment node
/**
 * T0802 / D247 — linux-acceptance V1 judgement (e2e/linux/linux-os.ts judgeVoiceAvailability): BAT's own
 * whisper availability check must say `available` where glibc >= 2.38 (Ubuntu 24.04) and
 * `unavailable(glibc-too-old)` on older glibc (22.04, BUG-203); the mic button must agree.
 */
import { describe, expect, it } from 'vitest'
import { judgeVoiceAvailability, voiceAvailabilityLabel } from '../../e2e/linux/linux-os'

const G2204 = 'ldd (Ubuntu GLIBC 2.35-0ubuntu3.8) 2.35'
const G2404 = 'ldd (Ubuntu GLIBC 2.39-0ubuntu8.4) 2.39'
const AVAILABLE = { state: 'available', source: 'probe' }
const GLIBC = { state: 'unavailable', code: 'glibc-too-old', requiredGlibc: '2.38' }

describe('voiceAvailabilityLabel', () => {
  it('labels each state', () => {
    expect(voiceAvailabilityLabel(AVAILABLE)).toBe('available')
    expect(voiceAvailabilityLabel(GLIBC)).toBe('unavailable(glibc-too-old)')
    expect(voiceAvailabilityLabel({ state: 'unknown', reason: 'timeout' })).toBe('unknown(timeout)')
    expect(voiceAvailabilityLabel(null)).toBe('none')
  })
})

describe('judgeVoiceAvailability', () => {
  it('24.04: available = PASS; anything else = WARN', () => {
    expect(judgeVoiceAvailability(AVAILABLE, G2404).result).toBe('PASS')
    expect(judgeVoiceAvailability(GLIBC, G2404)).toMatchObject({ result: 'WARN', expected: 'available' })
    expect(judgeVoiceAvailability({ state: 'unknown', reason: 'pending' }, G2404).result).toBe('WARN')
    expect(judgeVoiceAvailability(null, G2404).result).toBe('WARN')
  })

  it('22.04: unavailable(glibc-too-old) = PASS; available / missing-library / unknown = WARN', () => {
    expect(judgeVoiceAvailability(GLIBC, G2204)).toMatchObject({ result: 'PASS', expected: 'unavailable(glibc-too-old)' })
    expect(judgeVoiceAvailability(AVAILABLE, G2204).result).toBe('WARN')
    expect(judgeVoiceAvailability({ state: 'unavailable', code: 'missing-library' }, G2204).result).toBe('WARN')
    expect(judgeVoiceAvailability({ state: 'unknown', reason: 'timeout' }, G2204).result).toBe('WARN')
  })

  it('unknown glibc is judged like a new one', () => {
    expect(judgeVoiceAvailability(AVAILABLE, 'n/a').result).toBe('PASS')
  })

  it('the mic button must agree when it is on screen', () => {
    expect(judgeVoiceAvailability(GLIBC, G2204, { found: true, disabled: true, unavailableAttr: 'glibc-too-old' }).result).toBe('PASS')
    expect(judgeVoiceAvailability(GLIBC, G2204, { found: true, disabled: false, unavailableAttr: null }).result).toBe('WARN')
    expect(judgeVoiceAvailability(AVAILABLE, G2404, { found: true, disabled: false, unavailableAttr: null }).result).toBe('PASS')
    expect(judgeVoiceAvailability(AVAILABLE, G2404, { found: true, disabled: true, unavailableAttr: null }).result).toBe('WARN')
    expect(judgeVoiceAvailability(AVAILABLE, G2404, { found: false, disabled: false, unavailableAttr: null }).result).toBe('PASS')
  })
})
