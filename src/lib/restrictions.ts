/** Restricted features in words people use, not their codes ("post.create"). */
export const featureLabels: Record<string, string> = {
  'post.create': 'Posting',
  'post.comment': 'Commenting',
  'report.anonymous': 'Anonymous reporting',
}

/** "Posting, Commenting" for a restriction's feature codes; an unknown code is shown as it is. */
export const featureWords = (codes: unknown) =>
  (Array.isArray(codes) ? codes : []).map((code) => featureLabels[String(code)] ?? String(code)).join(', ')
