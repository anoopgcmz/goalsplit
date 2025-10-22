import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const goals = [
  {
    id: "goal-1",
    name: "Community workspace refresh",
    status: "In progress",
    summary: "Fund the refurbish project with predictable 4% returns for contributors.",
  },
  {
    id: "goal-2",
    name: "Family education fund",
    status: "Planning",
    summary: "Align on a five-year schedule with monthly commitments.",
  },
];

export default function GoalsPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Goals</h1>
        <p className="text-sm text-slate-600">Review every shared objective in one accessible list.</p>
      </header>
      <section aria-label="Active goals" className="grid gap-4">
        {goals.map((goal) => (
          <Card key={goal.id}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{goal.name}</h2>
                <Badge variant="info">{goal.status}</Badge>
              </div>
              <p className="text-sm text-slate-600">{goal.summary}</p>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Everyone stays on the same page with shared notes, predictable returns, and gentle reminders when
              contributions drift.
            </CardContent>
          </Card>
        ))}
      </section>
      <section aria-label="Archived goals">
        <EmptyState
          title="No archived goals"
          description="When you finish a goal, we'll keep it here so you can look back."
        />
      </section>
    </div>
  );
}
