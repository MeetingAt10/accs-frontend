import { Icon } from '@meetingat10/design-system/react'
import { SparkleIcon } from '@meetingat10/design-system/icons'

// The assistant's icon is a sparkle, the usual sign for an AI helper (QA 19 November). A question mark read as Help, and a
// chat bubble read as Messages (QA 17 November).
export const assistantIcon = SparkleIcon

/** "assistant" in a navigation entry stands for the sparkle, which is not in the design system's named icons. */
export const assistantIconName = 'assistant'

/** The Assistant card at the foot of the navigation panel (and the phone menu). It opens the Assistant drawer. */
export function AssistantCard({ onPress }: { onPress: () => void }) {
  return (
    <button type="button" className="shell-assist" aria-haspopup="dialog" onClick={onPress}>
      <span className="shell-assist__head">
        <Icon icon={assistantIcon} size={16} weight="fill" className="shell-assist__icon" />
        ACCS Assistant
      </span>
      <span className="shell-assist__text">Ask where things are or how a request moves.</span>
    </button>
  )
}
