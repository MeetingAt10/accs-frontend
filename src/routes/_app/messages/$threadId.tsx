import { createFileRoute } from "@tanstack/react-router";

import { CommunicationScreen } from "@/components/app/communications";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/messages/$threadId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P12"),
  component: () => <CommunicationScreen pageId="P12" />,
});
