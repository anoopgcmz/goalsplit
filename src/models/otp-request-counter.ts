import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model } from "mongoose";

export interface OtpRequestCounter {
  email: string;
  windowStartedAt: Date;
  requestCount: number;
}

export type OtpRequestCounterDoc = HydratedDocument<OtpRequestCounter>;

export type OtpRequestCounterModel = Model<OtpRequestCounter>;

const otpRequestCounterSchema = new Schema<OtpRequestCounter>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    windowStartedAt: {
      type: Date,
      required: true,
      index: true,
    },
    requestCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true },
);

export const OtpRequestCounterModel: OtpRequestCounterModel =
  (mongoose.models.OtpRequestCounter as OtpRequestCounterModel) ||
  mongoose.model<OtpRequestCounter>("OtpRequestCounter", otpRequestCounterSchema);

export default OtpRequestCounterModel;
