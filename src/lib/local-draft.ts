import { useCallback, useEffect, useRef, useState } from 'react'

/** Stored value for `key` merged over `initial`, or `initial` when nothing usable is stored. */
export function readDraft<T extends object>(key: string, initial: T): T {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...initial, ...stored } : initial
  } catch { return initial }
}

export function writeDraft(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* The form state still retains the draft. */ }
}

export function removeDraft(key: string) {
  try { localStorage.removeItem(key) } catch { /* No stored draft to remove. */ }
}

/** Form state that survives a reload: saved after a short pause, removed by `clear` on submit or discard. Text only, never files. */
export function useLocalDraft<T extends object>(key: string, initial: T) {
  const [state, setState] = useState(() => ({ key, value: readDraft(key, initial) }))
  // Key changed without remount: load the new key's draft instead of carrying the old text over.
  let { value } = state
  if (state.key !== key) {
    value = readDraft(key, initial)
    setState({ key, value })
  }
  const cleared = useRef(false)
  const pending = useRef<{ key: string, value: T } | null>(null)
  useEffect(() => {
    if (cleared.current) return
    const entry = { key, value }
    pending.current = entry
    const timer = setTimeout(() => {
      if (cleared.current || pending.current !== entry) return
      pending.current = null
      writeDraft(key, value)
    }, 300)
    return () => clearTimeout(timer)
  }, [key, value])
  // Key change or unmount: flush the old key's unsaved text before the timer is lost.
  useEffect(() => () => {
    const p = pending.current
    if (p?.key === key) { writeDraft(key, p.value); pending.current = null }
  }, [key])
  const clear = useCallback(() => { cleared.current = true; pending.current = null; removeDraft(key) }, [key])
  const set = useCallback((next: T | ((current: T) => T)) => { cleared.current = false; setState(s => ({ key: s.key, value: typeof next === 'function' ? next(s.value) : next })) }, [])
  return [value, set, clear] as const
}
