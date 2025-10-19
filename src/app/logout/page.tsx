"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

export default function LogoutPage(): JSX.Element {
  const [toastOpen, setToastOpen] = useState(false);
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  const handleLogout = () => {
    setHasLoggedOut(true);
    setToastOpen(true);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-10">
      <div className="fixed right-4 top-24 z-50">
        <Toast
          open={toastOpen}
          onDismiss={() => setToastOpen(false)}
          title="Signed out"
          description="You logged out successfully."
          variant="success"
        />
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <h1 className="text-2xl font-semibold text-slate-900">Log out</h1>
          <p className="text-sm text-slate-600">Finish your session safely and pick up where you left off anytime.</p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          <p>
            You’re signed in as <span className="font-semibold text-slate-900">alex@goalplanner.com</span>.
          </p>
          <p className="text-slate-600">We’ll clear access on this device once you confirm below.</p>
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={handleLogout}
            disabled={hasLoggedOut}
            className="w-full sm:flex-1"
          >
            {hasLoggedOut ? "Logged out" : "Log out"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:flex-1"
            disabled={hasLoggedOut}
          >
            Stay signed in
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
