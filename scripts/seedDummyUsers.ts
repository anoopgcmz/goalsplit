import mongoose from "mongoose";

import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import UserModel from "@/models/user";

interface DummyUserSeed {
  email: string;
  name: string;
}

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;
const OTP_CODE = "123456";

// Update this list to adjust the seed data for manual QA or demos.
const DUMMY_USERS: DummyUserSeed[] = [
  { email: "demo@example.com", name: "Demo User" },
  { email: "alice@example.com", name: "Alice Sharma" },
  { email: "bob@example.com", name: "Bob Mehta" },
];

const ensureDevelopmentEnvironment = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seedDummyUsers.ts is development-only and cannot run in production.");
  }
};

const seedDummyUsers = async () => {
  console.log("========================================");
  console.log("GoalSplit Dummy Login Seeder");
  console.log("========================================\n");

  ensureDevelopmentEnvironment();
  console.log("Connecting to MongoDB...\n");
  await dbConnect();

  const expiry = new Date(Date.now() + TEN_MINUTES_IN_MS);

  for (const { email, name } of DUMMY_USERS) {
    console.log(`Seeding user ${email}...`);

    await UserModel.updateOne(
      { email },
      {
        $set: { name },
        $setOnInsert: { email },
      },
      { upsert: true },
    );

    await OtpCodeModel.updateMany({ email, consumed: false }, { $set: { consumed: true } });

    await OtpCodeModel.updateOne(
      { email, code: OTP_CODE },
      {
        $set: {
          expiresAt: expiry,
          consumed: false,
        },
        $setOnInsert: { email, code: OTP_CODE },
      },
      { upsert: true },
    );

    const activeOtp = await OtpCodeModel.findOne({ email, code: OTP_CODE })
      .select({ email: 1, code: 1, expiresAt: 1, consumed: 1 })
      .lean();

    if (!activeOtp) {
      console.warn(
        `  -> Warning: No OTP found for ${email}. Check unique index constraints and rerun the seed.`,
      );
    } else {
      const expiresInMs = activeOtp.expiresAt.getTime() - Date.now();
      const expiresInMinutes = Math.max(0, Math.floor(expiresInMs / 60000));
      const expiresAtDisplay = activeOtp.expiresAt.toISOString();
      console.log(
        `  -> OTP ${activeOtp.code} (consumed=${activeOtp.consumed}) expires at ${expiresAtDisplay} (~${expiresInMinutes} min remaining)`,
      );
    }
  }

  console.log("\nSeed complete. You can log in using:");
  for (const { email } of DUMMY_USERS) {
    console.log(`${email} OTP ${OTP_CODE}`);
  }
  console.log("\nRemember: codes expire 10 minutes from seeding.\n");
};

const main = async () => {
  try {
    await seedDummyUsers();
  } catch (error) {
    console.error("\nFailed to seed dummy users:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

void main();
