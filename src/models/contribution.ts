import mongoose, { HydratedDocument, Model, Schema, Types } from 'mongoose';

import type { GoalId } from './goal';
import type { UserId } from './user';

export interface Contribution {
  goalId: Types.ObjectId | GoalId;
  userId: Types.ObjectId | UserId;
  amount: number;
  period: Date;
}

export type ContributionDoc = HydratedDocument<Contribution>;

export type ContributionModel = Model<Contribution>;

const contributionSchema = new Schema<Contribution>(
  {
    goalId: {
      type: Schema.Types.ObjectId,
      ref: 'Goal',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    period: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

contributionSchema.index({ goalId: 1, userId: 1, period: 1 }, { unique: true });

export const ContributionModel: ContributionModel =
  (mongoose.models.Contribution as ContributionModel) ||
  mongoose.model<Contribution>('Contribution', contributionSchema);

export default ContributionModel;
