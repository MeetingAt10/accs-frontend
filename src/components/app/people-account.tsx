import { PagedList } from "@/components/app/paging";
import { PersonAvatar, photoFileProblem, squarePhoto } from '@/components/app/photo'
import { roleLabelOf } from '@/lib/role-labels'
import {
  Alert,
  Button,
  Field,
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
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Input, TextField as AriaTextField } from "react-aria-components";

import { Empty, PageHeader, Panel, StatusChip } from "@/components/app/page-shell";
import { Collapse, SlidePills, ease } from "@/components/app/portal-motion";
import { ProfileHeader, PersonCard } from "@/components/ds-next";
import { StandingBadge } from "@/components/app/records";
import {
  ApiError,
  apiErrorText,
  changePassword,
  performPageAction,
  setProfilePhoto,
  signOut,
  signOutOtherDevices,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageIdForPath, pageTitles } from "@/lib/page-catalog";
import { PageLoading } from "@/components/app/skeleton-page";
import { keepFilteredPage, pageQuery, sessionQuery } from "@/lib/queries";
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

// Each role has its own color, the same on the Directory filters and on every role tag (QA 19 November).
const roleTags = (roles: string[]) =>
  roles.map((role) => (
    <span className="accs-tag pa-role" data-role={role} key={role}>
      {roleLabelOf(role)}
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

/**
 * Which office a person is in, for the Directory filter: by role first, then by the office name. OSAS staff have the
 * office written out ("Office of Student Affairs and Services"), so matching the word "OSAS" missed them (QA 17 November).
 */
function officeOf(person: Record<string, unknown>) {
  const roles = strings(person.roles)
  const office = word(person.office).toLowerCase()
  if (roles.includes("osas") || /osas|student affairs/.test(office)) return "OSAS"
  if (roles.includes("guidance") || office.includes("guidance")) return "Guidance"
  return "CCS"
}

export function DirectoryPage({ page }: { page: PageEnvelope }) {
  const reduce = useReducedMotion();
  const people = items(page.data.people);
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("All");
  const [program, setProgram] = useState("All");
  const [role, setRole] = useState("All");
  const roleOptions = [...new Set(people.flatMap((person) => strings(person.roles)))];
  const officeHasPrograms = office === "All" || office === "CCS";
  const visible = people.filter((person) => {
    const text =
      `${word(person.name)} ${word(person.title)} ${word(person.office)} ${word(person.program)} ${word(person.email)} ${strings(person.roles).join(" ")}`.toLowerCase();
    return (
      (!search || text.includes(search.toLowerCase())) &&
      (office === "All" || officeOf(person) === office) &&
      (program === "All" || officeOf(person) !== "CCS" ||
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
            onSelectionChange={(key) => {
              setOffice(String(key));
              if (key === "Guidance" || key === "OSAS") setProgram("All");
            }}
          >
            <SelectOption id="All">All offices</SelectOption>
            <SelectOption id="CCS">CCS</SelectOption>
            <SelectOption id="Guidance">Guidance</SelectOption>
            <SelectOption id="OSAS">OSAS</SelectOption>
          </Select>
          {/* Guidance and OSAS are not in a program, so the program filter does not apply to them. */}
          <Select
            label="Program"
            selectedKey={officeHasPrograms ? program : "All"}
            isDisabled={!officeHasPrograms}
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
              label: <span className="pa-role pa-role--pill" data-role={value}>{roleLabelOf(value)}</span>,
            })),
          ]}
        />
      </div>
      {visible.length ? (
        <PagedList items={visible} size={12} noun="people" resetKey={`${search}|${office}|${program}|${role}`}>
          {(shown) => (
        <div className="pa-grid">
          <AnimatePresence mode="popLayout">
            {shown.map((person, index) => (
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
                  photo={word(person.photo)}
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
          )}
        </PagedList>
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
  const router = useRouter();
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
      {/* Back to where the profile was opened from, like the calendar (QA 17 November: only Directory was offered). */}
      <div>
        <Button
          variant="tertiary"
          size="sm"
          icon="arrow-left"
          onPress={() => (window.history.length > 1 ? router.history.back() : router.history.push("/directory"))}
        >
          Back
        </Button>
      </div>
      <ProfileHeader
        photo={word(person.photo)}
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
          {Boolean(person.officeHours) && !isStudent && (
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

/** My profile: choose, preview and save a photo, or remove it. The image is squared and shrunk in the browser first. */
function ProfilePhotoPanel({ name, photo }: { name: string; photo: string }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const [problem, setProblem] = useState("");
  const save = useMutation({
    mutationFn: (value: string | null) => setProfilePhoto(value),
    onSuccess: async (result) => {
      setPreview("");
      await client.invalidateQueries({ queryKey: ["page"] });
      toast(result.message, { tone: "success" });
    },
  });
  const choose = async (file?: File) => {
    save.reset();
    setProblem("");
    if (!file) return;
    const wrong = photoFileProblem(file);
    if (wrong) { setProblem(wrong); return; }
    try { setPreview(await squarePhoto(file)); } catch (error) { setProblem(error instanceof Error ? error.message : "This image could not be read."); }
  };
  const shown = preview || photo;
  return (
    <Panel title="Profile photo">
      <div className="pp-panel">
        <PersonAvatar name={name} photo={shown} size={72} />
        <div className="accs-stack accs-stack--tight">
          <p className="pp-panel__hint">
            {preview ? "This is how your photo will look. Save it to show it to others." : "A square photo of you. JPEG, PNG or WebP; it is cropped to a square and made small."}
          </p>
          <div className="pp-panel__actions">
            <input ref={input} className="pp-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ""; }} />
            {preview ? (
              <>
                <Button loading={save.isPending} onPress={() => save.mutate(preview)}>Save photo</Button>
                <Button variant="secondary" onPress={() => setPreview("")} isDisabled={save.isPending}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" icon="upload" onPress={() => input.current?.click()}>{photo ? "Change photo" : "Add a photo"}</Button>
                {photo && <Button variant="tertiary" loading={save.isPending} onPress={() => save.mutate(null)}>Remove</Button>}
              </>
            )}
          </div>
          {(problem || save.error) && <Alert tone="danger" title="The photo was not saved">{problem || apiErrorText(save.error)}</Alert>}
        </div>
      </div>
    </Panel>
  );
}

export function MyProfilePage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const action = useAction("P39");
  const [title, setTitle] = useState(word(record.title));
  const [about, setAbout] = useState(word(record.bio));
  const [education, setEducation] = useState(word(record.education));
  const [officeHours, setOfficeHours] = useState(word(record.officeHours));
  // Students hold no office hours (QA 17 November, V3).
  const student = strings(record.roles).includes("student");
  // Save once something changed, and never an all-blank profile (QA 17 November).
  const changed = title !== word(record.title) || about !== word(record.bio) || education !== word(record.education) || officeHours !== word(record.officeHours);
  const blank = ![title, about, education, officeHours].some((value) => value.trim());
  // About and Office hours cannot be emptied once set (QA v5, E6).
  const aboutMissing = Boolean(word(record.bio)) && !about.trim();
  const hoursMissing = !student && Boolean(word(record.officeHours)) && !officeHours.trim();
  const roles = strings(record.roles);
  return (
    <div className="accs-stack">
      <PageHeader title="My profile" description="This is the profile other people see." />
      <ProfileHeader
        photo={word(record.photo)}
        name={word(record.name)}
        role={roleTags(roles)}
        title={title}
        office={word(record.office, word(record.program))}
        email={word(record.email)}
      />
      <ProfilePhotoPanel name={word(record.name)} photo={word(record.photo)} />
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
              label={<span className="ds-visually-hidden">About</span>}
              isInvalid={aboutMissing}
              errorMessage="About cannot be left blank."
              value={about}
              onChange={setAbout}
              maxLength={1000}
              showCount
            />
          </Panel>
          {!student && (
            <Panel title="Office hours">
              <TextField
                label={<span className="ds-visually-hidden">Office hours</span>}
                isInvalid={hoursMissing}
                errorMessage="Office hours cannot be left blank."
                value={officeHours}
                onChange={setOfficeHours}
                maxLength={200}
              />
            </Panel>
          )}
          <Panel title="Education">
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
                ["Roles", roles.map(roleLabelOf).join(", ")],
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
        {blank && <span className="pa-muted">Fill in at least one field.</span>}
        <Button
          loading={action.isPending}
          isDisabled={!changed || blank || aboutMissing || hoursMissing}
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
  if (href.includes("consultation")) return "Appointments";
  if (href.includes("report") || href.includes("case"))
    return "Reports and privacy";
  if (href.includes("evaluations")) return "Evaluations";
  if (href.includes("standing")) return "Account standing";
  if (href.includes("message")) return "Messages";
  if (href.includes("feed")) return "Feed and posts";
  return "Getting started";
};

function FaqRow({ faq, canOpen }: { faq: Item; canOpen: boolean }) {
  const anchor = faq.id ? `faq-${word(faq.id).replace(/^FAQ-/i, "")}` : undefined;
  // Deep link (/help#faq-8): open and scroll to this entry on arrival.
  const linked = !!anchor && typeof window !== "undefined" && window.location.hash === `#${anchor}`;
  const [open, setOpen] = useState(linked);
  const rowRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (linked) rowRef.current?.scrollIntoView({ block: "center" });
  }, [linked]);
  const panelId = useId();
  return (
    <li id={anchor} ref={rowRef} className="pa-faq" data-open={open || undefined}>
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
  // Matches the question only (QA 17 November: "report" or "can" also listed questions whose answers mention them).
  const visible = faqs.filter((faq) => word(faq.question).toLowerCase().includes(search.trim().toLowerCase()));
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
        description="Answers on reports, appointments, evaluations, and your account."
        actions={
          <Button href="/assistant" variant="secondary">
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
  // Show or hide all three passwords (testing sheet: there was no way to see what was typed).
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
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
        />
        <PasswordField
          label="New password"
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
        <PasswordField
          label="Confirm new password"
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
  // The top-bar theme switch saves too: follow the saved values, so a later change here does not restore an old theme.
  const savedTheme = word(settings.theme, "system");
  const savedDensity = word(settings.density, "comfortable");
  useEffect(() => { setTheme(savedTheme); setDensity(savedDensity); }, [savedTheme, savedDensity]);
  // Only a successful sign-out clears the cache and leaves the page - a failed request must
  // keep the person right where they are, with the server session (and the cache) intact.
  const signOutAction = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      client.removeQueries();
      router.history.push("/sign-in");
    },
  });
  // Ends the account's other sessions; this one stays signed in.
  const othersAction = useMutation({
    mutationFn: signOutOtherDevices,
    onSuccess: (result) => toast(result.message, { tone: "success" }),
  });
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
                      <span className="accs-tag pa-role" data-role={role} key={role}>
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
                loading={signOutAction.isPending}
                onPress={() => signOutAction.mutate()}
              >
                Sign out
              </Button>
              <Button
                variant="secondary"
                loading={othersAction.isPending}
                onPress={() => othersAction.mutate()}
                aria-describedby="other-device-note"
              >
                Sign out of other devices
              </Button>
              <p id="other-device-note" className="pa-muted">
                Signs you out everywhere else, for example on a shared computer. You stay signed in here.
              </p>
              {othersAction.isError && (
                <Alert tone="danger" title="Your other devices were not signed out">
                  {apiErrorText(othersAction.error)}
                </Alert>
              )}
              {signOutAction.isError && (
                <Alert
                  tone="danger"
                  title="Sign out failed."
                  actions={
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => signOutAction.mutate()}
                    >
                      Try again
                    </Button>
                  }
                >
                  {apiErrorText(signOutAction.error)} You&apos;re still signed in on this device.
                </Alert>
              )}
            </div>
          </Panel>
          <Panel title="Shortcuts">
            <div className="pa-links">
              <Link href="/settings/notifications">Notification priorities</Link>
              <Link href="/help#faq-8">How roles are assigned</Link>
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
  const record = pageId === "P38" ? recordId : undefined;
  const page = useQuery({
    ...pageQuery(pageId, record, filters),
    placeholderData: (previous, previousQuery) => keepFilteredPage(previousQuery?.queryKey, pageId, record) ? previous : undefined,
  });
  if (page.isPending) return <PageLoading title={pageTitles[pageId] || "page"} />;
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

/**
 * A password with an eye button inside the field that shows or hides it, as on sign-in (QA 17 November, V3: Profile had a
 * "Show passwords" box instead).
 */
function PasswordField({
  label,
  description,
  errorMessage,
  isInvalid,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  errorMessage?: string;
  isInvalid?: boolean;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [shown, setShown] = useState(false);
  return (
    <AriaTextField className="ds-field" type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={onChange} isInvalid={isInvalid}>
      <Field label={label} description={description} errorMessage={errorMessage}>
        <div className="ds-input-group pa-pwfield">
          <Input className="ds-input" />
          <button
            type="button"
            className="ds-input-group__action pa-eye"
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            onClick={() => setShown((current) => !current)}
          >
            <Icon name={shown ? "eye-slash" : "eye"} size={20} />
          </button>
        </div>
      </Field>
    </AriaTextField>
  );
}
