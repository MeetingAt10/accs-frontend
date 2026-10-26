import { createFileRoute } from "@tanstack/react-router";

import { OversightScreen } from "@/components/app/records";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/records/$studentId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P34"),
  component: () => <OversightScreen pageId="P34" />,
});
