import { AssistantMascot } from '@/components/app/assistant-mascot'

// The assistant's face is the ACCS lion mascot. It replaced the sparkle (QA 19 November), which had replaced a question mark
// that read as Help and a chat bubble that read as Messages (QA 17 November).
/** The mascot at icon size, for navigation entries and lists. */
export function AssistantIcon({ size = 20 }: { size?: number }) {
  return <AssistantMascot still="neutral" size={size} />
}

/** "assistant" in a navigation entry stands for the mascot, which is not in the design system's named icons. */
export const assistantIconName = 'assistant'

/** The Assistant card at the foot of the navigation panel (and the phone menu). It opens the Assistant drawer. */
export function AssistantCard({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" className="shell-assist" aria-haspopup="dialog" onClick={onPress}>
      <span className="shell-assist__head">
        <AssistantMascot size={28} className="shell-assist__mascot" />
        ACCS Assistant
      </span>
      <span className="shell-assist__text">Ask where things are or how a request moves.</span>
    </button>
  )
}
