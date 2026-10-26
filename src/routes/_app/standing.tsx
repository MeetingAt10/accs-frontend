import { createFileRoute } from "@tanstack/react-router";

import { OversightScreen } from "@/components/app/records";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/standing")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P36"),
  component: () => <OversightScreen pageId="P36" />,
});
