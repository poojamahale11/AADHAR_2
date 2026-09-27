const rateLimit = require('express-rate-limit');

// Applies to /login and /signup style endpoints. Deliberately generous for
// local dev/testing but still meaningful.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this device. Please wait a few minutes and try again.',
  },
});

// Stricter rate limiter for password reset requests to prevent abuse
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 password reset requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests, not just failed ones
  message: {
    success: false,
    message: 'Too many password reset requests from this device. Please try again later.',
  },
  handler: (req, res) => {
    const isApi = req.originalUrl.startsWith('/api/');
    if (isApi) {
      return res.status(429).json({
        success: false,
        message: 'Too many password reset requests. Please try again in an hour.',
      });
    }
    return res.status(429).render('auth/forgot-password', {
      title: 'Forgot Password',
      errors: ['Too many password reset requests. Please try again in an hour.'],
      success: false,
      formData: req.body || {},
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    });
  },
});

// Rate limiter for OAuth callback endpoints to prevent abuse
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 OAuth attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OAuth authentication attempts. Please try again later.',
  },
});

module.exports = { authLimiter, passwordResetLimiter, oauthLimiter };
