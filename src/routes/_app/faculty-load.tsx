import { createFileRoute } from "@tanstack/react-router";

import { FacultyLoadPage } from "@/components/app/faculty-load";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/faculty-load")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P54"),
  component: FacultyLoadPage,
});
