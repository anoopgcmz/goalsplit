import { config } from './config';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const { email } = config;

  if (email.provider === 'resend') {
    const { Resend } = await import('resend');
    const resend = new Resend(email.apiKey);
    await resend.emails.send({
      from: email.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  } else {
    const nodemailer = await import('nodemailer');
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
}
