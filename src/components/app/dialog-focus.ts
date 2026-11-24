import { useEffect } from 'react'

/**
 * Moves focus to the first control in the newest open dialog or drawer once it has mounted. The design-system Modal and Drawer leave focus on
 * the page, so Escape did nothing until a field was clicked. Call it with the open state next to any Modal or Drawer.
 */
export function useFocusDialogOnOpen(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return
    // The dialog mounts a moment after the open state flips, so try again for up to about a second.
    let tries = 0
    const timer = window.setInterval(() => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')
      const dialog = dialogs[dialogs.length - 1]
      if (dialog?.contains(document.activeElement)) tries = 20
      else if (dialog) {
        // The dialog element itself is display: contents and cannot take focus, so focus its first control (the close button at least).
        dialog.querySelector<HTMLElement>('input, textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true })
        tries = 20
      }
      if (++tries >= 20) window.clearInterval(timer)
    }, 50)
    return () => window.clearInterval(timer)
  }, [isOpen])
}

const dialogSelector = '[role="dialog"], [role="alertdialog"]'
const focusable = 'input:not([type="hidden"]), textarea, select, button, a[href], [tabindex]:not([tabindex="-1"])'

/**
 * App-wide version of the fix above, mounted once in the app shell: whenever a dialog or drawer appears and focus is still outside it, focus
 * its first control so Escape and Tab work straight away. Dialogs that already place focus themselves are left alone.
 */
export function useFocusNewDialogs() {
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      const dialogs = document.querySelectorAll<HTMLElement>(dialogSelector)
      const dialog = dialogs[dialogs.length - 1]
      if (!dialog || dialog.contains(document.activeElement)) return
      dialog.querySelector<HTMLElement>(focusable)?.focus({ preventScroll: true })
    }
    const observer = new MutationObserver((records) => {
      const added = records.some((record) =>
        [...record.addedNodes].some((node) => node instanceof HTMLElement && (node.matches(dialogSelector) || node.querySelector(dialogSelector))),
      )
      if (added && !frame) frame = window.requestAnimationFrame(check)
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])
}
