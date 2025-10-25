import mongoose from "mongoose";

import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import UserModel from "@/models/user";

// ⚠️ DEV-ONLY SEEDER — DELETE AFTER TESTING
const TEST_USERS = [
  { email: "demo1@example.com", name: "Demo One" },
  { email: "demo2@example.com", name: "Demo Two" },
  { email: "demo3@example.com", name: "Demo Three" },
  { email: "demo4@example.com", name: "Demo Four" },
  { email: "demo5@example.com", name: "Demo Five" },
] as const;

const OTP_CODE = "123456";

const ensureDevelopmentOnly = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("scripts/seedTestUsers.ts is development-only and cannot run in production.");
  }
};

const seedTestUsers = async () => {
  ensureDevelopmentOnly();
  await dbConnect();

  for (const { email, name } of TEST_USERS) {
    await UserModel.updateOne(
      { email },
      {
        $set: { name },
        $setOnInsert: { email },
      },
      { upsert: true },
    );

    await OtpCodeModel.updateOne(
      { email, code: OTP_CODE },
      {
        $set: {
          expiresAt: null as unknown as Date,
          consumed: false,
        },
        $setOnInsert: { email, code: OTP_CODE },
      },
      { upsert: true },
    );
  }
};

const main = async () => {
  try {
    await seedTestUsers();

    console.log("✅ Dummy users created successfully.");
    console.log("Login with these test credentials:");
    for (const { email } of TEST_USERS) {
      console.log(`${email} → OTP ${OTP_CODE}`);
    }
  } catch (error) {
    console.error("Failed to seed test users:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

void main();
