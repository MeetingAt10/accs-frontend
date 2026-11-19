// "Help me write this" (QA 17 November: it only ever showed the writing guide). This tidies the student's own words and
// lays them out under the headings an office reads first. It runs in the browser: the draft is not sent anywhere, and
// nothing is invented. Facts that are missing are listed for the student to add, never filled in.

export type DraftFacts = { narrative: string; occurredOn?: string; location?: string; category?: string }
export type TidyResult = { text: string; missing: string[] }

/** One sentence: spaces collapsed, a capital first letter, " i " as "I", and a full stop if it has no ending. */
function sentence(raw: string) {
  const text = raw.replace(/\s+/g, ' ').trim().replace(/\bi\b/g, 'I')
  if (!text) return ''
  const capped = text[0]!.toUpperCase() + text.slice(1)
  return /[.!?]["')\]]?$/.test(capped) ? capped : capped + '.'
}

/** The student's words as tidy sentences: split at ends of sentences and at line breaks, each one cleaned. */
export function tidySentences(narrative: string) {
  return narrative
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence)
    .filter(Boolean)
    .join(' ')
}

/** "2026-11-14" as "14 November 2026". Anything else is left as typed. */
function longDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`
}

export function tidyDraft({ narrative, occurredOn = '', location = '', category = '' }: DraftFacts): TidyResult {
  const what = tidySentences(narrative)
  const lines = [`What happened: ${what}`]
  if (occurredOn.trim()) lines.push(`When: ${longDate(occurredOn.trim())}.`)
  if (location.trim()) lines.push(`Where: ${sentence(location)}`)
  const missing: string[] = []
  if (what.split(/\s+/).length < 12) missing.push('More about what happened, in your own words')
  if (!occurredOn.trim()) missing.push('When it happened (the date field)')
  if (!location.trim()) missing.push('Where it happened (the place field)')
  if (!category.trim()) missing.push('The category that fits best')
  if (!/\b(want|hope|ask|request|please|would like|need)\b/i.test(narrative)) missing.push('What you would like the office to look at')
  return { text: what ? lines.join('\n') : '', missing }
}
