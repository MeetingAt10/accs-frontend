import { createFileRoute } from "@tanstack/react-router";

import { CommunicationScreen } from "@/components/app/communications";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/settings/notifications")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P44"),
  component: () => <CommunicationScreen pageId="P44" />,
});
