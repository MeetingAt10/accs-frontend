import { createFileRoute } from "@tanstack/react-router";

import { OversightScreen } from "@/components/app/records";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/analytics")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P25"),
  component: () => <OversightScreen pageId="P25" />,
});
