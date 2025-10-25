"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { logout as logoutRequest } from "@/lib/api/auth";
import { useCurrentUser } from "@/lib/hooks/use-current-user";

export default function LogoutPage(): JSX.Element {
  const [hasLoggedOut, setHasLoggedOut] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { publish } = useToast();
  const { user } = useCurrentUser();

  const displayEmail = user?.email ?? "your account";

  const handleLogout = () => {
    if (isSubmitting || hasLoggedOut) {
      return;
    }

    setIsSubmitting(true);

    void logoutRequest()
      .then(() => {
        setHasLoggedOut(true);
        publish({
          title: "Signed out",
          description: "You logged out successfully.",
          variant: "success",
        });
        router.replace("/login");
        router.refresh();
      })
      .catch(() => {
        setIsSubmitting(false);
        publish({
          title: "Logout failed",
          description: "We couldn’t end your session. Please try again.",
          variant: "error",
        });
      });
  };

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Log out</h1>
          <p className="text-sm text-slate-600">Finish your session safely and pick up where you left off anytime.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p>
            You’re signed in as <span className="font-semibold text-slate-900">{displayEmail}</span>.
          </p>
          <p className="text-slate-600">We’ll clear access on this device once you confirm below.</p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={handleLogout}
            disabled={hasLoggedOut || isSubmitting}
            className="w-full sm:flex-1"
          >
            {hasLoggedOut ? "Logged out" : isSubmitting ? "Logging out…" : "Log out"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:flex-1"
            disabled={hasLoggedOut || isSubmitting}
          >
            Stay signed in
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
