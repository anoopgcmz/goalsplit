export function otpEmailTemplate(code: string): { subject: string; html: string; text: string } {
  const subject = 'Your GoalSplit login code';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">GoalSplit</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0 0 16px;">Here is your one-time login code:</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="background-color: #f0f4ff; border-radius: 8px; padding: 20px 40px; display: inline-block;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="color: #666666; font-size: 14px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              If you did not request this code, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Your GoalSplit login code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.\n\nIf you did not request this code, you can safely ignore this email.`;

  return { subject, html, text };
}

interface CheckInEmailOptions {
  memberName: string | null;
  goalTitle: string;
  amountPerPeriod: string;
  confirmUrl: string;
  skipUrl: string;
}

export function checkinEmailTemplate(options: CheckInEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const { memberName, goalTitle, amountPerPeriod, confirmUrl, skipUrl } = options;
  const nameDisplay = memberName ?? 'Hi there';
  const subject = `Did you contribute to "${goalTitle}" this month?`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">GoalSplit</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 16px;">
              <p style="margin: 0;">Hi ${nameDisplay},</p>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 8px;">
              <p style="margin: 0;">Your group is saving toward <strong>&ldquo;${goalTitle}&rdquo;</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0;">Your share this month: <strong>${amountPerPeriod}</strong></p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <a href="${confirmUrl}" style="background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">&#10003; Yes, I contributed</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <a href="${skipUrl}" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">&#10007; Not yet</a>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              You are receiving this because you are a member of a shared savings goal on GoalSplit.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${nameDisplay},\n\nYour group is saving toward "${goalTitle}". Your share this month: ${amountPerPeriod}.\n\nYes, I contributed: ${confirmUrl}\n\nNot yet: ${skipUrl}\n\nYou are receiving this because you are a member of a shared savings goal on GoalSplit.`;

  return { subject, html, text };
}

interface InviteEmailOptions {
  inviterName: string | null;
  goalTitle: string;
  inviteUrl: string;
  message?: string | null;
}

export function inviteEmailTemplate(options: InviteEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const { inviterName, goalTitle, inviteUrl, message } = options;
  const inviterDisplay = inviterName ?? 'Someone';
  const subject = `${inviterDisplay} invited you to collaborate on "${goalTitle}"`;

  const messageHtml = message
    ? `<tr><td style="background-color: #f9f9f9; border-left: 4px solid #4f46e5; border-radius: 4px; padding: 16px; margin-bottom: 24px; color: #555555; font-size: 15px; font-style: italic;">${message}</td></tr>`
    : '';

  const messageText = message ? `\nMessage: ${message}\n` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">GoalSplit</h1>
            </td>
          </tr>
          <tr>
            <td style="color: #333333; font-size: 16px; line-height: 1.6; padding-bottom: 24px;">
              <p style="margin: 0;"><strong>${inviterDisplay}</strong> has invited you to collaborate on the savings goal <strong>&ldquo;${goalTitle}&rdquo;</strong>.</p>
            </td>
          </tr>
          ${messageHtml}
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="${inviteUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">Accept Invitation</a>
            </td>
          </tr>
          <tr>
            <td style="color: #666666; font-size: 13px; line-height: 1.6; padding-bottom: 16px;">
              <p style="margin: 0;">Or copy and paste this link into your browser:</p>
              <p style="margin: 8px 0 0; word-break: break-all; color: #4f46e5;">${inviteUrl}</p>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #eeeeee; padding-top: 20px; color: #999999; font-size: 12px; text-align: center;">
              If you were not expecting this invitation, you can safely ignore this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${inviterDisplay} has invited you to collaborate on the savings goal "${goalTitle}".${messageText}\n\nAccept the invitation here: ${inviteUrl}\n\nIf you were not expecting this invitation, you can safely ignore this email.`;

  return { subject, html, text };
}
