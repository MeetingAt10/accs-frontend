/**
 * Whether a person in a picker matches what was typed: any of the given words (name, student number, email) contains
 * it, ignoring case. Pickers show only the name in their field once someone is picked, so internal IDs never appear
 * there (QA 17 November, V3: "Andrew 23-1791 USR-01M7..." after choosing a student).
 */
export function personMatches(query: string, ...fields: (string | undefined)[]) {
  const typed = query.trim().toLowerCase()
  return !typed || fields.some((field) => field?.toLowerCase().includes(typed))
}
