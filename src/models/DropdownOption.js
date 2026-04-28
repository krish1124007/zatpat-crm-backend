import mongoose from 'mongoose';

export const DROPDOWN_TYPES = [
  'channelName',
  'bankName',
  'referralName',
  'propertyType',
  'provisionalBank',
  'product',
  'status',
];

const dropdownOptionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: DROPDOWN_TYPES,
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    metadata: {
      description: { type: String, default: '' },
      sortOrder: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Compound index to prevent duplicates per type
dropdownOptionSchema.index({ type: 1, value: 1 }, { unique: true });

export default mongoose.model('DropdownOption', dropdownOptionSchema);
