# GoalSplit Planner

This is a Next.js App Router project bootstrapped with TypeScript, Tailwind CSS, ESLint, and Prettier. It presents an accessible landing page for the GoalSplit planner, focusing on shared financial goals with fixed returns and neutral guidance.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to view the page.

## Scripts

- `npm run dev` - Start the development server.
- `npm run build` - Create a production build of the application.
- `npm run start` - Run the production build locally.
- `npm run lint` - Lint the project using ESLint with TypeScript support.

## Environment Setup

1. Copy the example environment file and adjust it for your environment:

   ```bash
   cp .env.local.example .env.local
   ```

2. Update the values in `.env.local`:
   - `MONGODB_URI` and `MONGODB_DB` should match your MongoDB deployment and database name.
   - `EMAIL_FROM` must be a verified sender address for your email provider.
   - Choose an email provider:
     - Provide a `RESEND_API_KEY`, **or**
     - Supply the complete set of SMTP variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).

3. Generate a strong JWT secret and paste it into `JWT_SECRET`. Any unpredictable 32+ character string works. A convenient command is:

   ```bash
   openssl rand -base64 48
   ```

The application loads configuration through `src/lib/config.ts`, which validates the environment using Zod on startup. Missing or invalid values cause a descriptive `EnvValidationError` so misconfiguration is detected immediately.

## Accessibility Defaults

- Base font size increased for readability.
- High contrast color palette with clear foreground/background separation.
- Consistent focus outlines to maintain visible focus states across interactive elements.
