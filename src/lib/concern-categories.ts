// Concern categories and sub-categories come from the API (`categoryOptions` on P19 and P21), never from a list in the app.
// "Other (please specify)" has no sub-categories; the student describes the concern in a few words instead.

export type CategoryOption = { label: string; description: string; subcategories: string[]; requiresDetail: boolean }
export type CategoryChoice = { category: string; subcategory: string; categoryDetail: string }

export const categoryDetailMax = 120

const text = (value: unknown) => (typeof value === 'string' ? value : '')

/** The options the page sent, skipping anything malformed. */
export function readCategoryOptions(value: unknown): CategoryOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const item = entry as Record<string, unknown>
    const label = text(item.label)
    if (!label) return []
    const subcategories = Array.isArray(item.subcategories) ? item.subcategories.filter((sub): sub is string => typeof sub === 'string' && sub !== '') : []
    return [{ label, description: text(item.description), subcategories, requiresDetail: item.requiresDetail === true }]
  })
}

/**
 * A saved choice made valid against the current options: an unknown category (an old draft's "General concern") or a
 * sub-category that is not in the chosen category is cleared, so the student picks again.
 */
export function cleanChoice(choice: CategoryChoice, options: CategoryOption[]): CategoryChoice {
  const option = options.find((entry) => entry.label === choice.category)
  if (!option) return { category: '', subcategory: '', categoryDetail: '' }
  if (option.requiresDetail) return { category: option.label, subcategory: '', categoryDetail: choice.categoryDetail.slice(0, categoryDetailMax) }
  return { category: option.label, subcategory: option.subcategories.includes(choice.subcategory) ? choice.subcategory : '', categoryDetail: '' }
}

/** What is still missing, by field, or an empty object when the choice can be sent. */
export function choiceProblems(choice: CategoryChoice, options: CategoryOption[]): Partial<Record<keyof CategoryChoice, string>> {
  const option = options.find((entry) => entry.label === choice.category)
  if (!option) return { category: 'Choose a category.' }
  if (option.requiresDetail) return choice.categoryDetail.trim() ? {} : { categoryDetail: 'Describe the concern in a few words.' }
  return option.subcategories.includes(choice.subcategory) ? {} : { subcategory: 'Choose a sub-category.' }
}

/** The fields the API takes: a sub-category, or for "Other" a short description. */
export function choicePayload(choice: CategoryChoice, options: CategoryOption[]) {
  const option = options.find((entry) => entry.label === choice.category)
  if (option?.requiresDetail) return { category: choice.category, categoryDetail: choice.categoryDetail.trim() }
  return { category: choice.category, ...(choice.subcategory ? { subcategory: choice.subcategory } : {}) }
}

/** "Category · Sub-category", or "Category · description" for Other; old concerns show their category alone. */
export function categoryText(report: Record<string, unknown>, fallback = 'General concern') {
  const category = text(report.category) || fallback
  const second = text(report.subcategory) || text(report.categoryDetail)
  return second ? category + ' · ' + second : category
}
