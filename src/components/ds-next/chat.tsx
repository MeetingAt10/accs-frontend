import {
  Avatar,
  Badge,
  EmptyState,
  IconButton,
  Kbd,
  Link,
  RoleBadge,
  Row,
  Stack,
  TextArea,
} from "@meetingat10/design-system/react";
import type { ReactNode } from "react";

import "./chat.css";

type Item = Record<string, unknown>;

function object(value: unknown): Item {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Item)
    : {};
}

function items(value: unknown): Item[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function words(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function roleNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((role): role is string => typeof role === "string")
    : [];
}

function when(value: unknown): string {
  const raw = words(value);
  const parsed = new Date(raw);
  return raw && !Number.isNaN(parsed.getTime())
    ? parsed.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "No messages yet";
}

export function ConversationList({
  conversations,
  currentId,
}: {
  conversations: Item[];
  currentId?: string;
}) {
  if (!conversations.length) {
    return (
      <EmptyState
        title="No messages yet"
        description="Start a conversation with someone in your permitted scope."
      />
    );
  }

  return (
    <ul className="ds-next-conversation-list" aria-label="Conversations">
      {conversations.map((conversation) => (
        <ConversationRow
          conversation={conversation}
          currentId={currentId}
          key={words(conversation.id)}
        />
      ))}
    </ul>
  );
}

function ConversationRow({
  conversation,
  currentId,
}: {
  conversation: Item;
  currentId?: string;
}) {
  const memberRoles = [
    ...new Set(
      items(conversation.members).flatMap((member) => roleNames(member.roles)),
    ),
  ];

  return (
    <li className="ds-next-conversation-list__item">
      <Row gap={12}>
        <Avatar name={words(conversation.title)} size={36} />
        <Stack gap={4} className="ds-next-conversation-list__content">
          <Link
            href={"/messages/" + encodeURIComponent(words(conversation.id))}
            aria-current={currentId === conversation.id ? "page" : undefined}
          >
            {words(conversation.title, "Conversation")}
          </Link>
          <Row gap={8}>
            <Badge outline marker={false}>
              {conversation.kind === "group" ? "Class group" : "Direct"}
            </Badge>
            {memberRoles.length > 0 && (
              <RoleBadge>{memberRoles.join(" · ")}</RoleBadge>
            )}
            {Number(conversation.unread) > 0 && (
              <Badge tone="info">{Number(conversation.unread)} unread</Badge>
            )}
          </Row>
          <p className="ds-next-conversation-list__preview">
            {words(conversation.lastMessage, "No messages yet")}
          </p>
          <small>{when(conversation.updatedAt)}</small>
        </Stack>
      </Row>
    </li>
  );
}

export function MessageList({
  children,
  label = "Messages",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div
      className="ds-next-message-list"
      role="log"
      aria-label={label}
      aria-live="polite"
      aria-relevant="additions text"
    >
      {children}
    </div>
  );
}

export function MessageBubble({
  sender,
  role,
  body,
  at,
  own = false,
  actions,
  children,
}: {
  sender: string;
  role?: string;
  body: string;
  at?: string;
  own?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article
      className={[
        "ds-next-message-bubble",
        own && "ds-next-message-bubble--own",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Row justify="between" gap={8}>
        <Row gap={8}>
          <strong>{sender}</strong>
          {role && <RoleBadge>{role}</RoleBadge>}
        </Row>
        {actions}
      </Row>
      <p>{body}</p>
      {children}
      {at && (
        <small>
          <time dateTime={at}>{when(at)}</time>
        </small>
      )}
    </article>
  );
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  isPending = false,
  label = "Message",
  attachments = false,
  maxLength = 4000,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isPending?: boolean;
  label?: string;
  attachments?: boolean;
  maxLength?: number;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <Stack gap={12}>
        <TextArea
          label={label}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          showCount
          isRequired
          isDisabled={isPending}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <Row justify="between">
          <small>
            <Kbd keys="Enter" /> sends · <Kbd keys={["Shift", "Enter"]} /> adds
            a line
          </small>
          <Row gap={8}>
            {/* TBD(D-08): attachments require approved access and retention rules. */}
            {attachments && (
              <IconButton
                icon="paperclip"
                label="Attachments are not enabled while access rules are being defined"
                isDisabled
              />
            )}
            <IconButton
              type="submit"
              variant="solid"
              icon="arrow-right"
              label={isPending ? "Sending message" : "Send"}
              isDisabled={!value.trim() || isPending}
            />
          </Row>
        </Row>
      </Stack>
    </form>
  );
}
