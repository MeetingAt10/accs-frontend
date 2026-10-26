import { createFileRoute } from "@tanstack/react-router";

import { AdminScreen } from "@/components/app/admin";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/admin/monitoring")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P52"),
  component: () => <AdminScreen pageId="P52" />,
});
