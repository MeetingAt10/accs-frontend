import { roleLabelOf } from '@/lib/role-labels'
import { Pager, usePaged } from '@/components/app/paging'
import {
  Alert,
  Avatar,
  Button,
  ComboBox,
  Divider,
  Drawer,
  EmptyState,
  Grid,
  IconButton,
  Link,
  MenuButton,
  MenuItem,
  Modal,
  ModalActions,
  ModalBody,
  Radio,
  RadioGroup,
  RoleBadge,
  Row,
  Search,
  SelectOption,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextArea,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  RequirePermission,
  RestrictedView,
  RetryView,
} from "@/components/app/guards";
import {
  ApiError,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageQuery, sessionQuery } from "@/lib/queries";
import {
  ConversationList,
  MessageBubble,
  MessageComposer,
  MessageList,
  NotificationItem,
  NotificationList,
} from "@/components/ds-next";
import { NotificationGroup } from "@/components/ds-next/notifications";
import { Empty, PageHeader, Panel } from "@/components/app/page-shell";
import { SlidePills, ease } from "@/components/app/portal-motion";
import "./communications.css";

type Item = Record<string, unknown>;
type Priority = "high" | "normal" | "muted";

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

function roles(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((role): role is string => typeof role === "string")
    : [];
}

function useCommunicationAction(pageId: string, showToast = true) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["page"] });
      if (showToast) toast(result.message, { tone: "success" });
    },
  });
}

function ActionError({ error }: { error: unknown }) {
  return error ? (
    <Alert tone="danger" title="The change couldn't be saved">
      {error instanceof Error
        ? error.message
        : "Try again. Your entered text is kept."}
    </Alert>
  ) : null;
}

function Heading({
  title,
  description,
  actions,
  crumbs,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      crumbs={crumbs}
    />
  );
}

/** A person matches when every word typed starts a word of their name. A leading @ is ignored, so "@rob" finds Robin. */
export function matchesPerson(name: string, input: string) {
  const typed = input.trim().replace(/^@/, '').toLowerCase().split(/\s+/).filter(Boolean)
  if (!typed.length) return true
  const parts = name.toLowerCase().split(/[\s.,-]+/).filter(Boolean)
  return typed.every((word) => parts.some((part) => part.startsWith(word)))
}

function MessagesPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  });
  const session = useQuery(sessionQuery());
  const conversation = object(page.data.record);
  const allThreads = items(page.data.threads);
  const recipients = items(page.data.recipients);
  const requestedRecipient = new URLSearchParams(search).get("recipient") ?? "";
  const [newOpen, setNewOpen] = useState(
    Boolean(
      requestedRecipient &&
      recipients.some((recipient) => recipient.id === requestedRecipient),
    ),
  );
  const [recipientId, setRecipientId] = useState(requestedRecipient);
  const [newBody, setNewBody] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");
  const [body, setBody] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Item>();
  const [reportReason, setReportReason] = useState("");
  const [earlier, setEarlier] = useState(20);
  const create = useCommunicationAction("P11");
  const action = useCommunicationAction("P12");
  const messages = items(conversation.messages);
  const members = items(conversation.members);
  const threads = allThreads.filter((thread) => {
    const text = [
      words(thread.title),
      ...items(thread.members).map((member) => words(member.name)),
    ]
      .join(" ")
      .toLowerCase();
    return (
      (!query.trim() || text.includes(query.trim().toLowerCase())) &&
      (tab === "all" || thread.kind === tab)
    );
  });
  const isThread = page.pageId === "P12";
  const conversationId = words(conversation.id);
  const officeConversation = members.some((member) =>
    roles(member.roles).some((role) => ["guidance", "osas"].includes(role)),
  );

  useEffect(() => {
    if (!isThread || !conversationId) return;
    void performPageAction("P12", {
      action: "markThreadRead",
      recordId: conversationId,
      payload: {},
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["page"] }))
      .catch(() => undefined);
  }, [isThread, conversationId, messages.length, queryClient]);

  async function createConversation() {
    if (!recipientId || !newBody.trim() || create.isPending) return;
    try {
      const result = await create.mutateAsync({
        action: "createThread",
        payload: { recipientId, body: newBody.trim() },
      });
      setNewOpen(false);
      setNewBody("");
      router.history.push(
        "/messages/" + encodeURIComponent(words(object(result.record).id)),
      );
    } catch {
      // The inline error retains the message and recipient.
    }
  }

  async function sendMessage() {
    if (!body.trim() || action.isPending) return;
    try {
      await action.mutateAsync({
        action: "sendMessage",
        recordId: words(conversation.id),
        payload: { body: body.trim() },
      });
      setBody("");
    } catch {
      // The composer keeps the entered text after an error.
    }
  }

  async function reportMessage() {
    if (!reportedMessage || !reportReason.trim() || action.isPending) return;
    try {
      await action.mutateAsync({
        action: "flag",
        recordId: words(conversation.id),
        payload: {
          itemType: "message",
          itemId: words(reportedMessage.id),
          reason: reportReason.trim(),
        },
      });
      setReportedMessage(undefined);
      setReportReason("");
    } catch {
      // The modal keeps the reason after an error.
    }
  }

  if (isThread && !conversation.id) return <RestrictedView record />;
  return (
    <Stack gap={24}>
      <Heading
        title="Messages"
        actions={
          <IconButton
            variant="solid"
            icon="plus"
            label="New message"
            onPress={() => setNewOpen(true)}
          />
        }
      />
      <Grid
        columns="split"
        className={
          isThread
            ? "communications-messages communications-messages--thread"
            : "communications-messages communications-messages--inbox"
        }
      >
        <section
          aria-label="Conversation list"
          className="communications-messages__inbox"
        >
          <Stack gap={16}>
            <Search
              label="Search conversations"
              value={query}
              onChange={setQuery}
            />
            <Tabs
              selectedKey={tab}
              onSelectionChange={(key) => setTab(String(key))}
            >
              <TabList aria-label="Conversation types">
                <Tab
                  id="all"
                  count={allThreads.length}
                >
                  All
                </Tab>
                <Tab
                  id="direct"
                  count={allThreads.filter((thread) => thread.kind === "direct").length}
                >
                  Direct
                </Tab>
                <Tab
                  id="group"
                  count={allThreads.filter((thread) => thread.kind === "group").length}
                >
                  Groups
                </Tab>
              </TabList>
              {["all", "direct", "group"].map((key) => (
                <TabPanel id={key} key={key}>
                  <ConversationList
                    conversations={threads}
                    currentId={words(conversation.id)}
                  />
                </TabPanel>
              ))}
            </Tabs>
          </Stack>
        </section>
        <section
          className="communications-messages__thread"
          aria-label={
            isThread
              ? words(conversation.title, "Conversation")
              : "Conversation"
          }
        >
          {isThread && (
            <Button
              className="communications-thread-back"
              href="/messages"
              size="sm"
              variant="tertiary"
            >
              Back to conversations
            </Button>
          )}
          {!isThread ? (
            <EmptyState
              title="No conversation open"
              description="Choose one from the list or start a new message."
            />
          ) : (
            <Stack gap={24}>
              <Row justify="between">
                <Row gap={12}>
                  <Avatar name={words(conversation.title)} size={36} />
                  <Stack gap={4}>
                    <h2 style={{ margin: 0 }}>{words(conversation.title)}</h2>
                    <span>
                      {members.length} members ·{" "}
                      {conversation.kind === "group"
                        ? "Class group"
                        : "Direct conversation"}
                    </span>
                  </Stack>
                </Row>
                <MenuButton
                  label="Conversation options"
                  icon="dots-three"
                  iconOnly
                  onAction={() => setMemberOpen(true)}
                >
                  <MenuItem id="members">Members</MenuItem>
                  <MenuItem id="mute">Mute</MenuItem>
                </MenuButton>
              </Row>
              {officeConversation && (
                <Alert
                  tone="neutral"
                  title="Keep case details out of messages"
                >
                  Put them in the case record.
                </Alert>
              )}
              {messages.length > earlier && (
                <Button
                  variant="tertiary"
                  onPress={() => setEarlier((count) => count + 20)}
                >
                  Load earlier messages
                </Button>
              )}
              {messages.length ? (
                <MessageList>
                  {messages
                    .slice(-earlier)
                    .map((message, index, visibleMessages) => {
                      const sender = object(message.author);
                      const prior = visibleMessages[index - 1];
                      const day = words(message.at).slice(0, 10);
                      return (
                        <Stack gap={16} key={words(message.id)}>
                          {(!prior || day !== words(prior.at).slice(0, 10)) && (
                            <Divider
                              label={new Date(day).toLocaleDateString("en-PH", {
                                dateStyle: "long",
                              })}
                            />
                          )}
                          <MessageBubble
                            photo={words(sender.photo)}
                            sender={words(sender.name, "ACCS member")}
                            role={roles(sender.roles).map(roleLabelOf).join(" · ")}
                            body={message.underReview === true ? `${words(message.body)}\n\nUnder review. Only you can see this until a moderator reviews it.` : words(message.body)}
                            at={words(message.at)}
                            own={sender.id === session.data?.user.id}
                            actions={
                              <MenuButton
                                label="Message actions"
                                icon="dots-three"
                                iconOnly
                                onAction={(key) => {
                                  if (key === "copy")
                                    void navigator.clipboard
                                      ?.writeText(words(message.body))
                                      .then(() => toast("Message copied."))
                                      .catch(() =>
                                        toast(
                                          "Copy is unavailable in this browser.",
                                        ),
                                      );
                                  if (key === "report")
                                    setReportedMessage(message);
                                }}
                              >
                                <MenuItem id="copy">Copy</MenuItem>
                                <MenuItem id="report">Report message</MenuItem>
                              </MenuButton>
                            }
                          />
                        </Stack>
                      );
                    })}
                </MessageList>
              ) : (
                <EmptyState
                  title="No messages yet"
                  description="Write the first one below."
                />
              )}
              <ActionError error={action.error} />
              <MessageComposer
                value={body}
                onChange={setBody}
                onSend={() => void sendMessage()}
                isPending={action.isPending}
                attachments
                mentions={members
                  .filter((member) => member.id !== session.data?.user.id)
                  .map((member) => ({ id: words(member.id), name: words(member.name) }))}
              />
            </Stack>
          )}
        </section>
      </Grid>
      <Modal title="New message" isOpen={newOpen} onOpenChange={setNewOpen}>
        <ModalBody>
          <Stack gap={16}>
            <ComboBox
              label="To"
              placeholder="Search people"
              description="Type a name, or @ and a name."
              defaultFilter={matchesPerson}
              selectedKey={recipientId || null}
              onSelectionChange={(key) => setRecipientId(String(key ?? ""))}
              emptyMessage="No matching recipients"
              isRequired
            >
              {recipients.map((recipient) => (
                <SelectOption
                  id={words(recipient.id)}
                  key={words(recipient.id)}
                  textValue={words(recipient.name)}
                >
                  {words(recipient.name)} · {roles(recipient.roles).map(roleLabelOf).join(", ")}
                </SelectOption>
              ))}
            </ComboBox>
            <TextArea
              label="Message"
              value={newBody}
              onChange={setNewBody}
              maxLength={4000}
              showCount
              isRequired
            />
            <ActionError error={create.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setNewOpen(false)}>
            Cancel
          </Button>
          <Button
            onPress={() => void createConversation()}
            loading={create.isPending}
            isDisabled={!recipientId || !newBody.trim()}
          >
            Send
          </Button>
        </ModalActions>
      </Modal>
      <Drawer
        title="Conversation members"
        side="end"
        isOpen={memberOpen}
        onOpenChange={setMemberOpen}
      >
        <Stack gap={24}>
          {members.map((member) => (
            <Row key={words(member.id)}>
              <Avatar name={words(member.name)} size={32} />
              <Stack gap={4}>
                <strong>{words(member.name)}</strong>
                <RoleBadge>{roles(member.roles).join(" · ")}</RoleBadge>
              </Stack>
            </Row>
          ))}
          <Switch
            isSelected={conversation.muted === true}
            onChange={(muted) =>
              action.mutate({
                action: "muteThread",
                recordId: words(conversation.id),
                payload: { muted },
              })
            }
            isDisabled={action.isPending}
          >
            Mute this conversation
          </Switch>
          <ActionError error={action.error} />
        </Stack>
      </Drawer>
      <Modal
        title="Report this message"
        isOpen={Boolean(reportedMessage)}
        onOpenChange={(open) => {
          if (!open) setReportedMessage(undefined);
        }}
      >
        <ModalBody>
          <Stack gap={16}>
            <Alert tone="neutral" title="A person reviews every report">
              A report is not a finding.
            </Alert>
            <TextArea
              label="Reason"
              value={reportReason}
              onChange={setReportReason}
              maxLength={2000}
              isRequired
            />
            <ActionError error={action.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button
            variant="secondary"
            onPress={() => setReportedMessage(undefined)}
          >
            Cancel
          </Button>
          <Button
            onPress={() => void reportMessage()}
            loading={action.isPending}
            isDisabled={!reportReason.trim()}
          >
            Send for review
          </Button>
        </ModalActions>
      </Modal>
    </Stack>
  );
}

export function notificationHref(pageId: string, recordId: string) {
  const paths: Record<string, string> = {
    P03: "/home",
    P04: "/feed",
    P06: "/feed/",
    P08: "/spaces/",
    P10: "/organizations/",
    P11: "/messages",
    P12: "/messages/",
    P13: "/calendar",
    P14: "/consultations",
    P16: "/consultations/requests/",
    P18: "/reports",
    P20: "/reports/",
    P21: "/cases",
    P22: "/cases/",
    P24: "/cases/clusters/",
    P26: "/evaluations",
    P27: "/evaluations/forms/",
    P28: "/evaluations/results",
    P29: "/evaluations/results/",
    P30: "/evaluations/cycles",
    P31: "/evaluations/cycles/",
    P33: "/records",
    P34: "/records/",
    P35: "/restrictions",
    P36: "/standing",
    P37: "/directory",
    P38: "/people/",
    P39: "/profile",
    P40: "/notifications",
    P41: "/assistant",
    P42: "/help",
    P43: "/settings",
    P44: "/settings/notifications",
    P45: "/admin",
    P46: "/admin/users",
    P47: "/admin/users/",
    P49: "/admin/moderation",
    P50: "/admin/moderation/",
    P51: "/admin/audit",
    P52: "/admin/monitoring",
  };
  const path = paths[pageId] ?? "/help";
  return path.endsWith("/") ? path + encodeURIComponent(recordId) : path;
}

const dayOf = (value: unknown) => {
  const date = new Date(words(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
};

function NotificationsPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [restrictedSource, setRestrictedSource] = useState(false);
  const action = useCommunicationAction("P40", false);
  const today = dayOf(new Date().toISOString());
  const notices = items(page.data.notifications).sort(
    (left, right) =>
      Number(dayOf(right.at) === today) - Number(dayOf(left.at) === today) ||
      Number(right.priority === "high") - Number(left.priority === "high") ||
      words(right.at).localeCompare(words(left.at)),
  );
  const unreadCount = notices.filter((notice) => notice.read !== true).length;
  const kinds = [...new Set(notices.map((notice) => words(notice.kind)).filter(Boolean))];
  const filtered = notices.filter(
    (notice) =>
      filter === "all" ||
      (filter === "priority" && notice.priority === "high") ||
      (filter === "unread" && notice.read !== true) ||
      filter === "kind:" + words(notice.kind),
  );
  // Ten notifications a page; a new filter starts again at page 1.
  const paged = usePaged(filtered, 10, filter);
  const visible = paged.shown;
  const rows: ReactNode[] = [];
  visible.forEach((notice, index) => {
    const group = dayOf(notice.at) === today ? "Today" : "Earlier";
    const previous =
      index > 0
        ? dayOf(visible[index - 1].at) === today
          ? "Today"
          : "Earlier"
        : undefined;
    if (group !== previous)
      rows.push(<NotificationGroup key={"group-" + group} label={group} />);
    rows.push(
      <NotificationItem
        key={words(notice.id)}
        index={index}
        notification={notice}
        onOpen={() => void openNotice(notice)}
        onRead={() =>
          action.mutate({
            action: "markNotification",
            recordId: words(notice.id),
            payload: { read: notice.read !== true },
          })
        }
        isPending={action.isPending}
      />,
    );
  });

  async function openNotice(notice: Item) {
    setRestrictedSource(false);
    try {
      const result = await action.mutateAsync({
        action: "openNotification",
        recordId: words(notice.id),
        payload: {},
      });
      const source = object(result.record);
      router.history.push(
        notificationHref(words(source.pageId), words(source.recordId)),
      );
    } catch (error) {
      if (error instanceof ApiError && [403, 404].includes(error.status))
        setRestrictedSource(true);
    }
  }

  return (
    <div className="accs-stack">
      <Heading
        title="Notifications"
        description={
          unreadCount ? unreadCount + " unread" : "No unread notifications"
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon="check"
              onPress={() =>
                action.mutate({ action: "markAllNotifications", payload: {} })
              }
              isDisabled={action.isPending}
            >
              Mark all read
            </Button>
            <Button
              variant="tertiary"
              icon="gear"
              href="/settings/notifications"
            >
              Settings
            </Button>
          </>
        }
      />
      {restrictedSource ? (
        <RestrictedView record />
      ) : (
        <ActionError error={action.error} />
      )}
      <SlidePills
        label="Notification filters"
        value={filter}
        onChange={(next) => {
          setFilter(next);
        }}
        options={[
          { id: "all", label: "All" },
          { id: "unread", label: "Unread", count: unreadCount },
          { id: "priority", label: "Priority" },
          ...(kinds.length > 1
            ? kinds.map((kind) => ({
                id: "kind:" + kind,
                label: <span style={{ textTransform: "capitalize" }}>{kind}</span>,
              }))
            : []),
        ]}
      />
      <Panel flush className="accs-reveal">
        {visible.length ? (
          <NotificationList>{rows}</NotificationList>
        ) : (
          <Empty title="No notifications">
            {filter === "all"
              ? "Updates about your reports, appointments, and messages show up here."
              : "Nothing matches this filter."}
          </Empty>
        )}
      </Panel>
      <Pager paged={paged} noun="notifications" />
    </div>
  );
}

type AssistantMessage = {
  id: number;
  body: string;
  own: boolean;
  sources?: Item[];
};

export function AssistantPanel({ suggestions }: { suggestions?: string[] }) {
  const session = useQuery(sessionQuery());
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const scroller = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const proposed = suggestions ?? [
    "What can you help me with?",
    ...(session.data?.user.roles.includes("student")
      ? ["Show my schedule", "Explain my report milestones"]
      : []),
  ];
  const action = useMutation({
    mutationFn: (value: string) =>
      performPageAction("P41", {
        action: "assistantAsk",
        payload: { question: value },
      }),
    onSuccess: (result, submittedQuestion) => {
      const response = object(result.record);
      setMessages((current) => [
        ...current,
        { id: current.length, body: submittedQuestion, own: true },
        {
          id: current.length + 1,
          body: words(response.reply),
          own: false,
          sources: items(response.sources),
        },
      ]);
      setQuestion("");
      void queryClient.invalidateQueries({ queryKey: ["page", "P52"] });
    },
  });

  useEffect(() => {
    const el = scroller.current;
    if (el && (messages.length || action.isPending))
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages.length, action.isPending, reduce]);

  function ask() {
    if (question.trim() && !action.isPending) action.mutate(question.trim());
  }

  return (
    <div className="cm-chat">
      <div className="cm-chat__scroll" ref={scroller}>
        <div className="cm-chat__col">
          {messages.length ? (
            <ol className="cm-msgs" aria-label="Assistant conversation">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.li
                    key={message.id}
                    className="cm-msg"
                    data-own={message.own || undefined}
                    initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: reduce ? 0 : 0.34, ease }}
                  >
                    <div className="cm-msg__bubble">
                      <span className="cm-msg__who">
                        {message.own ? "You" : "ACCS assistant"}
                      </span>
                      <p>{message.body}</p>
                      {message.sources && message.sources.length > 0 && (
                        <p className="cm-msg__sources">
                          Sources
                          {message.sources.map((source) => (
                            <Link
                              href={words(source.href, "/help")}
                              key={words(source.href) + words(source.title)}
                            >
                              {words(source.title, "Help")}
                            </Link>
                          ))}
                        </p>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          ) : (
            <div className="cm-welcome">
              <h2>Ask about ACCS</h2>
              <p>Pick a suggestion or type your own question.</p>
            </div>
          )}
          {action.isPending && (
            <div className="cm-typing" role="status">
              <span className="cm-dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              Writing a reply
            </div>
          )}
          {action.isError && (
            <Alert tone="danger" title="The assistant isn't available right now.">
              <p>
                Your question is kept. Try again, or open{" "}
                <Link href="/help">Help</Link>.
              </p>
            </Alert>
          )}
        </div>
      </div>
      <div className="cm-chat__foot">
        <div className="cm-chat__col">
          <div className="accs-pills" role="group" aria-label="Suggested prompts">
            {proposed.map((prompt) => (
              <button
                type="button"
                className="accs-pill"
                key={prompt}
                onClick={() => setQuestion(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
          <MessageComposer
            label="Question for the assistant"
            value={question}
            onChange={setQuestion}
            onSend={ask}
            isPending={action.isPending}
            maxLength={2000}
          />
          {/* TBD(D-08): assistant provider data handling and log retention require approval. */}
          <div className="cm-chat__note">
            <small>
              The assistant explains things and helps you write. It does not
              decide reports, restrictions, or outcomes, and it cannot see
              records you cannot.
            </small>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => {
                setMessages([]);
                action.reset();
              }}
              isDisabled={action.isPending || !messages.length}
            >
              Clear conversation
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const priorityGroups = [
  { title: "Your work", keys: ["report", "case", "consultation", "evaluation"] },
  { title: "Conversations and news", keys: ["message", "announcement"] },
  { title: "Review queues", keys: ["moderation"] },
];

function NotificationPrioritiesPage({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const settings = object(page.data.settings);
  const saved = object(settings.priorities);
  const categories = roles(page.data.categories);
  // Categories the server says cannot be turned off (for example report, case and evaluation updates).
  const required = new Set(roles(page.data.requiredCategories));
  const [priorities, setPriorities] = useState<Record<string, Priority>>(() =>
    Object.fromEntries(
      categories.map((category) => {
        const value = words(saved[category]);
        const known = ["high", "normal", "muted"].includes(value) ? (value as Priority) : "normal";
        return [category, required.has(category) && known === "muted" ? "normal" : known];
      }),
    ),
  );
  const action = useCommunicationAction("P44");
  const categoryNames: Record<string, string> = {
    report: session.data?.user.roles.includes("student")
      ? "Report replies"
      : "New assigned reports",
    case: "Case milestones",
    consultation: "Appointment updates",
    message: "Messages",
    announcement: "Announcements",
    evaluation: "Evaluations",
    moderation: "Moderation queue",
  };
  const known = new Set(priorityGroups.flatMap((group) => group.keys));
  const groups = [
    ...priorityGroups.map((group) => ({
      title: group.title,
      keys: categories.filter((category) => group.keys.includes(category)),
    })),
    { title: "Other", keys: categories.filter((category) => !known.has(category)) },
  ].filter((group) => group.keys.length);
  return (
    <div className="accs-stack">
      <Heading
        title="Notification priorities"
        description="Set each kind of update to urgent, normal, or off."
        crumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Notifications" },
        ]}
      />
      <div className="accs-stack accs-stagger">
        {groups.map((group) => (
          <Panel flush key={group.title} title={group.title}>
            <div className="cm-prefs">
              {group.keys.map((category) => (
                <div className="cm-pref" key={category}>
                  <RadioGroup
                    row
                    label={categoryNames[category] ?? category}
                    description={required.has(category) ? "Required. These updates can't be turned off." : undefined}
                    value={priorities[category] ?? "normal"}
                    onChange={(priority) =>
                      setPriorities((current) => ({
                        ...current,
                        [category]: priority as Priority,
                      }))
                    }
                  >
                    <Radio value="high">Urgent</Radio>
                    <Radio value="normal">Normal</Radio>
                    {!required.has(category) && <Radio value="muted">Off</Radio>}
                  </RadioGroup>
                  {required.has(category) && <span className="accs-tag cm-required">Required</span>}
                </div>
              ))}
            </div>
          </Panel>
        ))}
        <p className="pt-scope">
          Email and other delivery channels are not set up yet. Priority
          choices never change your access to a report or case.
        </p>
      </div>
      <ActionError error={action.error} />
      <div className="cm-savebar">
        <Button
          onPress={() =>
            action.mutate({
              action: "saveNotificationPreferences",
              payload: { priorities },
            })
          }
          loading={action.isPending}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function CommunicationsPage({ page }: { page: PageEnvelope }) {
  if (page.pageId === "P11" || page.pageId === "P12")
    return (
      <MessagesPage
        key={words(object(page.data.record).id, page.pageId)}
        page={page}
      />
    );
  if (page.pageId === "P40") return <NotificationsPage page={page} />;
  if (page.pageId === "P44") return <NotificationPrioritiesPage page={page} />;
  return (
    <div className="accs-stack">
      <Heading
        title="Assistant"
        description="Ask how ACCS works or where to find something."
      />
      <Panel flush className="cm-chat-panel accs-reveal">
        <AssistantPanel suggestions={roles(page.data.suggestions)} />
      </Panel>
    </div>
  );
}

export function CommunicationScreen({ pageId }: { pageId: string }) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const recordId = Object.values(params).at(-1);
  const filters = useRouterState({
    select: (state) => state.location.searchStr.slice(1),
  });
  const session = useQuery(sessionQuery());
  const page = useQuery({
    ...pageQuery(pageId, recordId, filters),
    enabled: session.data?.allowedPages.includes(pageId) === true,
  });
  return (
    <RequirePermission pageId={pageId}>
      <div className="app-page">
        {page.isPending ? (
          pageId === "P40" ? (
            <div className="accs-stack" aria-busy="true">
              <span className="cm-sr" role="status">
                Loading notifications
              </span>
              <Panel flush>
                {Array.from({ length: 5 }, (_, index) => (
                  <div className="cm-skel" key={index}>
                    <span className="accs-skeleton cm-skel__icon" />
                    <span className="cm-skel__lines">
                      <span className="accs-skeleton" />
                      <span className="accs-skeleton" />
                    </span>
                  </div>
                ))}
              </Panel>
            </div>
          ) : (
            <ViewState
              kind="loading"
              title={
                pageId === "P11" || pageId === "P12"
                  ? "Loading conversations"
                  : "Loading page"
              }
            />
          )
        ) : page.isError ? (
          page.error instanceof ApiError &&
          [403, 404].includes(page.error.status) ? (
            <RestrictedView record={pageId === "P12"} />
          ) : (
            <RetryView onRetry={() => void page.refetch()} />
          )
        ) : (
          <CommunicationsPage page={page.data} />
        )}
      </div>
    </RequirePermission>
  );
}
