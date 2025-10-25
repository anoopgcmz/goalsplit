export const DEMO_USERS = [
  { email: "demo1@example.com", name: "Demo One" },
  { email: "demo2@example.com", name: "Demo Two" },
  { email: "demo3@example.com", name: "Demo Three" },
  { email: "demo4@example.com", name: "Demo Four" },
  { email: "demo5@example.com", name: "Demo Five" },
] as const;

export type DemoUser = (typeof DEMO_USERS)[number];

const demoUserEmailSet = new Set(DEMO_USERS.map((user) => user.email));

export const DEMO_OTP_CODE = "123456";
export const DEMO_OTP_EXPIRY_MS = 100 * 24 * 60 * 60 * 1000;

export const isDemoEmail = (email: string): email is DemoUser["email"] =>
  demoUserEmailSet.has(email);

export const findDemoUserByEmail = (email: string): DemoUser | null =>
  DEMO_USERS.find((user) => user.email === email) ?? null;
