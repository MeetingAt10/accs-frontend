import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/evaluations/results/")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P28"),
  component: () => <EvaluationScreen pageId="P28" />,
});
