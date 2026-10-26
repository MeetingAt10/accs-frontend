import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/evaluations/forms/$assignmentId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P27"),
  component: () => <EvaluationScreen pageId="P27" />,
});
