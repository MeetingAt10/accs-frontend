import {
  Alert,
  Avatar,
  Badge,
  Breadcrumbs,
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
  SectionHeader,
  SelectOption,
  Skeleton,
  Spinner,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tag,
  TagGroup,
  TextArea,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";

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
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <SectionHeader
      level={1}
      split
      title={title}
      description={description}
      actions={
        <Row gap={8}>
          <Badge outline marker={false}>
            Sample data
          </Badge>
          {actions}
        </Row>
      }
    />
  );
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
                  count={allThreads.reduce(
                    (sum, thread) => sum + Number(thread.unread ?? 0),
                    0,
                  )}
                >
                  All
                </Tab>
                <Tab
                  id="direct"
                  count={allThreads
                    .filter((thread) => thread.kind === "direct")
                    .reduce(
                      (sum, thread) => sum + Number(thread.unread ?? 0),
                      0,
                    )}
                >
                  Direct
                </Tab>
                <Tab
                  id="group"
                  count={allThreads
                    .filter((thread) => thread.kind === "group")
                    .reduce(
                      (sum, thread) => sum + Number(thread.unread ?? 0),
                      0,
                    )}
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
              title="Pick a conversation"
              description="Open a conversation from the list, or start a new message."
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
                  title="Keep case details in the case record"
                >
                  Keep case details in the case record.
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
                            sender={words(sender.name, "ACCS member")}
                            role={roles(sender.roles).join(" · ")}
                            body={words(message.body)}
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
                  description="Send the first message in this conversation."
                />
              )}
              <ActionError error={action.error} />
              <MessageComposer
                value={body}
                onChange={setBody}
                onSend={() => void sendMessage()}
                isPending={action.isPending}
                attachments
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
              selectedKey={recipientId || null}
              onSelectionChange={(key) => setRecipientId(String(key ?? ""))}
              emptyMessage="No one you can message matches"
              isRequired
            >
              {recipients.map((recipient) => (
                <SelectOption
                  id={words(recipient.id)}
                  key={words(recipient.id)}
                  textValue={words(recipient.name)}
                >
                  {words(recipient.name)} · {roles(recipient.roles).join(", ")}
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
            <Alert tone="neutral" title="A report starts a human review">
              A report starts a human review. It isn't a finding.
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

function NotificationsPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [shown, setShown] = useState(10);
  const [restrictedSource, setRestrictedSource] = useState(false);
  const action = useCommunicationAction("P40", false);
  const today = new Date().toISOString().slice(0, 10);
  const notices = items(page.data.notifications).sort(
    (left, right) =>
      Number(words(right.at).slice(0, 10) === today) -
        Number(words(left.at).slice(0, 10) === today) ||
      Number(right.priority === "high") - Number(left.priority === "high") ||
      words(right.at).localeCompare(words(left.at)),
  );
  const filtered = notices.filter(
    (notice) =>
      tab === "all" ||
      (tab === "priority" && notice.priority === "high") ||
      (tab === "unread" && notice.read !== true),
  );
  const visible = filtered.slice(0, shown);

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
    <Stack gap={24}>
      <Heading
        title="Notifications"
        actions={
          <>
            <Button
              variant="tertiary"
              onPress={() =>
                action.mutate({ action: "markAllNotifications", payload: {} })
              }
              isDisabled={action.isPending}
            >
              Mark all read
            </Button>
            <Link href="/settings/notifications">Settings</Link>
          </>
        }
      />
      {restrictedSource ? (
        <RestrictedView record />
      ) : (
        <ActionError error={action.error} />
      )}
      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => {
          setTab(String(key));
          setShown(10);
        }}
      >
        <TabList aria-label="Notification filters">
          <Tab id="all">All</Tab>
          <Tab id="priority">Priority</Tab>
          <Tab
            id="unread"
            count={notices.filter((notice) => notice.read !== true).length}
          >
            Unread
          </Tab>
        </TabList>
        {["all", "priority", "unread"].map((key) => (
          <TabPanel id={key} key={key}>
            {visible.length ? (
              <NotificationList>
                {visible.map((notice, index) => {
                  const group =
                    words(notice.at).slice(0, 10) === today
                      ? "Today"
                      : "Earlier";
                  const previousGroup =
                    index > 0 &&
                    words(visible[index - 1].at).slice(0, 10) === today
                      ? "Today"
                      : "Earlier";
                  return (
                    <Fragment key={words(notice.id)}>
                      {(index === 0 || group !== previousGroup) && (
                        <li>
                          <Divider label={group} />
                        </li>
                      )}
                      <NotificationItem
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
                      />
                    </Fragment>
                  );
                })}
              </NotificationList>
            ) : (
              <EmptyState
                title="You're all caught up"
                description="Updates for your account appear here when they are available."
              />
            )}
          </TabPanel>
        ))}
      </Tabs>
      {filtered.length > shown && (
        <Button
          variant="tertiary"
          onPress={() => setShown((count) => count + 10)}
        >
          Load more
        </Button>
      )}
    </Stack>
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

  function ask() {
    if (question.trim() && !action.isPending) action.mutate(question.trim());
  }

  return (
    <Stack gap={24}>
      <TagGroup label="Suggested prompts">
        {proposed.map((prompt) => (
          <Tag
            id={prompt}
            key={prompt}
            textValue={prompt}
            onAction={() => setQuestion(prompt)}
          >
            {prompt}
          </Tag>
        ))}
      </TagGroup>
      {messages.length ? (
        <MessageList label="Assistant conversation">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              sender={message.own ? "You" : "ACCS assistant"}
              body={message.body}
              own={message.own}
            >
              {message.sources && (
                <Row gap={8}>
                  {message.sources.map((source) => (
                    <Link
                      href={words(source.href, "/help")}
                      key={words(source.href) + words(source.title)}
                    >
                      {words(source.title, "Help")}
                    </Link>
                  ))}
                </Row>
              )}
            </MessageBubble>
          ))}
        </MessageList>
      ) : (
        <EmptyState
          title="Ask about ACCS"
          description="Choose a suggested prompt or write a question below."
        />
      )}
      {action.isPending && (
        <Row gap={8}>
          <Spinner />
          <span role="status">
            Preparing a reply from permitted information
          </span>
        </Row>
      )}
      {action.isError && (
        <Alert tone="danger" title="The assistant isn't available right now.">
          <p>
            Your question is kept. Try again, or open{" "}
            <Link href="/help">Help</Link>.
          </p>
        </Alert>
      )}
      <MessageComposer
        label="Question for the assistant"
        value={question}
        onChange={setQuestion}
        onSend={ask}
        isPending={action.isPending}
        maxLength={2000}
      />
      <Alert tone="neutral" title="The assistant explains and helps you write">
        The assistant explains and helps you write. It doesn't decide reports,
        restrictions, or outcomes, and it can't see records you can't.
      </Alert>
      {/* TBD(D-08): assistant provider data handling and log retention require approval. */}
      <Button
        variant="tertiary"
        onPress={() => {
          setMessages([]);
          action.reset();
        }}
        isDisabled={action.isPending}
      >
        Clear conversation
      </Button>
    </Stack>
  );
}

function NotificationPrioritiesPage({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const settings = object(page.data.settings);
  const saved = object(settings.priorities);
  const categories = roles(page.data.categories);
  const [priorities, setPriorities] = useState<Record<string, Priority>>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category,
        ["high", "normal", "muted"].includes(words(saved[category]))
          ? (saved[category] as Priority)
          : "normal",
      ]),
    ),
  );
  const action = useCommunicationAction("P44");
  const categoryNames: Record<string, string> = {
    report: session.data?.user.roles.includes("student")
      ? "Report replies"
      : "New assigned reports",
    case: "Case milestones",
    consultation: "Consultation updates",
    message: "Messages",
    announcement: "Announcements",
    evaluation: "Evaluations",
    moderation: "Moderation queue",
  };
  return (
    <Stack gap={24}>
      <Breadcrumbs
        items={[
          { label: "Settings", href: "/settings" },
          { label: "Notifications" },
        ]}
      />
      <Heading title="Notification priorities" />
      {categories.map((category) => (
        <section
          key={category}
          style={{
            paddingBlock: "var(--ds-space-16)",
            borderBottom: "1px solid var(--ds-border-default)",
          }}
        >
          <RadioGroup
            row
            label={categoryNames[category] ?? category}
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
            <Radio value="muted">Off</Radio>
          </RadioGroup>
        </section>
      ))}
      {/* TBD(D-06): no category is marked mandatory until the required-category policy is approved. */}
      <Alert tone="neutral" title="Delivery channels are undecided">
        Delivery channels such as email are still being decided. Priority
        choices do not change your access to a report or case.
      </Alert>
      <ActionError error={action.error} />
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
    </Stack>
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
    <Stack gap={24}>
      <Heading
        title="Assistant"
        description="Ask how ACCS works, where to find things, and what a stage means."
      />
      <AssistantPanel suggestions={roles(page.data.suggestions)} />
    </Stack>
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
          <Stack gap={16} aria-busy="true">
            <ViewState
              kind="loading"
              title={
                pageId === "P11" || pageId === "P12"
                  ? "Loading conversations"
                  : pageId === "P40"
                    ? "Loading notifications"
                    : "Loading page"
              }
            />
            {pageId === "P40" &&
              Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} shape="block" height="4rem" />
              ))}
          </Stack>
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
