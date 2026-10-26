import { createFileRoute } from "@tanstack/react-router";

import { AdminScreen } from "@/components/app/admin";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/admin/users/$userId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P47"),
  component: () => <AdminScreen pageId="P47" />,
});
