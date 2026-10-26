import { createFileRoute } from "@tanstack/react-router";

import { PeopleAccountScreen } from "@/components/app/people-account";

export const Route = createFileRoute("/_app/help")({
  component: () => <PeopleAccountScreen pageId="P42" />,
});
