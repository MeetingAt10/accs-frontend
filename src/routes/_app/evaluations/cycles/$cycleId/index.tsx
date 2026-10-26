import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/evaluations/cycles/$cycleId/")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P31"),
  component: () => <EvaluationScreen pageId="P31" />,
});
