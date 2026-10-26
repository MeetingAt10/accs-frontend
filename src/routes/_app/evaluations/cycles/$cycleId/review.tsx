import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute(
  "/_app/evaluations/cycles/$cycleId/review",
)({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P32"),
  component: () => <EvaluationScreen pageId="P32" />,
});
