import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['SuperAdmin', 'Admin', 'Manager', 'Employee'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
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
