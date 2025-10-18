import mongoose, { Schema, type InferSchemaType, type Model } from 'mongoose';

const analyticsEventSchema = new Schema(
  {
    event: { type: String, required: true, maxlength: 64 },
    properties: { type: Schema.Types.Mixed, default: {} },
    recordedAt: {
      type: Date,
      required: true,
      index: true,
      expires: 60 * 24 * 60 * 60,
    },
  },
  {
    collection: 'analytics_events',
    versionKey: false,
    timestamps: false,
  },
);

export type AnalyticsEvent = InferSchemaType<typeof analyticsEventSchema>;

export type AnalyticsEventModel = Model<AnalyticsEvent>;

export const AnalyticsEventModel: AnalyticsEventModel =
  (mongoose.models.AnalyticsEvent as AnalyticsEventModel) ||
  mongoose.model<AnalyticsEvent>('AnalyticsEvent', analyticsEventSchema);
