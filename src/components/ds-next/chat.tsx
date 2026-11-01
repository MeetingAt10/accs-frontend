import {
  IconButton,
  Kbd,
  Link,
  TextArea,
} from "@meetingat10/design-system/react";
import { motion, useReducedMotion } from "motion/react";
import { Children, useEffect, useRef, type ReactNode } from "react";

import { formatDateTime, initials, relativeTime } from "@/lib/format";
import "./chat.css";

type Item = Record<string, unknown>;

const ease = [0.16, 1, 0.3, 1] as const;

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

/** "2:05 PM" in Manila time. */
function clock(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Manila",
      });
}

function Mark({ name }: { name: string }) {
  return (
    <span className="accs-avatar ds-next-chat-avatar" aria-hidden>
      {initials(name) || "?"}
    </span>
  );
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
      <div className="accs-empty">
        <strong>No conversations yet</strong>
        <span>Start a conversation with someone you are allowed to message.</span>
      </div>
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
  const unread = Number(conversation.unread) || 0;
  const title = words(conversation.title, "Conversation");
  const updated = words(conversation.updatedAt);

  return (
    <li className="ds-next-conversation-list__item">
      <Link
        variant="quiet"
        className="ds-next-conversation"
        href={"/messages/" + encodeURIComponent(words(conversation.id))}
        aria-current={currentId === conversation.id ? "page" : undefined}
      >
        <Mark name={title} />
        <span className="ds-next-conversation__text">
          <span className="ds-next-conversation__top">
            <span
              className={
                unread > 0
                  ? "ds-next-conversation__title ds-next-conversation__title--unread"
                  : "ds-next-conversation__title"
              }
            >
              {title}
            </span>
            {updated && (
              <time className="ds-next-conversation__time" dateTime={updated}>
                {relativeTime(updated)}
              </time>
            )}
          </span>
          <span className="ds-next-conversation__bottom">
            <span className="ds-next-conversation-list__preview">
              {words(conversation.lastMessage, "No messages yet")}
            </span>
            {unread > 0 && (
              <span className="ds-next-unread">
                <span className="ds-next-unread__dot" aria-hidden />
                <span className="ds-next-unread__count">{unread}</span>
                <span className="ds-next-sr"> unread</span>
              </span>
            )}
          </span>
          <span className="ds-next-conversation__tags">
            <span className="accs-tag">
              {conversation.kind === "group" ? "Class group" : "Direct"}
            </span>
            {memberRoles.length > 0 && (
              <span className="ds-next-conversation__roles">
                {memberRoles.join(" · ")}
              </span>
            )}
          </span>
        </span>
      </Link>
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
  const ref = useRef<HTMLDivElement>(null);
  const count = Children.count(children);

  // Keep the newest message in view.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div
      ref={ref}
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
  const reduce = useReducedMotion();
  return (
    <motion.article
      className={[
        "ds-next-message-bubble",
        own && "ds-next-message-bubble--own",
      ]
        .filter(Boolean)
        .join(" ")}
      initial={reduce ? false : { opacity: 0, y: 12, x: own ? 12 : -12 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.36, ease }}
    >
      {!own && <Mark name={sender} />}
      <div className="ds-next-message-bubble__col">
        {!own && (
          <header className="ds-next-message-bubble__who">
            <strong>{sender}</strong>
            {role && <span className="accs-tag">{role}</span>}
          </header>
        )}
        <div className="ds-next-message-bubble__line">
          <div className="ds-next-message-bubble__text">
            <p>{body}</p>
            {children}
          </div>
          {actions && (
            <div className="ds-next-message-bubble__actions">{actions}</div>
          )}
        </div>
        {at && (
          <small>
            <time dateTime={at} title={formatDateTime(at)}>
              {clock(at)}
            </time>
          </small>
        )}
      </div>
    </motion.article>
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
      className="ds-next-composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <TextArea
        label={label}
        placeholder="Write a message…"
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
      <div className="ds-next-composer__bar">
        <small className="ds-next-composer__hint">
          <Kbd keys="Enter" /> sends · <Kbd keys={["Shift", "Enter"]} /> adds a
          line
        </small>
        <div className="ds-next-composer__buttons">
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
        </div>
      </div>
    </form>
  );
}
