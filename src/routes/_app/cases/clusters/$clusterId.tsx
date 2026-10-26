import { createFileRoute } from "@tanstack/react-router";

import { OversightScreen } from "@/components/app/records";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/cases/clusters/$clusterId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P24"),
  component: () => <OversightScreen pageId="P24" />,
});
