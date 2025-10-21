import GoalPlanPage from "./goal-plan-page";

interface GoalPlanRouteProps {
  params: { id: string };
}

export default function GoalPlanRoute(props: GoalPlanRouteProps): JSX.Element {
  const { params } = props;

  return <GoalPlanPage goalId={params.id} />;
}
