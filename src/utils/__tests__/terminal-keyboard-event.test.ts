import { describe, expect, it } from 'vitest'
import { dispatchSyntheticEnterKeydown } from '../terminal-keyboard-event'

describe('terminal keyboard event dispatch', () => {
  it('dispatches Enter as a cancelable DOM keydown event', () => {
    const target = document.createElement('textarea')
    const events: KeyboardEvent[] = []

    target.addEventListener('keydown', (event) => {
      events.push(event)
      event.preventDefault()
    })

    const result = dispatchSyntheticEnterKeydown(target)

    expect(events).toHaveLength(1)
    const seen = events[0]
    expect(seen.type).toBe('keydown')
    expect(seen.key).toBe('Enter')
    expect(seen.code).toBe('Enter')
    expect(seen.keyCode).toBe(13)
    expect(seen.which).toBe(13)
    expect(result.defaultPrevented).toBe(true)
    expect(result.dispatchReturned).toBe(false)
  })
})
