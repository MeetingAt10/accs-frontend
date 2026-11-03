import {
  Alert,
  Button,
  Icon,
  Link,
  PrivacyNotice,
  Search,
  Select,
  SelectOption,
  TextArea,
  TextField,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState, type FormEvent, type ReactNode } from "react";

import { Empty, PageHeader, Panel, StatusChip } from "@/components/app/page-shell";
import { Collapse, SlidePills, ease } from "@/components/app/portal-motion";
import { ProfileHeader, PersonCard } from "@/components/ds-next";
import { StandingBadge } from "@/components/app/records";
import {
  ApiError,
  changePassword,
  performPageAction,
  signOut,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageIdForPath } from "@/lib/page-catalog";
import { pageQuery, sessionQuery } from "@/lib/queries";
import "./people-account.css";

type Item = Record<string, unknown>;

const object = (value: unknown): Item =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Item)
    : {};
const items = (value: unknown): Item[] =>
  Array.isArray(value) ? value.map(object) : [];
const word = (value: unknown, fallback = "") =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function useAction(pageId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: PageAction) => performPageAction(pageId, action),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["page"] });
      toast(result.message, { tone: "success" });
    },
  });
}

const roleTags = (roles: string[]) =>
  roles.map((role) => (
    <span className="accs-tag pa-role" key={role}>
      {role}
    </span>
  ));

function FactRows({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, value]) => value);
  return (
    <dl className="pa-facts">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DirectoryPage({ page }: { page: PageEnvelope }) {
  const reduce = useReducedMotion();
  const people = items(page.data.people);
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("All");
  const [program, setProgram] = useState("All");
  const [role, setRole] = useState("All");
  const roleOptions = [...new Set(people.flatMap((person) => strings(person.roles)))];
  const visible = people.filter((person) => {
    const text =
      `${word(person.name)} ${word(person.title)} ${word(person.office)} ${word(person.program)} ${word(person.email)} ${strings(person.roles).join(" ")}`.toLowerCase();
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (office === "All" ||
        word(person.office).toLowerCase().includes(office.toLowerCase())) &&
      (program === "All" ||
        word(person.program).toLowerCase().includes(program.toLowerCase())) &&
      (role === "All" || strings(person.roles).includes(role))
    );
  });
  return (
    <div className="accs-stack">
      <PageHeader
        title="Directory"
        description={`CCS, Guidance, and OSAS personnel · ${visible.length} ${visible.length === 1 ? "person" : "people"}`}
      />
      <div className="pa-toolbar">
        <div className="pa-toolbar__row">
          <div className="pa-toolbar__search">
            <Search
              label="Search personnel"
              placeholder="Name or office"
              value={search}
              onChange={setSearch}
              size="sm"
            />
          </div>
          <Select
            label="Office"
            selectedKey={office}
            onSelectionChange={(key) => setOffice(String(key))}
          >
            <SelectOption id="All">All offices</SelectOption>
            <SelectOption id="CCS">CCS</SelectOption>
            <SelectOption id="Guidance">Guidance</SelectOption>
            <SelectOption id="OSAS">OSAS</SelectOption>
          </Select>
          <Select
            label="Program"
            selectedKey={program}
            onSelectionChange={(key) => setProgram(String(key))}
          >
            <SelectOption id="All">All programs</SelectOption>
            <SelectOption id="BSIT">IT</SelectOption>
            <SelectOption id="BSCS">CS</SelectOption>
            <SelectOption id="BSIS">IS</SelectOption>
          </Select>
        </div>
        <SlidePills
          label="Filter by role"
          value={role}
          onChange={setRole}
          options={[
            { id: "All", label: "Everyone" },
            ...roleOptions.map((value) => ({
              id: value,
              label: <span className="pa-role">{value}</span>,
            })),
          ]}
        />
      </div>
      {visible.length ? (
        <div className="pa-grid">
          <AnimatePresence mode="popLayout">
            {visible.map((person, index) => (
              <motion.div
                key={word(person.id)}
                layout={reduce ? false : "position"}
                initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                transition={{
                  duration: reduce ? 0 : 0.34,
                  ease,
                  delay: reduce ? 0 : Math.min(index, 10) * 0.03,
                }}
              >
                <PersonCard
                  name={word(person.name)}
                  role={roleTags(strings(person.roles))}
                  office={word(person.office, word(person.program))}
                  description={word(person.title)}
                  meta={
                    <Link href={`mailto:${word(person.email)}`}>
                      {word(person.email)}
                    </Link>
                  }
                  href={"/people/" + encodeURIComponent(word(person.id))}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Panel>
          <Empty title="No matches">
            Change the search or clear a filter.
          </Empty>
        </Panel>
      )}
    </div>
  );
}

export function PersonProfile({ page }: { page: PageEnvelope }) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const person = object(page.data.record);
  const session = useQuery(sessionQuery());
  const id = Object.values(params).at(-1) ?? "";
  const viewerRoles = session.data?.user.roles ?? [];
  const canMessage =
    session.data?.permissions.includes("message.send") === true;
  const recipients = useQuery({ ...pageQuery("P11"), enabled: canMessage });
  const allowedRecipients = items(recipients.data?.data.recipients);
  const messageAllowed = allowedRecipients.some(
    (recipient) => word(recipient.id) === id,
  );
  const isStudent = strings(person.roles).includes("student");
  const isFaculty = strings(person.roles).includes("professor");
  if (!person.id)
    return (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may belong to someone else."
      />
    );
  return (
    <div className="accs-stack">
      <div>
        <Button variant="tertiary" size="sm" icon="arrow-left" href="/directory">
          Directory
        </Button>
      </div>
      <ProfileHeader
        name={word(person.name)}
        role={roleTags(strings(person.roles))}
        title={word(person.title)}
        office={word(person.office, word(person.program))}
        email={word(person.email)}
        actions={
          <>
            {messageAllowed && (
              <Button
                icon="chat"
                href={"/messages?recipient=" + encodeURIComponent(id)}
              >
                Message
              </Button>
            )}
            {viewerRoles.includes("student") && isFaculty && (
              <Button
                variant="secondary"
                icon="calendar"
                href={"/consultations/faculty/" + encodeURIComponent(id)}
              >
                See open consultation times
              </Button>
            )}
          </>
        }
      />
      <div className="accs-split accs-stagger">
        <div className="accs-stack">
          <Panel title="About">
            {word(person.bio) ? (
              <p className="pa-prose">{word(person.bio)}</p>
            ) : (
              <p className="pa-muted">No details shared yet.</p>
            )}
          </Panel>
          {Boolean(person.education) && (
            <Panel title="Education">
              <p className="pa-prose">{word(person.education)}</p>
            </Panel>
          )}
        </div>
        <aside className="accs-stack">
          <Panel title="Details">
            <FactRows
              rows={[
                ["Office", word(person.office)],
                ["Program", word(person.program)],
                ["Email", word(person.email)],
              ]}
            />
          </Panel>
          {Boolean(person.officeHours) && (
            <Panel title="Office hours">
              <p className="pa-prose">{word(person.officeHours)}</p>
            </Panel>
          )}
          {isStudent && (
            <Panel title="Standing">
              <div className="pa-standing">
                <StandingBadge standing={person.standing} />
                <span>
                  {person.standing === "Good standing"
                    ? "All features are available."
                    : "Some features are paused."}
                </span>
              </div>
            </Panel>
          )}
        </aside>
      </div>
      <PrivacyNotice title="What profiles leave out">
        Personal phone numbers, social links, private media, and offense details
        are not shown here.
      </PrivacyNotice>
    </div>
  );
}

export function MyProfilePage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const action = useAction("P39");
  const [title, setTitle] = useState(word(record.title));
  const [about, setAbout] = useState(word(record.bio));
  const [education, setEducation] = useState(word(record.education));
  const [officeHours, setOfficeHours] = useState(word(record.officeHours));
  const roles = strings(record.roles);
  return (
    <div className="accs-stack">
      <PageHeader title="My profile" description="This is the profile other people see." />
      <ProfileHeader
        name={word(record.name)}
        role={roleTags(roles)}
        title={title}
        office={word(record.office, word(record.program))}
        email={word(record.email)}
      />
      <div className="accs-split accs-stagger">
        <div className="accs-stack">
          <Panel title="About">
            <TextField
              label="Title"
              value={title}
              onChange={setTitle}
              maxLength={100}
            />
            <TextArea
              label="About"
              value={about}
              onChange={setAbout}
              maxLength={1000}
              showCount
            />
          </Panel>
          <Panel title="Office hours">
            <TextField
              label="Office hours"
              value={officeHours}
              onChange={setOfficeHours}
              maxLength={200}
            />
          </Panel>
          <Panel title="Education">
            {/* TBD(D-08): education fields are proposed and remain subject to approval. */}
            <TextField
              label="Degree and school"
              value={education}
              onChange={setEducation}
              maxLength={500}
            />
          </Panel>
        </div>
        <aside className="accs-stack">
          <Panel title="From QCU records">
            <FactRows
              rows={[
                ["Name", word(record.name)],
                ["Email", word(record.email)],
                ["Roles", roles.join(", ")],
                ["Program or office", word(record.program, word(record.office))],
              ]}
            />
            <p className="pa-muted">
              Contact the CCS office to correct official account details.
            </p>
          </Panel>
          {/* TBD(D-08): profile photo upload requires policy approval. */}
          <Alert tone="neutral" title="Keep it professional">
            Don't add phone numbers or social links. Others see your QCU email
            only.
          </Alert>
        </aside>
      </div>
      {action.error && (
        <Alert tone="danger" title="The profile couldn't be saved">
          {action.error.message}
        </Alert>
      )}
      <div className="pa-savebar">
        <Button
          loading={action.isPending}
          onPress={() =>
            action.mutate({
              action: "saveProfile",
              payload: { title, bio: about, education, officeHours },
            })
          }
        >
          Save
        </Button>
      </div>
    </div>
  );
}

const topicFor = (faq: Item) => {
  const href = word(faq.href);
  if (href.includes("consultation")) return "Consultations";
  if (href.includes("report") || href.includes("case"))
    return "Reports and privacy";
  if (href.includes("evaluations")) return "Evaluations";
  if (href.includes("standing")) return "Account standing";
  if (href.includes("message")) return "Messages";
  if (href.includes("feed")) return "Feed and posts";
  return "Getting started";
};

function FaqRow({ faq, canOpen }: { faq: Item; canOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="pa-faq" data-open={open || undefined}>
      <button
        type="button"
        className="pa-faq__q"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{word(faq.question)}</span>
        <Icon name="caret-down" size={16} className="pa-faq__caret" />
      </button>
      <Collapse open={open} id={panelId}>
        <div className="pa-faq__a">
          <p>{word(faq.answer)}</p>
          {canOpen && <Link href={word(faq.href, "/help")}>Open page</Link>}
        </div>
      </Collapse>
    </li>
  );
}

export function HelpPage({ page }: { page: PageEnvelope }) {
  const session = useQuery(sessionQuery());
  const faqs = items(page.data.faq);
  const [search, setSearch] = useState("");
  const visible = faqs.filter((faq) =>
    `${word(faq.question)} ${word(faq.answer)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const topics = [...new Set(visible.map(topicFor))];
  // Never offer a link to a page this role cannot open.
  const canOpen = (href: string) => {
    const pageId = pageIdForPath(href.split(/[?#]/)[0]);
    return !pageId || session.data?.allowedPages.includes(pageId) === true;
  };
  return (
    <div className="accs-stack">
      <PageHeader
        title="Help"
        description="Answers on reports, consultations, evaluations, and your account."
        actions={
          <Button href="/assistant" variant="secondary" icon="chats">
            Ask the assistant
          </Button>
        }
      />
      <div className="pa-toolbar">
        <Search
          label="Search help"
          placeholder="Search questions"
          value={search}
          onChange={setSearch}
          size="sm"
        />
      </div>
      {topics.length ? (
        <div className="accs-stack accs-stagger">
          {topics.map((topic) => (
            <Panel flush key={topic} title={topic}>
              <ul className="pa-faqs">
                {visible
                  .filter((faq) => topicFor(faq) === topic)
                  .map((faq) => (
                    <FaqRow
                      key={word(faq.id, word(faq.question))}
                      faq={faq}
                      canOpen={canOpen(word(faq.href, "/help"))}
                    />
                  ))}
              </ul>
              {topic === "Reports and privacy" && (
                <p className="pa-note">
                  Only the verified reporter and the assigned handlers can open
                  a report, subject to routing and conflict rules. An anonymous
                  report is still tied to a verified account.
                </p>
              )}
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            title="No help topics match"
            action={
              <Button href="/assistant" variant="secondary">
                Ask the assistant
              </Button>
            }
          >
            Try another search or ask the assistant.
          </Empty>
        </Panel>
      )}
      <p className="pa-muted">
        Still stuck? <Link href="/directory?q=CCS">Contact the CCS office</Link>.
      </p>
    </div>
  );
}

function applyTheme(theme: string) {
  if (theme === "system")
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

function strengthOf(value: string) {
  return [
    value.length >= 10,
    /[A-Z]/.test(value) && /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
}

const passwordMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Your current password is incorrect.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Try again in 15 minutes.",
};

function ChangePasswordPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (result) => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ ok: true, text: result.message || "Password changed." });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : undefined;
      const field = error instanceof ApiError ? error.fields?.[0]?.message : undefined;
      setMessage({
        ok: false,
        text:
          (code && passwordMessages[code]) ||
          field ||
          (error instanceof Error
            ? error.message
            : "The password couldn't be changed."),
      });
    },
  });
  const score = strengthOf(next);
  const mismatch = Boolean(confirm) && next !== confirm;
  function submit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    if (!current || !next) return setMessage({ ok: false, text: "Enter your current and new password." });
    if (score < 4)
      return setMessage({
        ok: false,
        text: "Use 10 or more characters with upper and lower case, a digit, and a symbol.",
      });
    if (next !== confirm) return setMessage({ ok: false, text: "The new passwords don't match." });
    setMessage(undefined);
    mutation.mutate({ currentPassword: current, password: next });
  }
  return (
    <Panel title="Change password">
      <form className="pa-pw" onSubmit={submit} noValidate>
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          description="10 or more characters with upper and lower case, a digit, and a symbol."
        />
        <div className="pa-meter" aria-hidden data-score={score}>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} data-on={index < score || undefined} />
          ))}
        </div>
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          isInvalid={mismatch}
          errorMessage="The new passwords don't match."
        />
        <AnimatePresence initial={false}>
          {message && (
            <motion.p
              key={message.text}
              className="pa-msg"
              data-ok={message.ok || undefined}
              role={message.ok ? "status" : "alert"}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease }}
            >
              <Icon name={message.ok ? "check-circle" : "warning-circle"} size={16} />
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
        <div>
          <Button type="submit" loading={mutation.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function SettingsPage({ page }: { page: PageEnvelope }) {
  const router = useRouter();
  const client = useQueryClient();
  const record = object(page.data.record);
  const settings = object(page.data.settings);
  const action = useAction("P43");
  const [theme, setTheme] = useState(word(settings.theme, "system"));
  const [density, setDensity] = useState(word(settings.density, "comfortable"));
  const signOutAction = async () => {
    await signOut().catch(() => undefined);
    client.removeQueries();
    router.history.push("/sign-in");
  };
  const saveAppearance = (nextTheme: string, nextDensity: string) => {
    setTheme(nextTheme);
    setDensity(nextDensity);
    applyTheme(nextTheme);
    document
      .querySelector(".ds-shell")
      ?.setAttribute("data-density", nextDensity);
    action.mutate({
      action: "saveSettings",
      payload: { theme: nextTheme, density: nextDensity },
    });
  };
  const roleLabels = strings(record.roles);
  return (
    <div className="accs-stack">
      <PageHeader title="Settings" />
      <div className="accs-split accs-stagger">
        <div className="accs-stack">
          <Panel title="Account">
            <FactRows
              rows={[
                ["Name", word(record.name)],
                ["QCU email", word(record.email)],
                [
                  "Roles",
                  <span className="pa-tags" key="roles">
                    {roleLabels.map((role) => (
                      <span className="accs-tag pa-role" key={role}>
                        {role}
                        {record.program && ["chair", "student"].includes(role)
                          ? ` · ${word(record.program)}`
                          : ""}
                      </span>
                    ))}
                  </span>,
                ],
                ["Account status", <StatusChip tone="ok" key="status">Active</StatusChip>],
              ]}
            />
          </Panel>
          <Panel title="Appearance">
            <div className="pa-setting">
              <div>
                <p className="pa-setting__label">Theme</p>
                <p className="pa-muted">Applies on this device.</p>
              </div>
              <SlidePills
                label="Theme"
                value={theme}
                onChange={(value) => saveAppearance(value, density)}
                options={[
                  { id: "light", label: "Light" },
                  { id: "dark", label: "Dark" },
                  { id: "system", label: "Match my device" },
                ]}
              />
            </div>
            <div className="pa-setting">
              <div>
                <p className="pa-setting__label">Density</p>
                <p className="pa-muted">Spacing of lists and tables.</p>
              </div>
              <SlidePills
                label="Density"
                value={density}
                onChange={(value) => saveAppearance(theme, value)}
                options={[
                  { id: "comfortable", label: "Comfortable" },
                  { id: "compact", label: "Compact" },
                ]}
              />
            </div>
            {action.error && (
              <Alert tone="danger" title="Settings couldn't be saved">
                {action.error.message}
              </Alert>
            )}
          </Panel>
          <ChangePasswordPanel />
        </div>
        <aside className="accs-stack">
          <Panel title="Session">
            <div className="pa-session">
              <Button
                variant="secondary"
                icon="sign-out"
                onPress={() => void signOutAction()}
              >
                Sign out
              </Button>
              <Button
                variant="secondary"
                isDisabled
                aria-describedby="other-device-note"
              >
                Sign out of other devices
              </Button>
              {/* TBD(ALL-01-G): session policy is not configured yet. */}
              <p id="other-device-note" className="pa-muted">
                Signing out of other devices isn't available yet.
              </p>
            </div>
          </Panel>
          <Panel title="Shortcuts">
            <div className="pa-links">
              <Link href="/settings/notifications">Notification priorities</Link>
              <Link href="/help">How roles are assigned</Link>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

export function PeopleAccountScreen({
  pageId,
}: {
  pageId: "P37" | "P38" | "P39" | "P42" | "P43";
}) {
  const params = useParams({ strict: false }) as Record<string, string>;
  const recordId = Object.values(params).at(-1);
  const filters = useRouterState({
    select: (state) => state.location.searchStr.slice(1),
  });
  const page = useQuery(
    pageQuery(pageId, pageId === "P38" ? recordId : undefined, filters),
  );
  if (page.isPending) return <ViewState kind="loading" title="Loading page" />;
  if (page.isError)
    return page.error instanceof ApiError &&
      [403, 404].includes(page.error.status) ? (
      <ViewState
        kind="restricted"
        title="This record isn't available to you"
        description="It may not exist, or it may belong to someone else."
      />
    ) : (
      <ViewState
        kind="error"
        title="This information couldn't be loaded"
        description="Check your connection, then try again."
        actions={
          <Button variant="secondary" onPress={() => void page.refetch()}>
            Try again
          </Button>
        }
      />
    );
  if (pageId === "P37") return <DirectoryPage page={page.data} />;
  if (pageId === "P38") return <PersonProfile page={page.data} />;
  if (pageId === "P39") return <MyProfilePage page={page.data} />;
  if (pageId === "P42") return <HelpPage page={page.data} />;
  return <SettingsPage page={page.data} />;
}
