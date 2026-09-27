const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User, Donor } = require('../models/User');

/**
 * Configure Passport.js with Google OAuth 2.0 Strategy
 * Handles user authentication via Google Sign-In
 */

// Serialize user ID into session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth Strategy Configuration
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user information from Google profile
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          const name = profile.displayName || 'Google User';
          const googleId = profile.id;
          const profileImage = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          // Check if user already exists by Google ID
          let user = await User.findOne({ googleId });

          if (user) {
            // User exists with this Google ID - log them in
            return done(null, user);
          }

          // Check if user exists with this email (local account)
          user = await User.findOne({ email: email.toLowerCase() });

          if (user) {
            // Link Google account to existing local account
            if (!user.googleId) {
              user.googleId = googleId;
              user.authProvider = 'google';
              if (profileImage && !user.profileImage) {
                user.profileImage = profileImage;
              }
              await user.save();
              console.log(`[passport] Linked Google account to existing user: ${email}`);
            }
            return done(null, user);
          }

          // Create new user with Google OAuth
          // Default to 'donor' role for new Google sign-ups
          const newUser = await Donor.create({
            name,
            email: email.toLowerCase(),
            googleId,
            authProvider: 'google',
            profileImage,
            phone: '', // Will need to be added later
            donorType: 'individual',
          });

          console.log(`[passport] Created new Google OAuth user: ${email}`);
          return done(null, newUser);
        } catch (err) {
          console.error('[passport] Google OAuth error:', err);
          return done(err, null);
        }
      }
    )
  );

  console.log('[passport] Google OAuth strategy configured');
} else {
  console.warn('[passport] Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

module.exports = passport;
