import { createFileRoute } from "@tanstack/react-router";

import { OversightScreen } from "@/components/app/records";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/cases/clusters/")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P23"),
  component: () => <OversightScreen pageId="P23" />,
});
