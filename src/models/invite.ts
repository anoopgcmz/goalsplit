import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

import type { GoalId } from './goal';
import type { UserId } from './user';

export interface Invite {
  goalId: Types.ObjectId | GoalId;
  email: string;
  token: string;
  expiresAt: Date;
  createdBy: Types.ObjectId | UserId;
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
      ref: 'Goal',
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
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
  { timestamps: true }
);

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inviteSchema.index({ goalId: 1, email: 1 }, { unique: true });

export const InviteModel: InviteModel =
  (mongoose.models.Invite as InviteModel) || mongoose.model<Invite>('Invite', inviteSchema);

export default InviteModel;
