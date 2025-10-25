import { cookies } from "next/headers";
import { Types } from "mongoose";

import type { AuthUser } from "@/app/api/auth/schemas";
import { dbConnect } from "@/lib/mongo";
import UserModel from "@/models/user";

import { SESSION_COOKIE_NAME, validateSessionToken } from "./session";

export const getUserFromCookie = async (): Promise<AuthUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const validation = validateSessionToken(token);

  if (!validation.success) {
    return null;
  }

  const userId = validation.session.userId;
  if (!Types.ObjectId.isValid(userId)) {
    return null;
  }

  await dbConnect();

  const user = await UserModel.findById(new Types.ObjectId(userId)).lean();
  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name ?? null,
  } satisfies AuthUser;
};
