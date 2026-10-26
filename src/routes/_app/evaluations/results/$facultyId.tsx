import { createFileRoute } from "@tanstack/react-router";

import { EvaluationScreen } from "@/components/app/evaluations";
import { RoutePermission } from "@/components/app/guards";

export const Route = createFileRoute("/_app/evaluations/results/$facultyId")({
  beforeLoad: ({ context }) => RoutePermission(context.queryClient, "P29"),
  component: () => <EvaluationScreen pageId="P29" />,
});
