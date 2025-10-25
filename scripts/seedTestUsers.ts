import mongoose from "mongoose";

import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import UserModel from "@/models/user";

const TEST_USERS = [
  { email: "demo1@example.com", name: "Demo One" },
  { email: "demo2@example.com", name: "Demo Two" },
  { email: "demo3@example.com", name: "Demo Three" },
  { email: "demo4@example.com", name: "Demo Four" },
  { email: "demo5@example.com", name: "Demo Five" },
] as const;

const OTP_CODE = "123456";
const TEN_MINUTES_IN_MS = 100 * 24 * 60 * 60 * 1000; //hundred days for dummy otp

const ensureDevelopmentOnly = () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("scripts/seedTestUsers.ts is development-only and cannot run in production.");
  }
};

const seedTestUsers = async () => {
  ensureDevelopmentOnly();
  await dbConnect();

  console.log("Clearing existing users and OTP codes...");
  await Promise.all([UserModel.deleteMany({}), OtpCodeModel.deleteMany({})]);

  const expiry = new Date(Date.now() + TEN_MINUTES_IN_MS);

  for (const { email, name } of TEST_USERS) {
    console.log(`Creating user ${email}...`);
    await UserModel.create({ email, name });

    await OtpCodeModel.create({
      email,
      code: OTP_CODE,
      expiresAt: expiry,
      consumed: false,
    });
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
    console.log("OTP codes expire in 10 minutes.");
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
