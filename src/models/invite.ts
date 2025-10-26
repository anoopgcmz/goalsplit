import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";

export type InviteStatus = "pending" | "accepted" | "declined" | "expired";

export interface Invite {
  goalId: Types.ObjectId;
  goalTitle: string;
  email: string;
  token: string;
  expiresAt: Date;
  createdBy: Types.ObjectId;
  inviterName?: string | null;
  inviterEmail?: string;
  message?: string | null;
  status: InviteStatus;
  respondedAt?: Date | null;
  acceptedAt?: Date;
  defaultSplitPercent?: number;
  fixedAmount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InviteDoc = HydratedDocument<Invite>;

export type InviteModel = Model<Invite>;

const inviteSchema = new Schema<Invite>(
  {
    goalId: {
      type: Schema.Types.ObjectId,
      ref: "Goal",
      required: true,
      index: true,
    },
    goalTitle: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    inviterName: {
      type: String,
      trim: true,
      default: null,
    },
    inviterEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    message: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "accepted", "declined", "expired"],
      default: "pending",
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
    },
    defaultSplitPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    fixedAmount: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

inviteSchema.index({ goalId: 1, email: 1 }, { unique: true });

export const InviteModel: InviteModel =
  (mongoose.models.Invite as InviteModel) ||
  mongoose.model<Invite>("Invite", inviteSchema);

export default InviteModel;
