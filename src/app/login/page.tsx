"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestOtp, verifyOtp } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/request";

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

  const isRateLimited = status.type === "rate-limit";
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const requestAbortRef = useRef<AbortController | null>(null);
  const verifyAbortRef = useRef<AbortController | null>(null);

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
    } else {
      setStatus({ type: "idle", message: "" });
    }
  }, [step]);

  const helperTextId = useMemo(() => "email-helper", []);
  const statusMessageId = useMemo(() => "login-status", []);
  const codeHelperId = useMemo(() => "code-helper", []);
  const errorRegionId = useMemo(() => "form-errors", []);

  const sendOtp = useCallback(
    async (mode: "initial" | "resend" = "initial") => {
      const trimmedEmail = email.trim().toLowerCase();
      setEmailError("");
      setStatus({ type: "idle", message: "" });

      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        const message = "Enter a valid email address.";
        setEmailError(message);
        setStatus({ type: "error", message });
        return;
      }

      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;

      setIsLoading(true);
      setStatus({
        type: "loading",
        message: mode === "resend" ? "Sending a new code…" : "Sending your code…",
      });

      try {
        const response = await requestOtp({ email: trimmedEmail }, controller.signal);
        if (controller.signal.aborted) {
          return;
        }

        setStatus({
          type: "success",
          message:
            mode === "resend"
              ? "We sent a fresh code. Check your inbox."
              : "Check your inbox for a 6-digit code.",
        });
        setStep("code");
        const cooldown = Math.max(30, Math.min(response.expiresInSeconds, 120));
        setResendCooldown(cooldown);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (isApiError(error)) {
          if (error.code === "AUTH_RATE_LIMITED") {
            setStatus({ type: "rate-limit", message: error.message });
            setResendCooldown(0);
            return;
          }

          setStatus({ type: "error", message: error.message });
          setEmailError(error.message);
          return;
        }

        setStatus({
          type: "error",
          message: "We couldn’t send that code. Check your connection and try again.",
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          requestAbortRef.current = null;
        }
      }
    },
    [email],
  );

  const handleSendCode = useCallback(() => {
    void sendOtp("initial");
  }, [sendOtp]);

  const handleVerifyCode = useCallback(async () => {
    setCodeError("");
    setStatus({ type: "idle", message: "" });

    if (code.trim().length < CODE_LENGTH) {
      const message = "Enter the 6-digit code from your email.";
      setCodeError(message);
      setStatus({ type: "error", message });
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    verifyAbortRef.current?.abort();
    const controller = new AbortController();
    verifyAbortRef.current = controller;

    setIsLoading(true);
    setStatus({ type: "loading", message: "Checking your code…" });

    try {
      await verifyOtp({ email: trimmedEmail, code: trimmedCode }, controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      setStatus({
        type: "success",
        message: "You’re all set. We’ll finish signing you in now.",
      });
      void router.push(nextPath);
      void router.refresh();
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      if (isApiError(error)) {
        const message = error.message || "We couldn’t verify that code. Try again.";
        setStatus({ type: "error", message });
        setCodeError(message);
        return;
      }

      setStatus({
        type: "error",
        message: "We couldn’t verify that code. Check your connection and try again.",
      });
      setCodeError("We couldn’t verify that code. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        verifyAbortRef.current = null;
      }
    }
  }, [code, email, nextPath, router]);

  const handleResend = useCallback(() => {
    if (isRateLimited || resendCooldown > 0) {
      return;
    }

    void sendOtp("resend");
  }, [isRateLimited, resendCooldown, sendOtp]);

  useEffect(() => {
    return () => {
      requestAbortRef.current?.abort();
      verifyAbortRef.current?.abort();
    };
  }, []);

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
                  void handleVerifyCode();
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
