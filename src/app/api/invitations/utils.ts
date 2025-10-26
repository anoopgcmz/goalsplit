import type { NextRequest } from "next/server";
import { Types } from "mongoose";

import type { InviteDoc } from "@/models/invite";

import {
  InvitationStatusQuerySchema,
  InvitationStatusSchema,
  type InvitationStatus,
} from "./schemas";

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const serializeInvitation = (invite: InviteDoc) => {
  const createdAt = invite.createdAt instanceof Date ? invite.createdAt : new Date();
  const respondedAt = invite.respondedAt instanceof Date ? invite.respondedAt : null;
  const invitationId = invite._id instanceof Types.ObjectId ? invite._id.toString() : String(invite._id);
  const goalId = invite.goalId instanceof Types.ObjectId ? invite.goalId.toString() : String(invite.goalId);
  const expiresAt = invite.expiresAt instanceof Date ? invite.expiresAt : new Date(invite.expiresAt);

  return {
    id: invitationId,
    goalId,
    goalTitle: invite.goalTitle,
    inviterName: invite.inviterName ?? null,
    inviterEmail: invite.inviterEmail ?? null,
    inviteeEmail: invite.email,
    message: invite.message ?? null,
    status: invite.status,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    respondedAt: respondedAt ? respondedAt.toISOString() : null,
  };
};

export const markInviteExpiredIfNeeded = async (invite: InviteDoc): Promise<InviteDoc> => {
  if (invite.status !== "pending") {
    return invite;
  }

  if (invite.expiresAt.getTime() > Date.now()) {
    return invite;
  }

  invite.status = "expired";
  invite.respondedAt = invite.respondedAt ?? new Date();
  await invite.save();

  return invite;
};

export const markExpiredInvitations = async (invites: InviteDoc[]) => {
  await Promise.all(invites.map((invite) => markInviteExpiredIfNeeded(invite)));
};

export const parseStatuses = (request: NextRequest): InvitationStatus[] | null => {
  const params = request.nextUrl.searchParams.getAll("status");

  let raw: string | string[] | undefined;

  if (params.length === 1) {
    raw = params[0] ?? undefined;
  } else if (params.length > 1) {
    raw = params;
  }

  const parsed = InvitationStatusQuerySchema.parse(raw);

  if (!parsed || parsed === "all") {
    return null;
  }

  if (Array.isArray(parsed)) {
    return parsed.filter((value): value is InvitationStatus =>
      InvitationStatusSchema.safeParse(value).success,
    );
  }

  if (typeof parsed === "string" && parsed !== "all") {
    return [parsed];
  }

  return null;
};
