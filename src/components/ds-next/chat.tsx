import { AvatarFill } from "@/components/app/photo";
import { roleLabelOf } from "@/lib/role-labels";
import {
  IconButton,
  Kbd,
  Link,
  TextArea,
} from "@meetingat10/design-system/react";
import { motion, useReducedMotion } from "motion/react";
import { Children, useEffect, useRef, type ReactNode, useState } from "react";

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
    ? value.filter((role): role is string => typeof role === "string").map(roleLabelOf)
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

function Mark({ name, photo }: { name: string; photo?: string }) {
  return (
    <span className="accs-avatar ds-next-chat-avatar" aria-hidden>
      <AvatarFill photo={photo} fallback={initials(name) || "?"} />
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
  photo,
}: {
  photo?: string;
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
      {!own && <Mark name={sender} photo={photo} />}
      <div className="ds-next-message-bubble__col">
        {!own && (
          <header className="ds-next-message-bubble__who">
            <strong>{sender}</strong>
            {role && <span className="accs-tag">{role}</span>}
          </header>
        )}
        <div className="ds-next-message-bubble__line">
          <div className="ds-next-message-bubble__text">
            {body && <p>{body}</p>}
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

/** The name being typed after an @ at the end of the message, or undefined when there is none. */
export function mentionQuery(value: string) {
  const match = /(?:^|\s)@([^\s@]{0,30})$/.exec(value);
  return match ? match[1] : undefined;
}

export function MessageComposer({
  value,
  onChange,
  onSend,
  isPending = false,
  label = "Message",
  attachments = false,
  maxLength = 4000,
  mentions = [],
  onAddFiles,
  fileAccept,
  files,
  hasFiles = false,
  filesBusy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isPending?: boolean;
  label?: string;
  attachments?: boolean;
  maxLength?: number;
  /** Called with the files chosen with the paperclip; without it the paperclip is off. */
  onAddFiles?: (files: File[]) => void;
  /** The file types the paperclip offers. */
  fileAccept?: string;
  /** The files waiting to go with the message, shown above the bar. */
  files?: ReactNode;
  /** Files are ready, so the message may be sent without words. */
  hasFiles?: boolean;
  /** A file is still uploading, so the message waits. */
  filesBusy?: boolean;
  /** People who can be named with @ in this conversation. */
  mentions?: { id: string; name: string }[];
}) {
  const typed = mentionQuery(value);
  const matches = typed === undefined ? [] : mentions.filter((person) => person.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(typed.toLowerCase()))).slice(0, 6);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState("");
  const open = matches.length > 0 && dismissed !== value;
  const fileInput = useRef<HTMLInputElement>(null);
  const canSend = (Boolean(value.trim()) || hasFiles) && !isPending && !filesBusy;
  const pick = (name: string) => {
    onChange(value.replace(/@([^\s@]*)$/, "@" + name + " "));
    setActive(0);
  };
  return (
    <form
      className="ds-next-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <TextArea
        label={label}
        placeholder="Write a message…"
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        showCount
        isRequired={!hasFiles}
        isDisabled={isPending}
        onKeyDown={(event) => {
          if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            setActive((index) => (index + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
            return;
          }
          if (open && (event.key === "Enter" || event.key === "Tab")) {
            event.preventDefault();
            pick(matches[Math.min(active, matches.length - 1)].name);
            return;
          }
          if (open && event.key === "Escape") {
            event.preventDefault();
            setDismissed(value);
            return;
          }
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      {files}
      {open && (
        <ul className="ds-next-mentions" role="listbox" aria-label="People to mention">
          {matches.map((person, index) => (
            <li key={person.id} role="option" aria-selected={index === active}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(person.name)}>
                <Mark name={person.name} />
                <span>{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="ds-next-composer__bar">
        <small className="ds-next-composer__hint">
          <Kbd keys="Enter" /> sends · <Kbd keys={["Shift", "Enter"]} /> adds a
          line
        </small>
        <div className="ds-next-composer__buttons">
          {attachments && onAddFiles && (
            <>
              <input
                ref={fileInput}
                className="mf-input"
                type="file"
                multiple
                accept={fileAccept}
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                  const chosen = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  if (chosen.length) onAddFiles(chosen);
                }}
              />
              <IconButton
                icon="paperclip"
                label="Attach pictures or files"
                isDisabled={isPending}
                onPress={() => fileInput.current?.click()}
              />
            </>
          )}
          {attachments && !onAddFiles && (
            <IconButton
              icon="paperclip"
              label="Attachments aren't available yet"
              isDisabled
            />
          )}
          <IconButton
            type="submit"
            variant="solid"
            icon="arrow-right"
            label={isPending ? "Sending message" : filesBusy ? "Waiting for files to upload" : "Send"}
            isDisabled={!canSend}
          />
        </div>
      </div>
    </form>
  );
}
