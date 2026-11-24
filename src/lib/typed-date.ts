/**
 * The date picker clamps an impossible day (02/31 becomes 02-28) when it commits, so read the typed segments on each key instead.
 * Looks inside the picker the key was pressed in, or its form when the picker wrapper is not found. Returns null when the key was not pressed
 * in a date segment (for example Tab landing on the calendar button after the picker has already changed the day), so callers keep the last
 * answer instead of clearing it.
 */
export function typedDateImpossible(event: { target: EventTarget }): boolean | null {
  const target = event.target as Element
  if (!target.closest('[data-type="day"], [data-type="month"], [data-type="year"]')) return null
  const scope = target.closest('.ds-date-picker') ?? target.closest('form')
  const part = (type: string) => Number((scope?.querySelector(`[data-type="${type}"]`)?.textContent ?? '').replace(/\D/g, ''))
  const [year, month, day] = [part('year'), part('month'), part('day')]
  if (!year || !month || !day) return false
  return month > 12 || new Date(year, month - 1, day).getDate() !== day
}
