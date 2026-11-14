import { useEffect, useRef, useState } from 'react'

import './reactions.css'

// Reactions on posts and comments (MeetingAt10/accs-backend#86): one per person; choosing the same one again removes it.

export const reactions = [
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'laugh', emoji: '😆', label: 'Haha' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'support', emoji: '🙏', label: 'Support' },
] as const
export type ReactionId = typeof reactions[number]['id']

type Item = Record<string, unknown>

/** Counts per reaction from the API, reading an older post (one reaction, "agree") as likes. */
export function readReactions(item: Item): { counts: Record<string, number>; mine: ReactionId | null; total: number } {
  const raw = item.reactionCounts && typeof item.reactionCounts === 'object' ? (item.reactionCounts as Record<string, unknown>) : undefined
  const counts: Record<string, number> = Object.fromEntries(reactions.map((r) => [r.id, Number(raw?.[r.id] ?? 0) || 0]))
  if (!raw && Number(item.reactionCount)) counts.like = Number(item.reactionCount)
  const mine = reactions.find((r) => r.id === item.myReaction)?.id ?? (!raw && item.reacted === true ? 'like' : null)
  return { counts, mine, total: Object.values(counts).reduce((sum, n) => sum + n, 0) }
}

/** The most used reactions first, for the small summary next to the button. */
export const topReactions = (counts: Record<string, number>, limit = 3) =>
  reactions.filter((r) => counts[r.id] > 0).sort((a, b) => counts[b.id] - counts[a.id]).slice(0, limit)

/**
 * A reaction button: a press gives a like (or removes your reaction); the arrow opens the choice of six. The counts
 * show next to it.
 */
export function ReactionBar({ item, onReact, disabled = false, pending = false, size = 'md' }: {
  item: Item; onReact: (reaction: ReactionId) => void; disabled?: boolean; pending?: boolean; size?: 'md' | 'sm'
}) {
  const { counts, mine, total } = readReactions(item)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])
  const current = reactions.find((r) => r.id === mine)
  const choose = (id: ReactionId) => { setOpen(false); onReact(id) }
  return (
    <div className="rx" data-size={size} ref={box}>
      <div className="rx-button" data-active={current ? 'true' : undefined}>
        <button
          type="button"
          className="rx-main"
          disabled={disabled || pending}
          aria-pressed={Boolean(current)}
          onClick={() => choose(current ? current.id : 'like')}
        >
          <span aria-hidden className="rx-emoji">{current ? current.emoji : '👍'}</span>
          <span>{current ? current.label : 'React'}</span>
        </button>
        <button
          type="button"
          className="rx-more"
          disabled={disabled || pending}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Choose a reaction"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden>▾</span>
        </button>
      </div>
      {open && (
        <div className="rx-picker" role="group" aria-label="Reactions">
          {reactions.map((r) => (
            <button key={r.id} type="button" className="rx-choice" aria-pressed={mine === r.id} title={r.label} aria-label={r.label} onClick={() => choose(r.id)}>
              <span aria-hidden>{r.emoji}</span>
            </button>
          ))}
        </div>
      )}
      {total > 0 && (
        <span className="rx-summary" title={reactions.filter((r) => counts[r.id]).map((r) => `${r.label} ${counts[r.id]}`).join(', ')}>
          <span aria-hidden className="rx-summary__emoji">{topReactions(counts).map((r) => r.emoji).join('')}</span>
          <span className="accs-num">{total}</span>
          <span className="fx-sr"> reactions</span>
        </span>
      )}
    </div>
  )
}
