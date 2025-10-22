"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CODE_LENGTH = 6;
const EMAIL_PATTERN = /^(?:[a-zA-Z0-9_'^&/+-])+(?:\.(?:[a-zA-Z0-9_'^&/+-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

type StatusType = "idle" | "loading" | "success" | "error" | "rate-limit";

interface StatusState {
  type: StatusType;
  message: string;
}

export default function LoginPage(): JSX.Element {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [status, setStatus] = useState<StatusState>({ type: "idle", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [resendAttempts, setResendAttempts] = useState(0);

  const isRateLimited = status.type === "rate-limit";

  useEffect(() => {
    if (step !== "code" || resendCooldown <= 0 || isRateLimited) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [step, resendCooldown, isRateLimited]);

  useEffect(() => {
    if (step === "code") {
      setCode("");
      setCodeError("");
      setResendCooldown(30);
      setResendAttempts(0);
    } else {
      setStatus({ type: "idle", message: "" });
    }
  }, [step]);

  const helperTextId = useMemo(() => "email-helper", []);
  const statusMessageId = useMemo(() => "login-status", []);
  const codeHelperId = useMemo(() => "code-helper", []);
  const errorRegionId = useMemo(() => "form-errors", []);

  const handleSendCode = () => {
    setEmailError("");
    setStatus({ type: "idle", message: "" });

    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      setStatus({ type: "error", message: "Enter a valid email address." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "loading", message: "Sending your code…" });

    window.setTimeout(() => {
      setIsLoading(false);
      setStatus({ type: "success", message: "Check your inbox for a 6-digit code." });
      setStep("code");
    }, 1200);
  };

  const handleVerifyCode = () => {
    setCodeError("");
    setStatus({ type: "idle", message: "" });

    if (code.length < CODE_LENGTH) {
      setCodeError("Enter the 6-digit code from your email.");
      setStatus({ type: "error", message: "Enter the 6-digit code from your email." });
      return;
    }

    setIsLoading(true);
    setStatus({ type: "loading", message: "Checking your code…" });

    window.setTimeout(() => {
      setIsLoading(false);
      setStatus({
        type: "success",
        message: "You’re all set. We’ll finish signing you in now.",
      });
    }, 1200);
  };

  const handleResend = () => {
    if (isRateLimited || resendCooldown > 0) {
      return;
    }

    setIsLoading(true);
    setStatus({ type: "loading", message: "Sending a new code…" });

    window.setTimeout(() => {
      const nextAttempt = resendAttempts + 1;

      if (nextAttempt >= 3) {
        setStatus({
          type: "rate-limit",
          message: "Too many attempts. Try again in a few minutes.",
        });
        setResendCooldown(0);
      } else {
        setStatus({ type: "success", message: "We sent a fresh code. Check your inbox." });
        setResendCooldown(30);
      }

      setResendAttempts(nextAttempt);
      setIsLoading(false);
    }, 1000);
  };

  const statusTone =
    status.type === "success"
      ? "text-emerald-600"
      : status.type === "error" || status.type === "rate-limit"
      ? "text-rose-600"
      : "text-slate-600";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 items-center justify-center px-4 py-10">
      <div className="w-full space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Access your shared goals</h1>
          <p className="text-sm text-slate-600">
            {step === "email"
              ? "Enter the email address you use with Goal Planner."
              : "Type the 6-digit code we emailed you."}
          </p>
        </div>

        <Card className="mx-auto w-full max-w-lg">
          <CardHeader className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">
              {step === "email" ? "Step 1: Email" : "Step 2: Verification"}
            </h2>
            <p id={helperTextId} className="text-sm text-slate-600">
              We’ll email you a 6-digit code. No password.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "email" ? (
              <form
                className="space-y-3"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSendCode();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email address</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-describedby={`${helperTextId} ${statusMessageId} ${errorRegionId}`}
                    aria-invalid={emailError ? "true" : undefined}
                    required
                  />
                </div>
                <div
                  id={errorRegionId}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-h-[1.25rem] text-sm text-rose-600"
                >
                  {emailError || null}
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? "Sending…" : "Send code"}
                </Button>
              </form>
            ) : (
              <form
                className="space-y-3"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  handleVerifyCode();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification code</Label>
                  <Input
                    id="verification-code"
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={CODE_LENGTH}
                    value={code}
                    onChange={(event) => {
                      const digitsOnly = event.target.value.replace(/\D/g, "");
                      setCode(digitsOnly.slice(0, CODE_LENGTH));
                    }}
                    aria-describedby={`${codeHelperId} ${statusMessageId}`.trim()}
                    aria-invalid={codeError ? "true" : undefined}
                    placeholder="••••••"
                    className="tracking-[0.4em] text-center"
                    required
                  />
                  <p id={codeHelperId} className="text-sm text-slate-600">
                    Enter all {CODE_LENGTH} digits. We’ll verify instantly.
                  </p>
                </div>
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-h-[1.25rem] text-sm text-rose-600"
                >
                  {codeError || null}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={isLoading} className="w-full sm:flex-1">
                    {isLoading ? "Verifying…" : "Verify"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full sm:flex-1"
                    onClick={handleResend}
                    disabled={isLoading || resendCooldown > 0 || isRateLimited}
                  >
                    {resendCooldown > 0 && !isRateLimited
                      ? `Resend code (${resendCooldown}s)`
                      : "Resend code"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex-col items-start gap-2 text-sm text-slate-600">
            <div
              id={statusMessageId}
              aria-live={status.type === "error" || status.type === "rate-limit" ? "assertive" : "polite"}
              className={statusTone}
            >
              {status.message || (step === "email" ? "We never share your email." : "Need help? Resend the code above.")}
            </div>
            {step === "code" ? (
              <p className="text-xs text-slate-500">Didn’t get it? Check spam and make sure notifications are on.</p>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
