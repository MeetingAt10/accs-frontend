import { createFileRoute } from "@tanstack/react-router";

import { AdminScreen } from "@/components/app/admin";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/admin/users/")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P46"),
  component: () => <AdminScreen pageId="P46" />,
});
