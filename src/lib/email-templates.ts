export function otpEmailTemplate(code: string): {
  subject: string;
  html: string;
  text: string;
} {
  return {
    subject: 'Your GoalSplit sign-in code',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:8px">Your sign-in code</h2>
  <p style="color:#555;margin-bottom:24px">Use this code to sign in to GoalSplit. It expires in 10 minutes.</p>
  <div style="font-size:36px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f4f4f5;border-radius:8px;text-align:center">${code}</div>
  <p style="color:#888;font-size:13px;margin-top:24px">If you didn't request this code, you can safely ignore this email.</p>
</body>
</html>`,
    text: `Your GoalSplit sign-in code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
  };
}

export function inviteEmailTemplate(options: {
  inviterName: string | null;
  goalTitle: string;
  inviteUrl: string;
  message?: string | null;
}): { subject: string; html: string; text: string } {
  const { inviterName, goalTitle, inviteUrl, message } = options;
  const senderLabel = inviterName ?? 'Someone';
  const messageSection = message
    ? `<p style="background:#f4f4f5;border-left:3px solid #e5e7eb;padding:12px 16px;border-radius:4px;color:#555;font-style:italic">"${message}"</p>`
    : '';
  const messageText = message ? `\n\nMessage: "${message}"\n` : '';

  return {
    subject: `${senderLabel} invited you to a savings goal on GoalSplit`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h2 style="margin-bottom:8px">You're invited to collaborate</h2>
  <p style="color:#555;margin-bottom:16px">
    <strong>${senderLabel}</strong> has invited you to join a shared savings goal:
    <strong>${goalTitle}</strong>
  </p>
  ${messageSection}
  <a href="${inviteUrl}"
     style="display:inline-block;margin-top:24px;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
    Accept Invitation
  </a>
  <p style="color:#888;font-size:13px;margin-top:24px">
    Or copy this link: <a href="${inviteUrl}" style="color:#555">${inviteUrl}</a>
  </p>
</body>
</html>`,
    text: `${senderLabel} has invited you to join a shared savings goal on GoalSplit: "${goalTitle}"${messageText}\n\nAccept the invitation here: ${inviteUrl}`,
  };
}
