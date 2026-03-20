import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";

export type CheckInStatus = "confirmed" | "skipped" | "pending";

export interface CheckIn {
  goalId: Types.ObjectId;
  userId: Types.ObjectId;
  period: Date;
  status: CheckInStatus;
  amount?: number;
  respondedAt?: Date;
  token: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CheckInDoc = HydratedDocument<CheckIn>;

export type CheckInModel = Model<CheckIn>;

const checkinSchema = new Schema<CheckIn>(
  {
    goalId: {
      type: Schema.Types.ObjectId,
      ref: "Goal",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    period: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "skipped", "pending"],
      required: true,
      default: "pending",
    },
    amount: {
      type: Number,
      min: 0,
    },
    respondedAt: {
      type: Date,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenExpiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

checkinSchema.index({ goalId: 1, userId: 1, period: 1 }, { unique: true });

export const CheckInModel: CheckInModel =
  (mongoose.models.CheckIn as CheckInModel) ||
  mongoose.model<CheckIn>("CheckIn", checkinSchema);

export default CheckInModel;
