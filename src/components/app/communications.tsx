import { MessageFiles, PendingFiles, messageFileAccept, messageFileProblem, messageFileType, messageFilesPerMessage, type PendingFile } from '@/components/app/message-files'
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
  TextField,
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
  apiErrorText,
  uploadMessageFile,
  type MessageFile,
  performPageAction,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageQuery, sessionQuery } from "@/lib/queries";
import { messageFileLink, messageFilePath } from "@/lib/api";
import { replaceFilters } from "@/lib/url-filters";
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

/** Mute a conversation. The switch flips at once and pages refresh in the background, so it can be switched back right away. */
function MuteSwitch({ conversationId, muted }: { conversationId: string; muted: boolean }) {
  const queryClient = useQueryClient();
  const [on, setOn] = useState(muted);
  useEffect(() => setOn(muted), [muted]);
  const save = useMutation({
    mutationFn: (next: boolean) => performPageAction("P12", { action: "muteThread", recordId: conversationId, payload: { muted: next } }),
    // Only the message pages change. Reloading every page on each toggle sent a burst of requests that failed after a
    // few quick toggles (QA 17 November).
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["page", "P11"] });
      void queryClient.invalidateQueries({ queryKey: ["page", "P12"] });
      toast(result.message, { tone: "success" });
    },
    onError: (_error, next) => setOn(!next),
  });
  return (
    <>
      <Switch isSelected={on} isDisabled={save.isPending} onChange={(next) => { setOn(next); save.mutate(next); }}>
        Mute this conversation
      </Switch>
      <ActionError error={save.error} />
    </>
  );
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

/**
 * Puts a picture from a message on the clipboard. Browsers take PNG pictures only, so others are redrawn as PNG first.
 * Where the browser or the file link does not allow it, the person is pointed to Copy file link.
 */
async function copyPicture(threadId: string, messageId: string, fileId: string) {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Clipboard pictures are not supported.");
    const source = await (await fetch(await messageFileLink(threadId, messageId, fileId))).blob();
    const png = source.type === "image/png" ? source : await toPng(source);
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    toast("Image copied.");
  } catch {
    toast("This browser couldn't copy the image. Use Copy file link instead.");
  }
}

async function toPng(picture: Blob) {
  const bitmap = await createImageBitmap(picture);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not redraw the picture."))), "image/png"));
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
  // A new conversation is with one person or a named group (anyone may start a group, decided 16 November 2026).
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const canSendNew = groupMode
    ? Boolean(groupName.trim() && groupIds.length >= 2 && newBody.trim())
    : Boolean(recipientId && newBody.trim());
  const [query, setQuery] = useState("");
  // The tab is in the address, so opening a conversation from Groups stays on Groups (QA 17 November, V3: it jumped to All).
  const tab = ["direct", "group"].includes(new URLSearchParams(search).get("tab") ?? "") ? new URLSearchParams(search).get("tab")! : "all";
  const setTab = (next: string) => {
    const params = new URLSearchParams(search);
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    replaceFilters(router, router.state.location.pathname, params);
  };
  const tabSearch = tab === "all" ? "" : `?tab=${tab}`;
  const [addingPeople, setAddingPeople] = useState(false);
  const [newPeople, setNewPeople] = useState<string[]>([]);
  const [body, setBody] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<Item>();
  const [reportReason, setReportReason] = useState("");
  // Editing or deleting one's own message (decided 19 November 2026).
  const [editedMessage, setEditedMessage] = useState<Item>();
  const [editText, setEditText] = useState("");
  const [deletedMessage, setDeletedMessage] = useState<Item>();
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

  // "1 min ago" moves on by itself (QA 17 November, V3: the times changed only after a reload).
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setClock((tick) => tick + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // New messages show without notifications too: muting a conversation must not stop it from updating while open.
  useEffect(() => {
    const timer = window.setInterval(() => void queryClient.invalidateQueries({ queryKey: ["page", page.pageId] }), 15_000);
    return () => window.clearInterval(timer);
  }, [queryClient, page.pageId]);

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
    if (!canSendNew || create.isPending) return;
    try {
      const result = await create.mutateAsync(
        groupMode
          ? { action: "createGroupThread", payload: { title: groupName.trim(), memberIds: groupIds, body: newBody.trim() } }
          : { action: "createThread", payload: { recipientId, body: newBody.trim() } },
      );
      setNewOpen(false);
      setNewBody("");
      setGroupName("");
      setGroupIds([]);
      router.history.push(
        "/messages/" + encodeURIComponent(words(object(result.record).id)),
      );
    } catch {
      // The inline error retains the message and recipient.
    }
  }

  // Files chosen with the paperclip upload right away; the message names the ones that finished.
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const readyFiles = pendingFiles.filter((file) => file.state === "ready");
  const filesBusy = pendingFiles.some((file) => file.state === "uploading");
  // Previews still open when Messages is left are released.
  const latestFiles = useRef(pendingFiles);
  latestFiles.current = pendingFiles;
  useEffect(() => () => { for (const file of latestFiles.current) if (file.preview) URL.revokeObjectURL(file.preview); }, []);
  // A draft belongs to its conversation: opening another one shows that conversation's own draft, kept on the server so a
  // refresh or another device does not lose it (decided 20 November 2026), and never carries words or files to other people.
  const savedDraft = useRef("");
  useEffect(() => {
    const draft = object(conversation.draft);
    const files = (Array.isArray(draft.attachments) ? draft.attachments : []).map((file) => object(file) as unknown as MessageFile);
    setBody(words(draft.body));
    setPendingFiles((current) => {
      for (const file of current) if (file.preview) URL.revokeObjectURL(file.preview);
      return files.map((file) => ({ key: file.id, name: file.fileName, size: file.size, state: "ready" as const, file }));
    });
    savedDraft.current = JSON.stringify({ body: words(draft.body), attachments: files.map((file) => file.id) });
    // Only when the conversation changes: a refresh of the page must not overwrite what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  const draftFiles = pendingFiles.filter((file) => file.state === "ready").map((file) => file.file!);
  const draftKey = JSON.stringify({ body, attachments: draftFiles.map((file) => file.id) });
  // A send waits for a draft save already on its way and stops new ones, so a save that lands after the send cannot put
  // the sent words back as a draft (code review, 23 November 2026).
  const draftSave = useRef<Promise<unknown>>(Promise.resolve());
  const sending = useRef(false);
  useEffect(() => {
    if (!isThread || !conversationId || draftKey === savedDraft.current) return;
    const timer = window.setTimeout(() => {
      if (sending.current) return;
      savedDraft.current = draftKey;
      draftSave.current = performPageAction("P12", { action: "saveMessageDraft", recordId: conversationId, payload: { body, attachments: draftFiles } }).catch(() => {
        savedDraft.current = "";
      });
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, conversationId, isThread]);
  function removePendingFile(key: string) {
    setPendingFiles((current) => {
      const gone = current.find((file) => file.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return current.filter((file) => file.key !== key);
    });
  }
  // After the file picker closes, focus is still on the attach button, so the first Enter went there and the message
  // needed a second Enter (QA 17 November). Put the cursor back in the message box.
  const composerBox = useRef<HTMLDivElement>(null);
  const focusMessageBox = () => requestAnimationFrame(() => composerBox.current?.querySelector<HTMLElement>("textarea, [contenteditable=true]")?.focus());
  function addFiles(chosen: File[]) {
    focusMessageBox();
    const room = messageFilesPerMessage - pendingFiles.length;
    if (room <= 0) {
      toast(`Send at most ${messageFilesPerMessage} files at a time.`);
      return;
    }
    if (chosen.length > room) toast(`Only ${room} more ${room === 1 ? "file fits" : "files fit"} in this message.`);
    for (const file of chosen.slice(0, room)) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const problem = messageFileProblem(file);
      const preview = !problem && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setPendingFiles((current) => [...current, { key, name: file.name, size: file.size, preview, state: problem ? "failed" : "uploading", problem }]);
      if (problem) continue;
      uploadMessageFile(file, messageFileType(file))
        .then((uploaded) => setPendingFiles((current) => current.map((item) => (item.key === key ? { ...item, state: "ready", file: uploaded } : item))))
        .catch((error) => setPendingFiles((current) => current.map((item) => (item.key === key ? { ...item, state: "failed", problem: apiErrorText(error) } : item))));
    }
  }

  async function sendMessage() {
    if ((!body.trim() && !readyFiles.length) || filesBusy || action.isPending || sending.current) return;
    sending.current = true;
    try {
      await draftSave.current;
      await action.mutateAsync({
        action: "sendMessage",
        recordId: words(conversation.id),
        payload: { body: body.trim(), attachments: readyFiles.map((file) => file.file!) },
      });
      savedDraft.current = JSON.stringify({ body: "", attachments: [] });
      setBody("");
      for (const file of pendingFiles) if (file.preview) URL.revokeObjectURL(file.preview);
      setPendingFiles([]);
    } catch {
      // The composer keeps the entered text and files after an error.
    } finally {
      sending.current = false;
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

  async function changeMessage(kind: "editMessage" | "deleteMessage") {
    const target = kind === "editMessage" ? editedMessage : deletedMessage;
    if (!target || action.isPending) return;
    try {
      await action.mutateAsync({
        action: kind,
        recordId: words(conversation.id),
        payload: kind === "editMessage" ? { messageId: words(target.id), body: editText.trim() } : { messageId: words(target.id) },
      });
      setEditedMessage(undefined);
      setDeletedMessage(undefined);
    } catch {
      // The dialog stays open with the error and the text.
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
                    selfId={session.data?.user.id}
                    linkSearch={tabSearch}
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
                    {/* A direct chat shows the other person's role, not "2 members" (QA 17 November). */}
                    <span>
                      {conversation.kind === "group" || conversation.groupKind
                        ? `${members.length} members · ${conversation.groupKind === "people" ? "Group" : "Class group"}`
                        : [...new Set(members.filter((member) => member.id !== session.data?.user.id).flatMap((member) => roles(member.roles).map(roleLabelOf)))].join(" · ") || "Direct conversation"}
                    </span>
                  </Stack>
                </Row>
                {/* Members and Mute opened the same panel from a menu: the button opens it directly (QA 17 November, V3). */}
                <IconButton
                  icon="users"
                  label="Members and mute"
                  onPress={() => setMemberOpen(true)}
                />
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
                            body={message.deleted === true ? "Message deleted" : message.underReview === true ? `${words(message.body)}\n\nUnder review. Only you can see this until a moderator reviews it.` : words(message.body) + (message.editedAt ? " (edited)" : "")}
                            at={words(message.at)}
                            own={sender.id === session.data?.user.id}
                            children={
                              <MessageFiles
                                threadId={words(conversation.id)}
                                messageId={words(message.id)}
                                files={(Array.isArray(message.attachments) ? message.attachments : []) as MessageFile[]}
                              />
                            }
                            actions={
                              <MenuButton
                                label="Message actions"
                                icon="dots-three"
                                iconOnly
                                onAction={(key) => {
                                  // Copy the words, the picture itself, or a lasting link to the file (QA 17 November, V3: Copy gave
                                  // only the file name). A browser can put a picture on the clipboard, but not other kinds of file.
                                  const files = (Array.isArray(message.attachments) ? message.attachments : []).map(object);
                                  if (key === "copy")
                                    void navigator.clipboard
                                      ?.writeText(words(message.body))
                                      .then(() => toast("Message copied."))
                                      .catch(() => toast("Copy is unavailable in this browser."));
                                  if (key === "copy-image") {
                                    const picture = files.find((file) => words(file.contentType).startsWith("image/"));
                                    if (picture) void copyPicture(words(conversation.id), words(message.id), words(picture.id));
                                  }
                                  if (key === "copy-link")
                                    void navigator.clipboard
                                      ?.writeText(files.map((file) => new URL(messageFilePath(words(conversation.id), words(message.id), words(file.id)), window.location.origin).toString()).join("\n"))
                                      .then(() => toast(files.length === 1 ? "File link copied. It opens for people in this conversation." : "File links copied. They open for people in this conversation."))
                                      .catch(() => toast("Copy is unavailable in this browser."));
                                  if (key === "report")
                                    setReportedMessage(message);
                                  if (key === "edit") {
                                    setEditText(words(message.body));
                                    setEditedMessage(message);
                                  }
                                  if (key === "delete")
                                    setDeletedMessage(message);
                                }}
                              >
                                {words(message.body) && <MenuItem id="copy">{Array.isArray(message.attachments) && message.attachments.length ? "Copy text" : "Copy"}</MenuItem>}
                                {(Array.isArray(message.attachments) ? message.attachments : []).some((file) => words(object(file).contentType).startsWith("image/")) && <MenuItem id="copy-image">Copy image</MenuItem>}
                                {Array.isArray(message.attachments) && message.attachments.length > 0 && <MenuItem id="copy-link">{message.attachments.length === 1 ? "Copy file link" : "Copy file links"}</MenuItem>}
                                {sender.id === session.data?.user.id && message.deleted !== true && message.underReview !== true && words(message.body) && <MenuItem id="edit">Edit message</MenuItem>}
                                {sender.id === session.data?.user.id && message.deleted !== true && message.underReview !== true && <MenuItem id="delete">Delete message</MenuItem>}
                                {sender.id !== session.data?.user.id && <MenuItem id="report">Report message</MenuItem>}
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
              <div ref={composerBox}>
              <MessageComposer
                value={body}
                onChange={setBody}
                onSend={() => void sendMessage()}
                isPending={action.isPending}
                attachments
                onAddFiles={addFiles}
                fileAccept={messageFileAccept}
                files={<PendingFiles files={pendingFiles} onRemove={removePendingFile} />}
                hasFiles={readyFiles.length > 0}
                filesBusy={filesBusy}
                mentions={members
                  .filter((member) => member.id !== session.data?.user.id)
                  .map((member) => ({ id: words(member.id), name: words(member.name) }))}
              />
              </div>
            </Stack>
          )}
        </section>
      </Grid>
      <Modal title="New message" isOpen={newOpen} onOpenChange={setNewOpen}>
        <ModalBody>
          <Stack gap={16}>
            <RadioGroup label="Send to" row value={groupMode ? "group" : "person"} onChange={(value) => setGroupMode(value === "group")}>
              <Radio value="person">One person</Radio>
              <Radio value="group">A group</Radio>
            </RadioGroup>
            {groupMode && (
              <TextField label="Group name" value={groupName} onChange={setGroupName} maxLength={80} isRequired description="For example, Capstone team." />
            )}
            <ComboBox
              // In a group, a fresh box after each person is added, so the next search starts empty.
              key={groupMode ? `add-${groupIds.length}` : "to"}
              label={groupMode ? "Add people" : "To"}
              placeholder="Search people"
              description={groupMode ? "Add at least two people. Type a name, or @ and a name." : "Type a name, or @ and a name."}
              defaultFilter={matchesPerson}
              {...(groupMode ? {} : { selectedKey: recipientId || null })}
              onSelectionChange={(key) => {
                const id = String(key ?? "");
                if (!groupMode) setRecipientId(id);
                else if (id) setGroupIds((current) => (current.includes(id) ? current : [...current, id]));
              }}
              emptyMessage="No matching recipients"
              isRequired={!groupMode}
            >
              {recipients
                .filter((recipient) => !groupMode || !groupIds.includes(words(recipient.id)))
                .map((recipient) => (
                  <SelectOption
                    id={words(recipient.id)}
                    key={words(recipient.id)}
                    textValue={words(recipient.name)}
                  >
                    {words(recipient.name)} · {roles(recipient.roles).map(roleLabelOf).join(", ")}
                  </SelectOption>
                ))}
            </ComboBox>
            {groupMode && groupIds.length > 0 && (
              <ul className="cm-group-people" aria-label="People in the group">
                {groupIds.map((id) => {
                  const person = recipients.find((recipient) => words(recipient.id) === id);
                  return (
                    <li key={id}>
                      <span>{words(person?.name, id)}</span>
                      <IconButton icon="x" size="sm" label={`Remove ${words(person?.name, id)}`} onPress={() => setGroupIds((current) => current.filter((value) => value !== id))} />
                    </li>
                  );
                })}
              </ul>
            )}
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
            isDisabled={!canSendNew}
          >
            {groupMode ? "Start group" : "Send"}
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
                <RoleBadge>{roles(member.roles).map(roleLabelOf).join(" · ")}</RoleBadge>
              </Stack>
            </Row>
          ))}
          {conversation.canAddMembers === true && (
            <div>
              <Button variant="secondary" size="sm" icon="plus" onPress={() => { setNewPeople([]); setAddingPeople(true); }}>
                Add people
              </Button>
            </div>
          )}
          <MuteSwitch conversationId={words(conversation.id)} muted={conversation.muted === true} />
        </Stack>
      </Drawer>
      {/* People join an existing group (QA 17 November, V3: there was no way to add anyone after it started). */}
      <Modal title="Add people" isOpen={addingPeople} onOpenChange={setAddingPeople}>
        <ModalBody>
          <Stack gap={16}>
            <ComboBox
              key={`more-${newPeople.length}`}
              label="Add people"
              placeholder="Search people"
              description="They see the conversation from the start."
              defaultFilter={matchesPerson}
              onSelectionChange={(key) => { const id = String(key ?? ""); if (id) setNewPeople((current) => (current.includes(id) ? current : [...current, id])); }}
              emptyMessage="No one else to add"
            >
              {recipients
                .filter((recipient) => !newPeople.includes(words(recipient.id)) && !members.some((member) => words(member.id) === words(recipient.id)))
                .map((recipient) => (
                  <SelectOption id={words(recipient.id)} key={words(recipient.id)} textValue={words(recipient.name)}>
                    {words(recipient.name)} · {roles(recipient.roles).map(roleLabelOf).join(", ")}
                  </SelectOption>
                ))}
            </ComboBox>
            {newPeople.length > 0 && (
              <ul className="cm-group-people" aria-label="People to add">
                {newPeople.map((id) => {
                  const person = recipients.find((recipient) => words(recipient.id) === id);
                  return (
                    <li key={id}>
                      <span>{words(person?.name, id)}</span>
                      <IconButton icon="x" size="sm" label={`Remove ${words(person?.name, id)}`} onPress={() => setNewPeople((current) => current.filter((value) => value !== id))} />
                    </li>
                  );
                })}
              </ul>
            )}
            <ActionError error={action.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setAddingPeople(false)}>Cancel</Button>
          <Button
            loading={action.isPending}
            isDisabled={!newPeople.length}
            onPress={() => action.mutate({ action: "addGroupMembers", recordId: words(conversation.id), payload: { memberIds: newPeople } }, { onSuccess: () => setAddingPeople(false) })}
          >
            Add
          </Button>
        </ModalActions>
      </Modal>
      <Modal title="Edit message" isOpen={Boolean(editedMessage)} onOpenChange={(open) => { if (!open) setEditedMessage(undefined); }}>
        <ModalBody>
          <Stack gap={16}>
            <TextArea label="Message" value={editText} onChange={setEditText} maxLength={4000} isRequired />
            <p className="cm-hint">Everyone in the conversation sees that it was edited.</p>
            <ActionError error={action.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setEditedMessage(undefined)}>Cancel</Button>
          <Button onPress={() => void changeMessage("editMessage")} loading={action.isPending} isDisabled={!editText.trim() || editText.trim() === words(editedMessage?.body)}>Save</Button>
        </ModalActions>
      </Modal>
      <Modal title="Delete this message?" isOpen={Boolean(deletedMessage)} onOpenChange={(open) => { if (!open) setDeletedMessage(undefined); }}>
        <ModalBody>
          <Stack gap={16}>
            <p>It is removed for everyone in the conversation, with its files. The conversation shows "Message deleted" in its place. This can't be undone.</p>
            <ActionError error={action.error} />
          </Stack>
        </ModalBody>
        <ModalActions>
          <Button variant="secondary" onPress={() => setDeletedMessage(undefined)}>Cancel</Button>
          <Button variant="destructive" onPress={() => void changeMessage("deleteMessage")} loading={action.isPending}>Delete</Button>
        </ModalActions>
      </Modal>
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

/** A notice that has no page of its own to open (it pointed at Notifications itself), so opening it shows its message. */
export const noticeHasPage = (pageId: string) => Boolean(pageId) && pageId !== "P40";

/** The message a notice shows when opened. Older notices only said "Open this update"; say what they were about. */
export function noticeMessage(notice: Item) {
  const body = words(notice.body);
  if (body && !body.startsWith("Open this update")) return body;
  if (words(notice.kind) === "moderation")
    return "A reviewer made a decision on something you posted. If it was kept, it shows as before; if it was removed, it no longer shows. Ask the CCS office if you have questions.";
  return "There is nothing more to open for this update.";
}

/**
 * Shows a notice that has no page to open (QA 19 November: "Content review update" did nothing when clicked, because it
 * pointed at the Notifications page itself).
 */
export function NoticeDialog({ notice, onClose }: { notice?: Item; onClose: () => void }) {
  return (
    <Modal title={words(notice?.title, "Update")} isOpen={Boolean(notice)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalBody>
        <p className="cm-notice-body">{notice ? noticeMessage(notice) : ""}</p>
        {notice?.at ? <p className="cm-hint">{new Date(words(notice.at)).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p> : null}
      </ModalBody>
      <ModalActions>
        <Button onPress={onClose}>Close</Button>
      </ModalActions>
    </Modal>
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

  const [shownNotice, setShownNotice] = useState<Item>();
  async function openNotice(notice: Item) {
    setRestrictedSource(false);
    try {
      const result = await action.mutateAsync({
        action: "openNotification",
        recordId: words(notice.id),
        payload: {},
      });
      const source = object(result.record);
      if (!noticeHasPage(words(source.pageId))) return setShownNotice(notice);
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
      <NoticeDialog notice={shownNotice} onClose={() => setShownNotice(undefined)} />
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
  const askBox = useRef<HTMLDivElement>(null);
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
                onClick={() => {
                  setQuestion(prompt);
                  // The cursor goes to the question, so Enter sends it (QA 17 November: Enter pressed the prompt again).
                  requestAnimationFrame(() => askBox.current?.querySelector<HTMLElement>("textarea, [contenteditable=true]")?.focus());
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
          <div ref={askBox}>
          <MessageComposer
            label="Question for the assistant"
            value={question}
            onChange={setQuestion}
            onSend={ask}
            isPending={action.isPending}
            maxLength={2000}
          />
          </div>
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
