import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';

export interface OtpCode {
  email: string;
  code: string;
  expiresAt: Date;
  consumed: boolean;
}

export type OtpCodeDoc = HydratedDocument<OtpCode>;

export type OtpCodeModel = Model<OtpCode>;

const otpCodeSchema = new Schema<OtpCode>(
  {
    email: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    code: {
      type: String,
      required: true,
      minlength: 6,
      maxlength: 6,
      match: /^\d{6}$/,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    consumed: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

otpCodeSchema.index({ email: 1, code: 1 }, { unique: true });
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpCodeModel: OtpCodeModel =
  (mongoose.models.OtpCode as OtpCodeModel) || mongoose.model<OtpCode>('OtpCode', otpCodeSchema);

export default OtpCodeModel;
