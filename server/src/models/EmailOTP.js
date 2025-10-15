import mongoose from 'mongoose';

const emailOTPSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  otpHash: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 3 * 60 * 1000) // 3 minutes
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  }
}, {
  timestamps: true
});

// TTL index to automatically delete expired OTPs
emailOTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailOTPSchema.index({ userId: 1 });

export default mongoose.model('EmailOTP', emailOTPSchema);