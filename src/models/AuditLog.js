import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: { type: String },
    action: { type: String, required: true, index: true }, // login, logout, view, create, update, delete, export, ip_blocked
    resource: { type: String }, // e.g. "LoanCase", "User"
    resourceId: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    method: { type: String },
    path: { type: String },
    status: { type: String, enum: ['success', 'failure'], default: 'success' },
    meta: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
