import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH_RE.test(value);
}

export interface IUser extends Document {
  name: string;
  email?: string;
  phone?: string;
  password?: string;
  role: 'client' | 'technician' | 'master_technician' | 'admin';
  avatar?: string;
  isActive: boolean;
  phoneVerified?: boolean;
  appwriteUserId?: string;
  fcmToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Invalid email'],
    },
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['client', 'technician', 'master_technician', 'admin'],
      default: 'client',
    },
    avatar: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    appwriteUserId: String,
    fcmToken: String,
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre('validate', function (next) {
  if (!this.email && !this.phone) {
    this.invalidate('email', 'Email or phone number is required');
  }
  if (!this.password) {
    this.invalidate('password', 'Password is required');
  }
  next();
});

userSchema.pre('save', async function (next) {
  if (this.role !== 'master_technician' || !this.isNew) return next();
  try {
    const existing = await User.findOne({ role: 'master_technician' });
    if (existing) {
      return next(new Error('Only one master technician account is allowed'));
    }
    next();
  } catch (err) {
    next(err as Error);
  }
});

/** Hash plaintext passwords with bcryptjs before save (skip if already a hash). */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  if (isBcryptHash(this.password)) return next();
  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;

  if (isBcryptHash(this.password)) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Legacy plaintext row — accept once, then upgrade to bcrypt in place.
  if (candidatePassword !== this.password) return false;

  const hashed = await bcrypt.hash(candidatePassword, BCRYPT_ROUNDS);
  await mongoose.connection.collection('users').updateOne(
    { _id: this._id },
    { $set: { password: hashed } }
  );
  this.password = hashed;
  return true;
};

export const User = mongoose.model<IUser>('User', userSchema);
