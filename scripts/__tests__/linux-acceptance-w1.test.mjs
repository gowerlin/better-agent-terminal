// T0800 / BUG-204 — linux-acceptance W1 judgement (e2e/linux/linux-os.ts judgeWhisperLoad): the packaged
// whisper addon must load where the system glibc is >= 2.38 (Ubuntu 24.04); on older glibc (22.04, BUG-203)
// a failure is only recorded. The spec itself runs only on the Linux runners (linux-acceptance.yml).

import { describe, expect, it } from 'vitest'

import { glibcVersionOf, judgeWhisperLoad, WHISPER_MIN_GLIBC } from '../../e2e/linux/linux-os.ts'

const UBUNTU_2404 = 'ldd (Ubuntu GLIBC 2.39-0ubuntu8.6) 2.39'
const UBUNTU_2204 = 'ldd (Ubuntu GLIBC 2.35-0ubuntu3.11) 2.35'

describe('glibcVersionOf', () => {
  it('takes the last x.y of the ldd --version line', () => {
    expect(glibcVersionOf(UBUNTU_2404)).toBe('2.39')
    expect(glibcVersionOf(UBUNTU_2204)).toBe('2.35')
    expect(glibcVersionOf('ldd (GNU libc) 2.38')).toBe('2.38')
    expect(glibcVersionOf('exit=none 3ms error="ENOENT"')).toBeNull()
  })
})

describe('judgeWhisperLoad', () => {
  it('loaded → PASS everywhere', () => {
    expect(judgeWhisperLoad(true, UBUNTU_2404)).toMatchObject({ result: 'PASS', judged: true })
    expect(judgeWhisperLoad(true, UBUNTU_2204)).toMatchObject({ result: 'PASS', judged: false })
  })

  it('not loaded on glibc >= 2.38 (24.04) → WARN', () => {
    expect(WHISPER_MIN_GLIBC).toBe('2.38')
    expect(judgeWhisperLoad(false, UBUNTU_2404)).toMatchObject({ result: 'WARN', judged: true })
    expect(judgeWhisperLoad(false, 'ldd (GNU libc) 2.38')).toMatchObject({ result: 'WARN', judged: true })
    expect(judgeWhisperLoad(false, 'ldd (GNU libc) 2.40')).toMatchObject({ result: 'WARN', judged: true })
  })

  it('not loaded on older glibc (22.04, BUG-203) → INFO, recorded only', () => {
    const j = judgeWhisperLoad(false, UBUNTU_2204)
    expect(j).toMatchObject({ result: 'INFO', judged: false })
    expect(j.note).toContain('BUG-203')
    expect(judgeWhisperLoad(false, 'ldd (GNU libc) 2.9')).toMatchObject({ result: 'INFO' })
  })

  it('glibc version unreadable → judged (WARN on failure), never skipped silently', () => {
    expect(judgeWhisperLoad(false, '')).toMatchObject({ result: 'WARN', judged: true })
  })
})
