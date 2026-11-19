// Ctrl+K / Cmd+K quick jump (testing sheet, App Shell #17): the pages and actions the signed-in role may open.

export type JumpItem = { id: string; label: string; href: string; kind: 'Page' | 'Action' }

/** Actions offered beside the pages, each only when the role may open the page it leads to. */
const actions: Array<{ label: string; href: string; pageId: string }> = [
  { label: 'New post', href: '/feed/new', pageId: 'P05' },
  { label: 'New report', href: '/reports/new', pageId: 'P19' },
  { label: 'Book a consultation', href: '/consultations', pageId: 'P15' },
]

export function jumpItems(pages: Array<{ label: string; href: string }>, allowedPages: readonly string[]): JumpItem[] {
  const allowed = new Set(allowedPages)
  const seen = new Set<string>()
  const items: JumpItem[] = []
  for (const action of actions) if (allowed.has(action.pageId)) items.push({ id: `action:${action.href}`, label: action.label, href: action.href, kind: 'Action' })
  for (const page of pages) {
    if (seen.has(page.href)) continue
    seen.add(page.href)
    items.push({ id: `page:${page.href}`, label: page.label, href: page.href, kind: 'Page' })
  }
  return items
}

/** Every typed word must start a word of the label ("new rep" finds "New report"); an empty search lists everything. */
export function matchesJump(item: JumpItem, query: string) {
  const words = item.label.toLowerCase().split(/\s+/)
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((typed) => words.some((word) => word.startsWith(typed)))
}

/** Ctrl+K on Windows and Linux, Cmd+K on a Mac. */
export const isQuickJumpKey = (event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }) =>
  event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
