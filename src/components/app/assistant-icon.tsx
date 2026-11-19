import { Icon, Tooltip } from '@meetingat10/design-system/react'
import { SparkleIcon } from '@meetingat10/design-system/icons'
import { Button as AriaButton, TooltipTrigger } from 'react-aria-components'

// The assistant's icon is a sparkle, the usual sign for an AI helper (QA 19 November). A question mark read as Help, and a
// chat bubble read as Messages (QA 17 November).
export const assistantIcon = SparkleIcon

/** "assistant" in a navigation entry stands for the sparkle, which is not in the design system's named icons. */
export const assistantIconName = 'assistant'

/** The top bar's Assistant button: the design system's IconButton, with the sparkle. */
export function AssistantIconButton({ onPress }: { onPress: () => void }) {
  return (
    <TooltipTrigger delay={500} closeDelay={100}>
      <AriaButton aria-label="Assistant" className="ds-icon-btn" onPress={onPress}>
        <Icon icon={assistantIcon} size={20} />
      </AriaButton>
      <Tooltip>Assistant</Tooltip>
    </TooltipTrigger>
  )
}
