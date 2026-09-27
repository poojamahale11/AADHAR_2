const crypto = require('crypto');

/**
 * Security utility functions for AADHAR application
 * Provides additional security layers beyond basic authentication
 */

/**
 * Generate a secure random string
 * @param {number} length - Length of the string to generate
 * @returns {string} Random hexadecimal string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 * Useful for creating non-reversible identifiers
 * @param {string} data - Data to hash
 * @returns {string} SHA-256 hash
 */
function sha256Hash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Validate email format
 * More comprehensive than basic regex
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  
  // Additional checks
  if (email.length > 254) return false; // RFC 5321
  const [local, domain] = email.split('@');
  if (!local || !domain) return false;
  if (local.length > 64) return false; // RFC 5321
  
  return true;
}

/**
 * Sanitize user input to prevent XSS
 * Basic sanitization - consider using a library like DOMPurify for production
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Check password strength
 * Returns score 0-4 and feedback
 * @param {string} password - Password to check
 * @returns {Object} {score: number, feedback: string[]}
 */
function checkPasswordStrength(password) {
  const feedback = [];
  let score = 0;

  if (!password || typeof password !== 'string') {
    return { score: 0, feedback: ['Password is required'] };
  }

  // Length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }

  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  // Penalty for common patterns
  const commonPatterns = [
    /^123456/,
    /password/i,
    /qwerty/i,
    /^111111/,
    /^000000/,
    /abc123/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 2);
      feedback.push('Password contains a common pattern');
      break;
    }
  }

  // Cap score at 4
  score = Math.min(4, score);

  // Generate feedback based on what's missing
  if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
  if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special characters');

  return { score, feedback };
}

/**
 * Generate a time-limited token with expiry validation
 * Useful for temporary access tokens, verification codes, etc.
 * @param {string} data - Data to encode in token
 * @param {number} expiryMinutes - Minutes until expiry
 * @returns {string} Token
 */
function generateTimedToken(data, expiryMinutes = 60) {
  const expiry = Date.now() + (expiryMinutes * 60 * 1000);
  const payload = JSON.stringify({ data, expiry });
  const signature = sha256Hash(payload + process.env.JWT_SECRET);
  
  return Buffer.from(`${payload}.${signature}`).toString('base64');
}

/**
 * Verify a timed token
 * @param {string} token - Token to verify
 * @returns {Object|null} Decoded data if valid, null if invalid/expired
 */
function verifyTimedToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [payloadStr, signature] = decoded.split('.');
    
    // Verify signature
    const expectedSignature = sha256Hash(payloadStr + process.env.JWT_SECRET);
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(payloadStr);
    
    // Check expiry
    if (Date.now() > payload.expiry) return null;
    
    return payload.data;
  } catch (err) {
    return null;
  }
}

/**
 * Rate limit helper for tracking attempts by identifier
 * Simple in-memory implementation - consider Redis for production
 */
class SimpleRateLimiter {
  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  /**
   * Check if identifier has exceeded rate limit
   * @param {string} identifier - Unique identifier (IP, email, etc.)
   * @returns {boolean} True if rate limited
   */
  isRateLimited(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];
    
    // Clean up old attempts
    const recentAttempts = userAttempts.filter(timestamp => now - timestamp < this.windowMs);
    
    this.attempts.set(identifier, recentAttempts);
    
    return recentAttempts.length >= this.maxAttempts;
  }

  /**
   * Record an attempt
   * @param {string} identifier - Unique identifier
   */
  recordAttempt(identifier) {
    const now = Date.now();
    const userAttempts = this.attempts.get(identifier) || [];
    userAttempts.push(now);
    this.attempts.set(identifier, userAttempts);
  }

  /**
   * Reset attempts for an identifier
   * @param {string} identifier - Unique identifier
   */
  reset(identifier) {
    this.attempts.delete(identifier);
  }
}

module.exports = {
  generateSecureToken,
  sha256Hash,
  isValidEmail,
  sanitizeInput,
  checkPasswordStrength,
  generateTimedToken,
  verifyTimedToken,
  SimpleRateLimiter,
};
