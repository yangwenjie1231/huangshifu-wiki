import { describe, expect, it, vi } from 'vitest'
import { submitFormOnModifierEnter } from '../../src/lib/formShortcuts'

describe('submitFormOnModifierEnter', () => {
  it('submits the form on Ctrl + Enter', () => {
    const requestSubmit = vi.fn()
    const preventDefault = vi.fn()

    submitFormOnModifierEnter({
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      preventDefault,
      nativeEvent: {
        isComposing: false,
      },
      currentTarget: {
        form: {
          requestSubmit,
        },
      },
    } as never)

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(requestSubmit).toHaveBeenCalledOnce()
  })

  it('submits the form on Cmd + Enter', () => {
    const requestSubmit = vi.fn()

    submitFormOnModifierEnter({
      key: 'Enter',
      ctrlKey: false,
      metaKey: true,
      preventDefault: vi.fn(),
      nativeEvent: {
        isComposing: false,
      },
      currentTarget: {
        form: {
          requestSubmit,
        },
      },
    } as never)

    expect(requestSubmit).toHaveBeenCalledOnce()
  })

  it('ignores plain Enter', () => {
    const requestSubmit = vi.fn()
    const preventDefault = vi.fn()

    submitFormOnModifierEnter({
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      preventDefault,
      nativeEvent: {
        isComposing: false,
      },
      currentTarget: {
        form: {
          requestSubmit,
        },
      },
    } as never)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(requestSubmit).not.toHaveBeenCalled()
  })

  it('ignores modifier Enter while IME composition is active', () => {
    const requestSubmit = vi.fn()
    const preventDefault = vi.fn()

    submitFormOnModifierEnter({
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      preventDefault,
      nativeEvent: {
        isComposing: true,
      },
      currentTarget: {
        form: {
          requestSubmit,
        },
      },
    } as never)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(requestSubmit).not.toHaveBeenCalled()
  })
})
