import mongoose, { HydratedDocument, Model, Schema } from 'mongoose';

export interface User {
  email: string;
  name?: string;
}

export type UserDoc = HydratedDocument<User>;

export type UserModel = Model<User>;

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const UserModel: UserModel =
  (mongoose.models.User as UserModel) || mongoose.model<User>('User', userSchema);

export type UserId = UserDoc['_id'];

export default UserModel;
