const { verifyToken, COOKIE_NAME } = require('../utils/jwt');
const { User } = require('../models/User');
const { LIONS_CLUB_ADMIN } = require('../utils/lionsClub');

/**
 * Verifies the JWT from the httpOnly cookie and attaches the full user
 * document (minus passwordHash) to req.user. If no valid token is present,
 * checks for Passport session (OAuth). If neither exists, req.user stays 
 * undefined and the request continues — individual routes decide whether 
 * that's acceptable via requireAuth/requireRole.
 */
async function attachUser(req, res, next) {
  try {
    // First, try JWT authentication (existing method)
    const token = req.cookies?.[COOKIE_NAME];
    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id);
        if (user && user.isActive) {
          req.user = user;
          res.locals.currentUser = user; // available in every EJS view
          return next();
        }
      } catch (err) {
        // Invalid/expired JWT token
        res.clearCookie(COOKIE_NAME);
      }
    }

    // Second, check for Passport session (OAuth authentication)
    if (req.isAuthenticated && req.isAuthenticated()) {
      const user = req.user;
      if (user && user.isActive) {
        res.locals.currentUser = user;
        return next();
      }
    }

    // No authentication found - continue as guest
    return next();
  } catch (err) {
    console.error('[auth] attachUser error:', err);
    return next();
  }
}

/** Blocks the request unless a valid logged-in user is attached. */
function requireAuth(req, res, next) {
  if (!req.user) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }
    return res.redirect('/login');
  }
  return next();
}

/**
 * Restricts a route to one or more roles, e.g. requireRole('ngo_admin')
 * or requireRole('ngo_admin', 'volunteer').
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Please log in to continue.' });
      }
      return res.redirect('/login');
    }
    const isOnlyPermittedNgoAdmin =
      req.user.role !== 'ngo_admin' || req.user.email === LIONS_CLUB_ADMIN.email;

    if (!roles.includes(req.user.role) || !isOnlyPermittedNgoAdmin) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(403).json({ success: false, message: 'You do not have access to this resource.' });
      }
      return res.status(403).render('error', {
        title: 'Access denied',
        message: "You don't have permission to view this page.",
      });
    }
    return next();
  };
}

/**
 * Logout helper that clears both JWT cookies and Passport sessions
 * Use this in logout routes to ensure complete logout for all auth types
 */
function performLogout(req, res, callback) {
  // Clear JWT cookie
  res.clearCookie(COOKIE_NAME);
  
  // Clear Passport session if it exists
  if (req.logout) {
    req.logout((err) => {
      if (err) {
        console.error('[auth] Passport logout error:', err);
      }
      // Destroy session completely
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error('[auth] Session destroy error:', err);
          }
          callback();
        });
      } else {
        callback();
      }
    });
  } else {
    callback();
  }
}

module.exports = { attachUser, requireAuth, requireRole, performLogout };
