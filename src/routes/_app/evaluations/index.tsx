import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/evaluations/")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P26"),
  component: () => <EvaluationScreen pageId="P26" />,
});
