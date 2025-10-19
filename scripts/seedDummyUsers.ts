import mongoose from "mongoose";

import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import UserModel from "@/models/user";

interface DummyUserSeed {
  email: string;
  name: string;
  code: string;
}

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

// Update this list to adjust the seed data for manual QA or demos.
const DUMMY_USERS: DummyUserSeed[] = [
  { email: "demo@example.com", name: "Demo User", code: "123456" },
  { email: "alice@example.com", name: "Alice Sharma", code: "654321" },
  { email: "bob@example.com", name: "Bob Mehta", code: "112233" },
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

  for (const { email, name, code } of DUMMY_USERS) {
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
      { email, code },
      {
        $set: {
          expiresAt: expiry,
          consumed: false,
        },
        $setOnInsert: { email, code },
      },
      { upsert: true },
    );
  }

  console.log("\nSeed complete. You can log in using:");
  console.log("demo@example.com  OTP 123456");
  console.log("alice@example.com OTP 654321");
  console.log("bob@example.com   OTP 112233");
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
