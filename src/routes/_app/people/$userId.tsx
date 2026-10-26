import { createFileRoute } from "@tanstack/react-router";

import { PeopleAccountScreen } from "@/components/app/people-account";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/people/$userId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P38"),
  component: () => <PeopleAccountScreen pageId="P38" />,
});
