"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/card-skeleton";

type CheckinStatus = "confirmed" | "skipped" | "pending" | "no_checkin";

interface ProgressMember {
  userId: string;
  name: string | null;
  email: string;
  role: "owner" | "collaborator";
  requiredAmount: number;
  contributedAmount: number;
  checkinStatus: CheckinStatus;
  isOnTrack: boolean;
}

interface ProgressData {
  period: string;
  members: ProgressMember[];
}

interface GroupProgressProps {
  goalId: string;
  currency: string;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusBadge({ member }: { member: ProgressMember }) {
  if (member.isOnTrack) {
    return <Badge variant="success">On track</Badge>;
  }

  if (member.checkinStatus === "no_checkin") {
    return <Badge variant="neutral">No check-in</Badge>;
  }

  if (member.checkinStatus === "pending") {
    return <Badge variant="warning">Pending</Badge>;
  }

  return <Badge variant="danger">Behind</Badge>;
}

export function GroupProgress({ goalId, currency }: GroupProgressProps) {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/goals/${goalId}/progress`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as ProgressData;
        if (!cancelled) setData(json);
      } catch {
        // silently hide on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [goalId]);

  if (loading) {
    return <CardSkeleton headerLines={1} bodyLines={4} />;
  }

  if (!data) {
    return null;
  }

  const onTrackCount = data.members.filter((m) => m.isOnTrack).length;
  const total = data.members.length;
  const progressPercent = total > 0 ? Math.round((onTrackCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-slate-900">This Month&apos;s Progress</h2>
        <p className="text-sm text-slate-500">
          {onTrackCount} of {total} member{total !== 1 ? "s" : ""} on track
        </p>
      </CardHeader>

      <div className="mb-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% of members on track`}
          />
        </div>
      </div>

      <CardContent>
        <ul className="divide-y divide-slate-100">
          {data.members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {member.name ?? member.email}
                </p>
                <p className="text-xs text-slate-500">
                  {formatAmount(member.contributedAmount, currency)}
                  {" / "}
                  {formatAmount(member.requiredAmount, currency)}
                </p>
              </div>
              <div className="ml-4 shrink-0">
                <StatusBadge member={member} />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
