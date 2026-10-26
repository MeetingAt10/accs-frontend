import { createFileRoute } from "@tanstack/react-router";

import { AdminScreen } from "@/components/app/admin";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/admin/moderation/$itemId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P50"),
  component: () => <AdminScreen pageId="P50" />,
});
