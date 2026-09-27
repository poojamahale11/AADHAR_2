const mongoose = require('mongoose');

/**
 * Password Reset Token Schema
 * Stores secure tokens for password reset functionality
 * Tokens automatically expire after 1 hour
 */
const passwordResetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// TTL index to automatically delete expired tokens after 2 hours
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7200 });

// Method to check if token is still valid
passwordResetSchema.methods.isValid = function () {
  return !this.used && this.expiresAt > new Date();
};

// Mark token as used to prevent reuse
passwordResetSchema.methods.markAsUsed = async function () {
  this.used = true;
  await this.save();
};

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);

module.exports = PasswordReset;
