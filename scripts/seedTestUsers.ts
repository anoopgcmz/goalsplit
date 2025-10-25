import mongoose from "mongoose";

import { DEMO_OTP_CODE, DEMO_OTP_EXPIRY_MS, DEMO_USERS } from "@/lib/auth/demo";
import { dbConnect } from "@/lib/mongo";
import OtpCodeModel from "@/models/otp-code";
import UserModel from "@/models/user";

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

  const expiry = new Date(Date.now() + DEMO_OTP_EXPIRY_MS);

  for (const { email, name } of DEMO_USERS) {
    console.log(`Creating user ${email}...`);
    await UserModel.create({ email, name });

    await OtpCodeModel.create({
      email,
      code: DEMO_OTP_CODE,
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
    for (const { email } of DEMO_USERS) {
      console.log(`${email} → OTP ${DEMO_OTP_CODE}`);
    }
    console.log("OTP codes expire in about 100 days for local testing.");
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
