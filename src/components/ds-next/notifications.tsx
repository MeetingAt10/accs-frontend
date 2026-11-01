import { Icon, type IconName } from "@meetingat10/design-system/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { formatDateTime, relativeTime } from "@/lib/format";

import "./notifications.css";

type Item = Record<string, unknown>;

const ease = [0.16, 1, 0.3, 1] as const;

function words(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

const kindIcons: Record<string, IconName> = {
  announcement: "megaphone",
  report: "flag",
  case: "flag",
  consultation: "calendar-check",
  message: "chat",
  evaluation: "graduation-cap",
  moderation: "warning-circle",
};

export function NotificationList({ children }: { children: ReactNode }) {
  return (
    <ul className="ds-next-notification-list" aria-label="Notifications">
      <AnimatePresence>{children}</AnimatePresence>
    </ul>
  );
}

/** Day heading inside a NotificationList ("Today", "Earlier"). */
export function NotificationGroup({ label }: { label: string }) {
  return (
    <motion.li
      className="ds-next-notification-group"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {label}
    </motion.li>
  );
}

export function NotificationItem({
  notification,
  onOpen,
  onRead,
  isPending = false,
  index = 0,
}: {
  notification: Item;
  onOpen: () => void;
  onRead: () => void;
  isPending?: boolean;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const unread = notification.read !== true;
  const kind = words(notification.kind, "update");
  const at = words(notification.at);
  return (
    <motion.li
      layout={reduce ? false : "position"}
      className="ds-next-notification-item"
      data-unread={unread || undefined}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
      transition={{
        duration: reduce ? 0 : 0.32,
        ease,
        delay: reduce ? 0 : Math.min(index, 8) * 0.03,
      }}
    >
      <span className="ds-next-notification-item__icon" aria-hidden>
        <Icon name={kindIcons[kind] ?? "bell"} size={20} />
        {unread && <span className="ds-next-notification-item__dot" />}
      </span>
      <div className="ds-next-notification-item__body">
        <div className="ds-next-notification-item__top">
          <button
            type="button"
            className="ds-next-notification-item__title"
            onClick={onOpen}
            disabled={isPending}
          >
            {words(notification.title, "An update is available")}
          </button>
          {notification.priority === "high" && (
            <span className="accs-status" data-tone="warn">
              Priority
            </span>
          )}
          {unread && <span className="ds-next-notification-item__sr">Unread</span>}
        </div>
        {words(notification.body) && (
          <p className="ds-next-notification-item__text">
            {words(notification.body)}
          </p>
        )}
        <span className="ds-next-notification-item__meta">
          <span className="accs-tag">{kind}</span>
          <time dateTime={at} title={formatDateTime(at, "")}>
            {relativeTime(at)}
          </time>
        </span>
      </div>
      <button
        type="button"
        className="ds-next-notification-item__read"
        onClick={onRead}
        disabled={isPending}
      >
        {unread ? "Mark read" : "Mark unread"}
      </button>
    </motion.li>
  );
}
