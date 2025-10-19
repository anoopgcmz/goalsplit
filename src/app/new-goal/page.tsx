import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export default function NewGoalPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">New goal</h1>
        <p className="text-sm text-slate-600">
          Start a shared plan by outlining the amount, timeline, and contributors you have in mind.
        </p>
      </header>
      <section aria-labelledby="new-goal-form">
        <Card>
          <CardHeader>
            <h2 id="new-goal-form" className="text-xl font-semibold text-slate-900">
              Goal details
            </h2>
            <p className="text-sm text-slate-600">Fields marked optional can be updated later.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="goal-title">Goal title</Label>
              <Input id="goal-title" name="goal-title" placeholder="Pay off the shared workspace upgrade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target amount</Label>
              <Input id="goal-target" name="goal-target" type="number" inputMode="decimal" placeholder="12000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-return">Expected annual return</Label>
              <Input id="goal-return" name="goal-return" type="number" inputMode="decimal" placeholder="4" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-deadline">Deadline</Label>
              <Input id="goal-deadline" name="goal-deadline" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-frequency">Contribution cadence</Label>
              <Select id="goal-frequency" name="goal-frequency" defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="goal-collaborators">Collaborators (optional)</Label>
              <Input
                id="goal-collaborators"
                name="goal-collaborators"
                placeholder="Add names or emails separated by commas"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="submit">Create goal</Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
