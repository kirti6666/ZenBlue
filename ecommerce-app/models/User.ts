import mongoose, { Schema } from 'mongoose';

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password?: string; // absent for OAuth-only users
  provider: 'credentials' | 'google' | 'otp';
  role: 'customer' | 'staff' | 'admin';
  /** Fine-grained overrides for staff. Admins implicitly hold every permission. */
  permissions: string[];
  avatar?: string;
  /** Split for the profile form; `name` stays the canonical display name. */
  firstName?: string;
  lastName?: string;
  dob?: Date;
  gender?: 'male' | 'female' | 'other' | '';
  phone?: string;
  phoneVerified?: boolean;
  addresses: mongoose.Types.ObjectId[];
  wishlist: mongoose.Types.ObjectId[];
  isVerified: boolean;
  /** Two-factor is enforced on every admin/staff login when true. */
  twoFactorEnabled?: boolean;
  twoFactorChannel?: 'email' | 'sms';
  isBlocked?: boolean;
  marketingOptIn?: boolean;
  /** HisabKitab customer-ledger id, populated by ERP customer reconciliation. */
  erpLedgerId?: string;
  erpSyncedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, select: false }, // never returned by default queries
    provider: {
      type: String,
      enum: ['credentials', 'google', 'otp'],
      default: 'credentials',
    },
    // 'staff' sits between customer and admin: it can reach /admin, but only
    // the sections listed in `permissions`. See lib/permissions.ts.
    role: { type: String, enum: ['customer', 'staff', 'admin'], default: 'customer' },
    permissions: [{ type: String }],
    avatar: { type: String },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    dob: { type: Date },
    // Kept optional and including "" so a customer is never forced to declare
    // one; the form offers it for birthday offers, not for segmentation.
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    phone: { type: String, index: true, sparse: true },
    phoneVerified: { type: Boolean, default: false },
    addresses: [{ type: Schema.Types.ObjectId, ref: 'Address' }],
    wishlist: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    isVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorChannel: { type: String, enum: ['email', 'sms'], default: 'email' },
    isBlocked: { type: Boolean, default: false },
    marketingOptIn: { type: Boolean, default: false },
    erpLedgerId: { type: String, default: "", index: true, sparse: true },
    erpSyncedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);


// Next.js may evaluate this module more than once during development hot
// reloads. Reuse the compiled model when it exists instead of attempting to
// register `User` again (which causes an OverwriteModelError).
const User =
  (mongoose.models?.User as mongoose.Model<IUser> | undefined) ??
  mongoose.model<IUser>('User', UserSchema);

export default User;
