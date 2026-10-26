import { Badge, Button, Row, Stack } from "@meetingat10/design-system/react";
import type { ReactNode } from "react";

import "./notifications.css";

type Item = Record<string, unknown>;

function words(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function when(value: unknown): string {
  const raw = words(value);
  const parsed = new Date(raw);
  return raw && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "An update is available";
}

export function NotificationList({ children }: { children: ReactNode }) {
  return (
    <ul className="ds-next-notification-list" aria-label="Notifications">
      {children}
    </ul>
  );
}

export function NotificationItem({
  notification,
  onOpen,
  onRead,
  isPending = false,
}: {
  notification: Item;
  onOpen: () => void;
  onRead: () => void;
  isPending?: boolean;
}) {
  return (
    <li className="ds-next-notification-item">
      <Row justify="between" gap={16}>
        <Stack gap={8}>
          <Row gap={8}>
            {notification.priority === "high" && (
              <Badge tone="info" form="pending">
                Priority
              </Badge>
            )}
            {notification.read !== true && (
              <Badge outline marker={false}>
                Unread
              </Badge>
            )}
            <Badge outline marker={false}>
              {words(notification.kind, "Update")}
            </Badge>
          </Row>
          <Button variant="tertiary" onPress={onOpen} isDisabled={isPending}>
            {words(notification.title, "An update is available")}
          </Button>
          <p>{words(notification.body)}</p>
          <small>
            <time dateTime={words(notification.at)}>
              {when(notification.at)}
            </time>
          </small>
        </Stack>
        <Button variant="tertiary" onPress={onRead} isDisabled={isPending}>
          {notification.read === true ? "Mark unread" : "Mark read"}
        </Button>
      </Row>
    </li>
  );
}
