import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/messages")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P11"),
  component: Outlet,
});
