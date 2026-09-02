import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'Employee', required: true },
    isActive: { type: Boolean, default: true },
    allowedIPs: { type: [String], default: [] },
    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

// Uniqueness is enforced with PARTIAL indexes, not plain `unique: true`.
//
// This collection is shared with an older app whose documents have no email or
// phone at all. A plain unique index would read every one of those as null and
// reject all but the first, so the filters restrict each index to documents
// that actually carry a string value. See src/scripts/fixUserIndexes.js, which
// also repairs that app's `username` index for the same reason in reverse:
// CRM users have no username, and a plain unique index rejected them.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: 'string' } } }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { _id, name, email, phone, role, isActive, lastLoginAt } = this;
  return { id: _id, name, email, phone, role, isActive, lastLoginAt };
};

export default mongoose.model('User', userSchema);
