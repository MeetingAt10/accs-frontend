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
  const [value, setValue] = useState<T>(() => readDraft(key, initial))
  const cleared = useRef(false)
  useEffect(() => {
    if (cleared.current) return
    const timer = setTimeout(() => writeDraft(key, value), 300)
    return () => clearTimeout(timer)
  }, [key, value])
  const clear = useCallback(() => { cleared.current = true; removeDraft(key) }, [key])
  const set = useCallback((next: T | ((current: T) => T)) => { cleared.current = false; setValue(next) }, [])
  return [value, set, clear] as const
}
