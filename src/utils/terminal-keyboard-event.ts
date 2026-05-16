export interface TerminalKeyDispatchResult {
  dispatchReturned: boolean
  defaultPrevented: boolean
}

function defineKeyboardNumber(event: KeyboardEvent, key: 'keyCode' | 'which' | 'charCode', value: number): void {
  try {
    Object.defineProperty(event, key, {
      configurable: true,
      get: () => value,
    })
  } catch {
    // Chromium exposes these as read-only legacy fields; if overriding fails,
    // keep the native values and let the caller log the dispatch outcome.
  }
}

export function createSyntheticEnterKeydownEvent(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
    composed: true,
  })

  defineKeyboardNumber(event, 'keyCode', 13)
  defineKeyboardNumber(event, 'which', 13)
  defineKeyboardNumber(event, 'charCode', 0)

  return event
}

export function dispatchSyntheticEnterKeydown(target: HTMLElement): TerminalKeyDispatchResult {
  const event = createSyntheticEnterKeydownEvent()
  const dispatchReturned = target.dispatchEvent(event)
  return {
    dispatchReturned,
    defaultPrevented: event.defaultPrevented,
  }
}
