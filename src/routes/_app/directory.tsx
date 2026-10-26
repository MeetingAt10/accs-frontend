import { createFileRoute } from "@tanstack/react-router";

import { PeopleAccountScreen } from "@/components/app/people-account";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/directory")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P37"),
  component: () => <PeopleAccountScreen pageId="P37" />,
});
