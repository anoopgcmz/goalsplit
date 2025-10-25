import { expect, test } from "@playwright/test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import path from "node:path";
import { once } from "node:events";
import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";

import GoalModel from "../../src/models/goal";
import OtpCodeModel from "../../src/models/otp-code";
import OtpRequestCounterModel from "../../src/models/otp-request-counter";
import UserModel from "../../src/models/user";
import {
  QUICK_CHECK_BASE_URL,
  QUICK_CHECK_PORT,
  QUICK_CHECK_USER_EMAIL,
} from "./constants";

const QUICK_CHECK_JWT_SECRET = "quick-check-jwt-secret-value-at-least-32";

test.describe.configure({ mode: "serial" });

type NextServerProcess = ChildProcessWithoutNullStreams & { killed?: boolean };

let mongoServer: MongoMemoryServer;
let mongoUri: string;
let mongoDbName: string;
let nextProcess: NextServerProcess | null = null;

const waitForServerReady = async (processRef: NextServerProcess): Promise<void> => {
  const readyPattern = /ready - started server on/;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Next.js dev server did not report ready state within 60s"));
    }, 60_000);

    const handleStdout = (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(`[next] ${text}`);
      if (readyPattern.test(text)) {
        cleanup();
        resolve();
      }
    };

    const handleStderr = (chunk: Buffer) => {
      const text = chunk.toString();
      process.stderr.write(`[next:err] ${text}`);
    };

    const handleExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup();
      reject(
        new Error(
          `Next.js dev server exited before becoming ready (code=${code}, signal=${signal ?? "none"})`,
        ),
      );
    };

    const cleanup = () => {
      clearTimeout(timeout);
      processRef.stdout.off("data", handleStdout);
      processRef.stderr.off("data", handleStderr);
      processRef.off("exit", handleExit);
    };

    processRef.stdout.on("data", handleStdout);
    processRef.stderr.on("data", handleStderr);
    processRef.once("exit", handleExit);
  });
};

const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  const targetMonth = result.getMonth() + months;
  const yearsToAdd = Math.floor(targetMonth / 12);
  const adjustedMonth = targetMonth % 12;

  result.setFullYear(result.getFullYear() + yearsToAdd);
  result.setMonth(adjustedMonth);

  return result;
};

test.beforeAll(async () => {
  test.setTimeout(180_000);

  mongoServer = await MongoMemoryServer.create();
  mongoUri = mongoServer.getUri();
  mongoDbName = "goalsplit-quick-checks";

  process.env.MONGODB_URI = mongoUri;
  process.env.MONGODB_DB = mongoDbName;
  process.env.JWT_SECRET = QUICK_CHECK_JWT_SECRET;
  process.env.EMAIL_FROM = "quick-check@example.com";
  process.env.NEXT_TELEMETRY_DISABLED = "1";

  await mongoose.connect(mongoUri, { dbName: mongoDbName });
  await mongoose.connection.db.dropDatabase();

  const user = await UserModel.create({
    email: QUICK_CHECK_USER_EMAIL,
    name: "Demo User",
  });

  const now = new Date();
  await GoalModel.insertMany([
    {
      ownerId: user._id,
      title: "Bike",
      targetAmount: 250_000,
      currency: "INR",
      targetDate: addMonths(now, 24),
      expectedRate: 8,
      compounding: "monthly",
      contributionFrequency: "monthly",
      existingSavings: 0,
      isShared: false,
      members: [
        { userId: user._id, role: "owner", splitPercent: 100 },
      ],
    },
    {
      ownerId: user._id,
      title: "Plot",
      targetAmount: 1_500_000,
      currency: "INR",
      targetDate: addMonths(now, 120),
      expectedRate: 8,
      compounding: "monthly",
      contributionFrequency: "monthly",
      existingSavings: 0,
      isShared: false,
      members: [
        { userId: user._id, role: "owner", splitPercent: 100 },
      ],
    },
    {
      ownerId: user._id,
      title: "iPhone 17",
      targetAmount: 120_000,
      currency: "INR",
      targetDate: addMonths(now, 6),
      expectedRate: 6,
      compounding: "monthly",
      contributionFrequency: "monthly",
      existingSavings: 0,
      isShared: false,
      members: [
        { userId: user._id, role: "owner", splitPercent: 100 },
      ],
    },
  ]);

  await Promise.all([
    OtpCodeModel.deleteMany({}),
    OtpRequestCounterModel.deleteMany({}),
  ]);

  const nextExecutable = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );

  nextProcess = spawn(
    nextExecutable,
    ["dev", "--hostname", "127.0.0.1", "--port", QUICK_CHECK_PORT.toString()],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MONGODB_URI: mongoUri,
        MONGODB_DB: mongoDbName,
        JWT_SECRET: QUICK_CHECK_JWT_SECRET,
        EMAIL_FROM: "quick-check@example.com",
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  ) as NextServerProcess;

  await waitForServerReady(nextProcess);
});

const fetchLatestOtp = async (email: string): Promise<string | null> => {
  const latest = await OtpCodeModel.findOne({ email }).sort({ createdAt: -1 }).lean();
  return latest?.code ?? null;
};

test.afterAll(async () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
    await once(nextProcess, "exit").catch(() => undefined);
    nextProcess = null;
  }

  await mongoose.disconnect().catch(() => undefined);
  if (mongoServer) {
    await mongoServer.stop();
  }
});

const expectGoalTitles = async (pageTitles: string[]) => {
  const expectedTitles = ["Bike", "Plot", "iPhone 17"];
  expect(new Set(pageTitles)).toEqual(new Set(expectedTitles));
};

test("demo user can request OTP, sign in, view goals, and log out", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email address").fill(QUICK_CHECK_USER_EMAIL);
  await page.getByRole("button", { name: "Send code" }).click();

  const statusMessage = page.locator("#login-status");
  await expect(statusMessage).toContainText("Check your inbox for a 6-digit code.");

  const otpCode = await expect
    .poll(async () => fetchLatestOtp(QUICK_CHECK_USER_EMAIL), {
      message: "Timed out waiting for OTP code in database",
      timeout: 10_000,
    })
    .not.toBeNull();

  const codeToSubmit = otpCode as string;
  console.info(`[quick-check] OTP for ${QUICK_CHECK_USER_EMAIL}: ${codeToSubmit}`);

  await page.getByLabel("Verification code").fill(codeToSubmit);
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL(`${QUICK_CHECK_BASE_URL}/dashboard`, {
    waitUntil: "networkidle",
  });

  const goalCards = page.locator("[data-goal-id]");
  await expect(goalCards).toHaveCount(3);
  const goalTitles = await goalCards.locator("h3").allTextContents();
  await expectGoalTitles(goalTitles);

  const goalsResponse = await page.request.get("/api/goals");
  expect(goalsResponse.status()).toBe(200);
  const goalsJson = await goalsResponse.json();
  const apiTitles: string[] = goalsJson.data.map((goal: { title: string }) => goal.title);
  await expectGoalTitles(apiTitles);

  const meResponse = await page.request.get("/api/me");
  expect(meResponse.status()).toBe(200);

  await page.goto("/logout");
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/login$/);

  const unauthorizedGoalsResponse = await page.request.get("/api/goals");
  expect(unauthorizedGoalsResponse.status()).toBe(401);
});
