import type { KeyboardEvent } from 'react'

export const submitFormOnModifierEnter = (
  event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>
) => {
  if (event.nativeEvent?.isComposing) {
    return
  }

  if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) {
    return
  }

  event.preventDefault()
  event.currentTarget.form?.requestSubmit()
}
