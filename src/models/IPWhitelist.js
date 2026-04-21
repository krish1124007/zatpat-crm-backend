import mongoose from 'mongoose';

const ipWhitelistSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    label: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('IPWhitelist', ipWhitelistSchema);
