import { Search } from '@meetingat10/design-system/react'
import { useEffect, useRef, useState, type ComponentProps } from 'react'

/** How long typing must pause before a search box tells the page. */
export const typingPause = 350

type Props = Omit<ComponentProps<typeof Search>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  delay?: number
}

/**
 * A search box that passes on what was typed only after a short pause, so each key is not a new request and a new
 * entry in the address (QA 17 November: the feed sent one request per letter and failed after about ten). Clearing
 * the box applies at once.
 */
export function TypedSearch({ value, onChange, delay = typingPause, ...rest }: Props) {
  const [text, setText] = useState(value)
  // What this box last passed on. A new `value` that differs came from outside (Clear filters, Back) and replaces the text.
  const sent = useRef(value)
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    if (value === sent.current) return
    sent.current = value
    setText(value)
  }, [value])

  useEffect(() => {
    if (text === sent.current) return
    const send = () => {
      sent.current = text
      latest.current(text)
    }
    if (!text) return send()
    const timer = setTimeout(send, delay)
    return () => clearTimeout(timer)
  }, [text, delay])

  return <Search {...rest} value={text} onChange={setText} />
}
