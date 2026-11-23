/** Restricted features in words people use, not their codes ("post.create"). */
export const featureLabels: Record<string, string> = {
  'post.create': 'Posting',
  'post.comment': 'Commenting',
  'report.anonymous': 'Anonymous reporting',
}

/** "Posting, Commenting" for a restriction's feature codes; an unknown code is shown as it is. */
export const featureWords = (codes: unknown) =>
  (Array.isArray(codes) ? codes : []).map((code) => featureLabels[String(code)] ?? String(code)).join(', ')

export type RestrictionFilters = { q: string; feature: string; program: string }

/**
 * The Restrictions page filters (testing sheet: no search, feature or program filter). The search matches the student's
 * name or ID; "" for a feature or program means all.
 */
/** When a row began: a restriction's start date, or when a change request was made. */
const startedAt = (row: { starts?: unknown; at?: unknown; createdAt?: unknown }) => String(row.starts ?? row.at ?? row.createdAt ?? '')

/** Newest first (QA 17 November, V3: the tables put the oldest restriction on top). */
export function newestFirst<T extends { starts?: unknown; at?: unknown; createdAt?: unknown }>(rows: T[]) {
  return [...rows].sort((a, b) => startedAt(b).localeCompare(startedAt(a)))
}

export function filterRestrictions<T extends { features?: unknown; student?: unknown; starts?: unknown; at?: unknown; createdAt?: unknown }>(rows: T[], { q, feature, program }: RestrictionFilters) {
  const needle = q.trim().toLowerCase()
  return newestFirst(rows).filter((row) => {
    const student = (row.student && typeof row.student === 'object' ? row.student : {}) as { id?: unknown; studentId?: unknown; name?: unknown; program?: unknown }
    const features = Array.isArray(row.features) ? row.features.map(String) : []
    return (!needle || `${String(student.name ?? '')} ${String(student.id ?? '')} ${String(student.studentId ?? '')}`.toLowerCase().includes(needle))
      && (!feature || features.includes(feature))
      && (!program || student.program === program)
  })
}
