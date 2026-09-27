const crypto = require('crypto');
const PasswordReset = require('../models/PasswordReset');

/**
 * Generate a cryptographically secure random token for password reset
 * @returns {string} 64-character hexadecimal token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new password reset token for a user
 * @param {ObjectId} userId - The user's MongoDB ObjectId
 * @returns {Promise<Object>} Object containing the token and expiry time
 */
async function createPasswordResetToken(userId) {
  // Invalidate any existing tokens for this user
  await PasswordReset.updateMany(
    { userId, used: false },
    { $set: { used: true } }
  );

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  await PasswordReset.create({
    userId,
    token,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Verify a password reset token
 * @param {string} token - The reset token to verify
 * @returns {Promise<Object|null>} Password reset document if valid, null otherwise
 */
async function verifyResetToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const resetDoc = await PasswordReset.findOne({ token }).populate('userId');
  
  if (!resetDoc || !resetDoc.isValid()) {
    return null;
  }

  return resetDoc;
}

/**
 * Clean up expired and used tokens (maintenance function)
 * TTL index handles automatic deletion, but this can be called manually
 * @returns {Promise<number>} Number of tokens deleted
 */
async function cleanupExpiredTokens() {
  const result = await PasswordReset.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { used: true, createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Used tokens older than 7 days
    ],
  });
  return result.deletedCount;
}

module.exports = {
  generateResetToken,
  createPasswordResetToken,
  verifyResetToken,
  cleanupExpiredTokens,
};
