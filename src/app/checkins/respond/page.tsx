import { headers } from "next/headers";

interface SearchParams {
  token?: string;
  status?: string;
}

interface RespondPageProps {
  searchParams: Promise<SearchParams>;
}

async function callRespondApi(token: string, status: string, origin: string) {
  const url = `${origin}/api/checkins/respond`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, status }),
    cache: "no-store",
  });
  return response;
}

export default async function CheckInRespondPage({ searchParams }: RespondPageProps) {
  const { token, status } = await searchParams;

  if (!token || !status) {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ color: "#dc2626" }}>Invalid Link</h1>
        <p style={{ color: "#555" }}>
          This check-in link is missing required information. Please use the link from your email.
        </p>
      </main>
    );
  }

  if (status !== "confirmed" && status !== "skipped") {
    return (
      <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ color: "#dc2626" }}>Invalid Response</h1>
        <p style={{ color: "#555" }}>
          The response in this link is not recognized. Please use the buttons from your check-in email.
        </p>
      </main>
    );
  }

  let success = false;
  let goalTitle = "";
  let errorCode = "";

  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      `${protocol}://${host}`;

    const response = await callRespondApi(token, status, origin);
    const data: unknown = await response.json();

    if (response.ok && data && typeof data === "object" && "success" in data) {
      const result = data as { success: boolean; goalTitle: string };
      success = result.success;
      goalTitle = result.goalTitle ?? "";
    } else if (data && typeof data === "object" && "error" in data) {
      const errData = data as { error: { code: string } };
      errorCode = errData.error?.code ?? "UNKNOWN";
    }
  } catch {
    errorCode = "CHECKIN_INTERNAL_ERROR";
  }

  if (!success) {
    const isExpired = errorCode === "CHECKIN_TOKEN_EXPIRED";
    const isNotFound = errorCode === "CHECKIN_NOT_FOUND";

    return (
      <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ color: "#dc2626" }}>
          {isExpired ? "Link Expired" : isNotFound ? "Invalid Link" : "Something went wrong"}
        </h1>
        <p style={{ color: "#555" }}>
          {isExpired
            ? "This check-in link has expired. Please wait for next month's check-in email."
            : isNotFound
              ? "This check-in link is not valid. Please use the link from your email."
              : "We could not process your check-in right now. Please try again shortly."}
        </p>
      </main>
    );
  }

  const confirmedMessage =
    status === "confirmed"
      ? `Thanks! We've noted your contribution for "${goalTitle}".`
      : `Got it. We've recorded that you skipped this month for "${goalTitle}".`;

  return (
    <main style={{ fontFamily: "Arial, sans-serif", maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <h1 style={{ color: status === "confirmed" ? "#16a34a" : "#6b7280" }}>
        {status === "confirmed" ? "Contribution Noted!" : "Response Recorded"}
      </h1>
      <p style={{ color: "#333", fontSize: 18 }}>{confirmedMessage}</p>
      <p style={{ color: "#999", fontSize: 14, marginTop: 32 }}>
        You can close this page.
      </p>
    </main>
  );
}
