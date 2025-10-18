import mongoose, { Schema } from "mongoose";
import type { HydratedDocument, Model, Types } from "mongoose";

export type GoalCompounding = "monthly" | "yearly";
export type ContributionFrequency = "monthly" | "yearly";
export type CurrencyCode = string;
export type GoalMemberRole = "owner" | "collaborator";

export interface GoalMember {
  userId: Types.ObjectId;
  role: GoalMemberRole;
  splitPercent?: number;
  fixedAmount?: number;
}

export interface Goal {
  ownerId: Types.ObjectId;
  title: string;
  targetAmount: number;
  currency: CurrencyCode;
  targetDate: Date;
  expectedRate: number;
  compounding: GoalCompounding;
  contributionFrequency: ContributionFrequency;
  existingSavings?: number;
  isShared: boolean;
  members: GoalMember[];
}

export type GoalDoc = HydratedDocument<Goal>;

export type GoalModel = Model<Goal>;

const goalMemberSchema = new Schema<GoalMember>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["owner", "collaborator"],
    },
    splitPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    fixedAmount: {
      type: Number,
      min: 0,
    },
  },
  { _id: false },
);

const goalSchema = new Schema<Goal>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    expectedRate: {
      type: Number,
      required: true,
      min: 0,
    },
    compounding: {
      type: String,
      required: true,
      enum: ["monthly", "yearly"],
    },
    contributionFrequency: {
      type: String,
      required: true,
      enum: ["monthly", "yearly"],
    },
    existingSavings: {
      type: Number,
      min: 0,
    },
    isShared: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    members: {
      type: [goalMemberSchema],
      required: true,
      default: [],
    },
  },
  { timestamps: true },
);

goalSchema.index({ ownerId: 1, targetDate: 1 });
goalSchema.index({ "members.userId": 1 });

export const GoalModel: GoalModel =
  (mongoose.models.Goal as GoalModel) || mongoose.model<Goal>("Goal", goalSchema);

export type GoalId = GoalDoc["_id"];

export default GoalModel;
