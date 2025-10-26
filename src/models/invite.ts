import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";

export interface Invite {
  goalId: Types.ObjectId;
  email: string;
  token: string;
  expiresAt: Date;
  createdBy: Types.ObjectId;
  acceptedAt?: Date;
  defaultSplitPercent?: number;
  fixedAmount?: number | null;
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
  { timestamps: true },
);

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inviteSchema.index({ goalId: 1, email: 1 }, { unique: true });

export const InviteModel: InviteModel =
  (mongoose.models.Invite as InviteModel) ||
  mongoose.model<Invite>("Invite", inviteSchema);

export default InviteModel;
