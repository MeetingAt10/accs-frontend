import {
  Accordion,
  Alert,
  Breadcrumbs,
  Button,
  Disclosure,
  Grid,
  Link,
  PrivacyNotice,
  Radio,
  RadioGroup,
  RoleBadge,
  Row,
  SectionHeader,
  Select,
  SelectOption,
  Stack,
  TextArea,
  TextField,
  ViewState,
  toast,
} from "@meetingat10/design-system/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { ProfileHeader, PersonCard, FilterBar } from "@/components/ds-next";
import { StandingBadge } from "@/components/app/records";
import {
  ApiError,
  performPageAction,
  signOut,
  type PageAction,
  type PageEnvelope,
} from "@/lib/api";
import { pageQuery, sessionQuery } from "@/lib/queries";

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

function Heading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return <SectionHeader level={1} title={title} description={description} />;
}

export function DirectoryPage({ page }: { page: PageEnvelope }) {
  const people = items(page.data.people);
  const [search, setSearch] = useState("");
  const [office, setOffice] = useState("All");
  const [program, setProgram] = useState("All");
  const [role, setRole] = useState("All");
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
    <Stack gap={20}>
      <Heading
        title="Directory"
        description="CCS, Guidance, and OSAS personnel."
      />
      <FilterBar
        query={search}
        onQueryChange={setSearch}
        searchLabel="Search personnel"
        searchPlaceholder="Name or office"
      >
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
        <Select
          label="Role"
          selectedKey={role}
          onSelectionChange={(key) => setRole(String(key))}
        >
          <SelectOption id="All">All roles</SelectOption>
          {[
            "professor",
            "chair",
            "dean",
            "staff",
            "guidance",
            "osas",
            "administrator",
            "president",
          ].map((value) => (
            <SelectOption key={value} id={value}>
              {value}
            </SelectOption>
          ))}
        </Select>
      </FilterBar>
      {visible.length ? (
        <Grid columns={3}>
          {visible.map((person) => (
            <PersonCard
              key={word(person.id)}
              name={word(person.name)}
              role={strings(person.roles).map((entry) => (
                <RoleBadge key={entry}>{entry}</RoleBadge>
              ))}
              office={word(person.office, word(person.program))}
              description={word(person.title)}
              meta={
                <Link href={`mailto:${word(person.email)}`}>
                  {word(person.email)}
                </Link>
              }
              href={"/people/" + encodeURIComponent(word(person.id))}
            />
          ))}
        </Grid>
      ) : (
        <ViewState
          kind="empty"
          title="No one matches"
          description="Try another name, role, office, or program."
        />
      )}
    </Stack>
  );
}

function Facts({ person }: { person: Item }) {
  const roles = strings(person.roles);
  return (
    <dl className="ds-record__facts">
      <div>
        <dt>Roles</dt>
        <dd>
          {roles.map((role) => (
            <RoleBadge key={role}>{role}</RoleBadge>
          ))}
        </dd>
      </div>
      {Boolean(person.office) && (
        <div>
          <dt>Office</dt>
          <dd>{word(person.office)}</dd>
        </div>
      )}
      {Boolean(person.program) && (
        <div>
          <dt>Program</dt>
          <dd>{word(person.program)}</dd>
        </div>
      )}
      {Boolean(person.bio) && (
        <div>
          <dt>About</dt>
          <dd>{word(person.bio)}</dd>
        </div>
      )}
      {Boolean(person.education) && (
        <div>
          <dt>Education</dt>
          <dd>{word(person.education)}</dd>
        </div>
      )}
    </dl>
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
  const roleBadges = (
    <Row gap={8}>
      {strings(person.roles).map((role) => (
        <RoleBadge key={role}>{role}</RoleBadge>
      ))}
    </Row>
  );
  return (
    <Stack gap={20}>
      <Breadcrumbs
        items={[
          { label: "Directory", href: "/directory" },
          { label: word(person.name) },
        ]}
      />
      <ProfileHeader
        name={word(person.name)}
        role={roleBadges}
        title={word(person.title)}
        office={word(person.office, word(person.program))}
        email={word(person.email)}
      />
      <section>
        <SectionHeader level={2} title="About" />
        <Facts person={person} />
      </section>
      {isStudent && (
        <Row gap={8}>
          <StandingBadge standing={person.standing} />
          <span>
            {person.standing === "Good standing"
              ? "All features are available."
              : "Some features are paused."}
          </span>
        </Row>
      )}
      <Row gap={8}>
        {messageAllowed && (
          <Button href={"/messages?recipient=" + encodeURIComponent(id)}>
            Message
          </Button>
        )}
        {viewerRoles.includes("student") && isFaculty && (
          <Button
            variant="secondary"
            href={"/consultations/faculty/" + encodeURIComponent(id)}
          >
            See open consultation times
          </Button>
        )}
      </Row>
      <PrivacyNotice title="Profile information is limited">
        Personal phone numbers, social links, private media, and offense details
        are not shown here.
      </PrivacyNotice>
    </Stack>
  );
}

export function MyProfilePage({ page }: { page: PageEnvelope }) {
  const record = object(page.data.record);
  const action = useAction("P39");
  const [title, setTitle] = useState(word(record.title));
  const [about, setAbout] = useState(word(record.bio));
  const [education, setEducation] = useState(word(record.education));
  const [officeHours, setOfficeHours] = useState(word(record.officeHours));
  const preview: Item = { ...record, title, bio: about, education };
  const roles = strings(record.roles);
  return (
    <Stack gap={20}>
      <Heading title="My profile" description="What others see." />
      <ProfileHeader
        name={word(preview.name)}
        role={
          <Row gap={8}>
            {roles.map((role) => (
              <RoleBadge key={role}>{role}</RoleBadge>
            ))}
          </Row>
        }
        title={title}
        office={word(record.office, word(record.program))}
        email={word(record.email)}
      />
      <section>
        <SectionHeader level={2} title="From QCU records" />
        <dl className="ds-record__facts">
          <div>
            <dt>Name</dt>
            <dd>{word(record.name)}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{word(record.email)}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{roles.join(", ")}</dd>
          </div>
          <div>
            <dt>Program or office</dt>
            <dd>{word(record.program, word(record.office))}</dd>
          </div>
        </dl>
        <p>Contact the CCS office to correct official account details.</p>
      </section>
      <section>
        <SectionHeader level={2} title="Profile details" />
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
        <TextField
          label="Office hours"
          value={officeHours}
          onChange={setOfficeHours}
          maxLength={200}
        />
        <TextField
          label="Degree and school"
          value={education}
          onChange={setEducation}
          maxLength={500}
          description="Education fields are proposed and remain subject to approval. TBD(D-08)."
        />
        <Alert tone="neutral" title="Keep profile details professional">
          Don't add phone numbers or social links. Profiles show your QCU email
          only. Profile photo upload remains unavailable pending policy
          approval. <span className="tbd-comment">TBD(D-08)</span>
        </Alert>
        {action.error && (
          <Alert tone="danger" title="The profile couldn't be saved">
            {action.error.message}
          </Alert>
        )}
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
      </section>
    </Stack>
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

export function HelpPage({ page }: { page: PageEnvelope }) {
  const faqs = items(page.data.faq);
  const [search, setSearch] = useState("");
  const visible = faqs.filter((faq) =>
    `${word(faq.question)} ${word(faq.answer)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const topics = [...new Set(visible.map(topicFor))];
  return (
    <Stack gap={20}>
      <Heading title="Help" />
      <FilterBar
        query={search}
        onQueryChange={setSearch}
        searchLabel="Search help"
        searchPlaceholder="Search questions"
      />
      {topics.length ? (
        <Accordion>
          {topics.map((topic) => (
            <Disclosure key={topic} title={topic}>
              <Stack gap={12}>
                {visible
                  .filter((faq) => topicFor(faq) === topic)
                  .map((faq) => (
                    <Disclosure key={word(faq.id)} title={word(faq.question)}>
                      <p>{word(faq.answer)}</p>
                      <Link href={word(faq.href, "/help")}>Open this page</Link>
                    </Disclosure>
                  ))}
                {topic === "Reports and privacy" && (
                  <PrivacyNotice title="Who can open a report">
                    A report is available to its verified reporter and
                    authorized handlers within the current routing and conflict
                    rules. Anonymous reports remain tied to a verified account.
                  </PrivacyNotice>
                )}
              </Stack>
            </Disclosure>
          ))}
        </Accordion>
      ) : (
        <ViewState
          kind="empty"
          title="No help topics match"
          description="Try another search or ask the assistant."
        />
      )}
      <Row gap={12}>
        <Button href="/assistant" variant="secondary">
          Ask the assistant
        </Button>
        <Link href="/directory?q=CCS">Contact the CCS office</Link>
      </Row>
    </Stack>
  );
}

function applyTheme(theme: string) {
  if (theme === "system")
    document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
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
    <Stack gap={24}>
      <Heading title="Settings" />
      <section>
        <SectionHeader level={2} title="Account" />
        <dl className="ds-record__facts">
          <div>
            <dt>Name</dt>
            <dd>{word(record.name)}</dd>
          </div>
          <div>
            <dt>QCU email</dt>
            <dd>{word(record.email)}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>
              {roleLabels.map((role) => (
                <RoleBadge key={role}>
                  {role}
                  {record.program && ["chair", "student"].includes(role)
                    ? ` · ${word(record.program)}`
                    : ""}
                </RoleBadge>
              ))}
            </dd>
          </div>
          <div>
            <dt>Account status</dt>
            <dd>Active</dd>
          </div>
        </dl>
      </section>
      <section>
        <SectionHeader level={2} title="Appearance" />
        <RadioGroup
          label="Theme"
          row
          value={theme}
          onChange={(value) => saveAppearance(value, density)}
        >
          <Radio value="light">Light</Radio>
          <Radio value="dark">Dark</Radio>
          <Radio value="system">Match my device</Radio>
        </RadioGroup>
        <RadioGroup
          label="Density"
          row
          value={density}
          onChange={(value) => saveAppearance(theme, value)}
        >
          <Radio value="comfortable">Comfortable</Radio>
          <Radio value="compact">Compact</Radio>
        </RadioGroup>
        {action.error && (
          <Alert tone="danger" title="Settings couldn't be saved">
            {action.error.message}
          </Alert>
        )}
      </section>
      <section>
        <SectionHeader level={2} title="Account links" />
        <Row gap={12}>
          <Link href="/help">How roles are assigned</Link>
          <Button variant="secondary" onPress={() => void signOutAction()}>
            Sign out
          </Button>
        </Row>
        <Button
          variant="secondary"
          isDisabled
          aria-describedby="other-device-note"
        >
          Sign out of other devices
        </Button>
        <p id="other-device-note">
          Session policy is not configured in this prototype.{" "}
          <span className="tbd-comment">TBD(ALL-01-G)</span>
        </p>
      </section>
      <Link href="/settings/notifications">Notification priorities</Link>
    </Stack>
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
        description="Try again."
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
