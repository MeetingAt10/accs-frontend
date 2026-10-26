import { Outlet, createFileRoute } from "@tanstack/react-router";

import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P45"),
  component: () => <Outlet />,
});
