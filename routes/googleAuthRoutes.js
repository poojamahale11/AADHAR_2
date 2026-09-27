const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const { signToken, COOKIE_NAME, getCookieOptions } = require('../utils/jwt');
const { oauthLimiter } = require('../middleware/rateLimiters');

/**
 * Google OAuth Authentication Routes
 * Handles "Continue with Google" login/signup flow
 */

// Initiate Google OAuth flow
router.get(
  '/auth/google',
  oauthLimiter,
  (req, res, next) => {
    // Store the intended destination in session
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo;
    }
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account', // Always show account selector
  })
);

// Google OAuth callback
router.get(
  '/auth/google/callback',
  oauthLimiter,
  passport.authenticate('google', { 
    failureRedirect: '/login?error=google_auth_failed',
    session: false, // We use JWT, not sessions for regular auth
  }),
  async (req, res) => {
    try {
      // User authenticated successfully
      const user = req.user;

      if (!user || !user.isActive) {
        return res.redirect('/login?error=account_inactive');
      }

      // Generate JWT token
      const token = signToken({ id: user._id, role: user.role });
      res.cookie(COOKIE_NAME, token, getCookieOptions());

      console.log(`[google-auth] User logged in via Google: ${user.email}`);

      // Check if user needs to complete profile (missing phone number)
      if (!user.phone || user.phone === '') {
        return res.redirect('/profile?welcome=1&complete=phone');
      }

      // Redirect to appropriate dashboard
      const returnTo = req.session?.returnTo;
      delete req.session?.returnTo;

      if (returnTo && returnTo.startsWith('/')) {
        return res.redirect(returnTo);
      }

      if (user.role === 'volunteer' && !user.isApproved) {
        return res.redirect('/volunteer/pending-approval');
      }

      const dashboardRoute = user.role === 'ngo_admin' ? '/admin/dashboard' : `/${user.role}/dashboard`;
      return res.redirect(dashboardRoute);
    } catch (err) {
      console.error('[google-auth] Callback error:', err);
      return res.redirect('/login?error=auth_failed');
    }
  }
);

// Handle Google auth errors
router.get('/auth/google/error', (req, res) => {
  res.status(401).render('error', {
    title: 'Authentication Failed',
    message: 'Google authentication failed. Please try again or use email/password login.',
  });
});

module.exports = router;
