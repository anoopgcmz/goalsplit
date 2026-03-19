import { Resend } from 'resend';
import nodemailer from 'nodemailer';

import { config } from './config';

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { email } = config;

  if (email.provider === 'resend') {
    const resend = new Resend(email.apiKey);
    await resend.emails.send({
      from: email.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: email.host,
    port: email.port,
    auth: {
      user: email.user,
      pass: email.pass,
    },
  });

  await transporter.sendMail({
    from: email.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
