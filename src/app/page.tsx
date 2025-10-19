"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";

const goalRows = [
  { id: "1", name: "Shared workspace refresh", status: "On track", owner: "Pat" },
  { id: "2", name: "Education fund", status: "Needs review", owner: "Morgan" },
];

export default function DashboardPage(): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(true);
  const [showErrorToast, setShowErrorToast] = useState(false);

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <p>
          Track your shared commitments, projections, and responsibilities from a single view. Everyone sees the same
          data.
        </p>
      ),
    },
    {
      id: "contributors",
      label: "Contributors",
      content: <p>Invite collaborators and clarify how much each person is contributing toward every goal.</p>,
    },
    {
      id: "automation",
      label: "Automation",
      content: <p>Automate reminders and updates so the group never misses a milestone or planned investment.</p>,
    },
  ];

  return (
    <div className="relative flex flex-col gap-8">
      <div className="fixed right-4 top-24 z-50 flex flex-col gap-3">
        <Toast
          open={showSuccessToast}
          onDismiss={() => setShowSuccessToast(false)}
          duration={0}
          title="Goal synced"
          description="Your shared plan is up to date."
          variant="success"
        />
        <Toast
          open={showErrorToast}
          onDismiss={() => setShowErrorToast(false)}
          title="Contribution missed"
          description="Morgan needs a reminder about next week's deposit."
          variant="error"
        />
      </div>

      <section aria-labelledby="dashboard-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 id="dashboard-heading" className="text-2xl font-semibold text-slate-900">
              Dashboard snapshot
            </h1>
            <p className="text-sm text-slate-600">See the latest activity and keep everyone aligned.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => setShowErrorToast(true)}>
              Trigger warning toast
            </Button>
            <Button type="button" onClick={() => setDialogOpen(true)}>
              New goal
            </Button>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Contribution pace</span>
              <Badge variant="info">+6%</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">$2,450</p>
              <p className="text-sm text-slate-600">Average monthly deposits across all shared goals.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Runway</span>
              <Badge variant="neutral">7 months</Badge>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full" />
              <p className="text-sm text-slate-600">Forecast based on current commitments and fixed returns.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Next milestone</span>
              <Badge variant="success">On schedule</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">June 18</p>
              <p className="text-sm text-slate-600">Workspace refresh payout.</p>
            </CardContent>
            <CardFooter>
              <Button type="button" variant="ghost">
                View timeline
              </Button>
              <Button type="button" variant="secondary">
                Share update
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section aria-labelledby="tabbed-insights" className="space-y-4">
        <div className="space-y-1">
          <h2 id="tabbed-insights" className="text-xl font-semibold text-slate-900">
            Guidance
          </h2>
          <p className="text-sm text-slate-600">Switch tabs to explore planning aides for your team.</p>
        </div>
        <Tabs tabs={tabs} />
      </section>

      <section aria-labelledby="recent-goals" className="space-y-4">
        <div className="space-y-1">
          <h2 id="recent-goals" className="text-xl font-semibold text-slate-900">
            Recent goals
          </h2>
          <p className="text-sm text-slate-600">A quick view of the plans your contributors touch most.</p>
        </div>
        <Card className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Owner</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {goalRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-slate-900">{row.name}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section aria-labelledby="quick-action" className="grid gap-6 lg:grid-cols-[1fr_minmax(0,320px)]">
        <Card>
          <CardHeader>
            <h2 id="quick-action" className="text-xl font-semibold text-slate-900">
              Quick planner inputs
            </h2>
            <p className="text-sm text-slate-600">Capture a fast update without leaving this view.</p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Goal name</Label>
              <Input id="goal-name" name="goal-name" placeholder="Community workspace refresh" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-owner">Owner</Label>
              <Input id="goal-owner" name="goal-owner" placeholder="Pat" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-amount">Target amount</Label>
              <Input id="goal-amount" name="goal-amount" type="number" inputMode="decimal" placeholder="5000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-frequency">Contribution frequency</Label>
              <Select id="goal-frequency" name="goal-frequency" defaultValue="monthly">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
              </Select>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
            <Button type="button">Save draft</Button>
          </CardFooter>
        </Card>
        <EmptyState
          title="Nothing archived yet"
          description="When you archive a goal, it will land here for future reference."
          actionLabel="View goal library"
        />
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Create a new goal"
        description="Define how much to invest, who is accountable, and when the plan should complete."
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setDialogOpen(false)}>
              Continue
            </Button>
          </>
        }
      >
        <p>Use this dialog to gather the basics. You can add detailed projections after saving the goal.</p>
      </Dialog>
    </div>
  );
}
