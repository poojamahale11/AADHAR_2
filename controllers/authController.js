const { User, Donor, Volunteer, Elderly } = require('../models/User');
const { signToken, COOKIE_NAME, getCookieOptions } = require('../utils/jwt');
const verifyRecaptcha = require('../utils/verifyRecaptcha');
const { LIONS_CLUB_ADMIN, getLionsClubAdmin } = require('../utils/lionsClub');

async function renderSignupWithErrors(req, res, messages) {
  return res.status(400).render('auth/signup', {
    title: 'Sign Up',
    errors: messages,
    formData: req.body,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  });
}

function renderLoginWithErrors(req, res, messages) {
  const adminOnly = req.originalUrl.startsWith('/admin/login');
  return res.status(400).render('auth/login', {
    title: adminOnly ? 'Lions Club Admin Login' : 'Log In',
    errors: messages,
    formData: req.body,
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly,
    loginAction: adminOnly ? '/admin/login' : '/login',
  });
}

// GET /signup
exports.getSignup = async (req, res) => {
  const selectedRole = ['donor', 'volunteer', 'elderly'].includes(req.query.role) ? req.query.role : 'donor';
  res.render('auth/signup', {
    title: 'Sign Up',
    errors: null,
    formData: { role: selectedRole },
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    selectedRole,
  });
};

// GET /login
exports.getLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Log In',
    errors: null,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly: false,
    loginAction: '/login',
    passwordReset: req.query.passwordReset === '1',
  });
};

// Lions Club's management account has a dedicated entry point. Donors and
// volunteers continue to use the regular login.
exports.getAdminLogin = (req, res) => {
  res.render('auth/login', {
    title: 'Lions Club Admin Login',
    errors: null,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    adminOnly: true,
    loginAction: '/admin/login',
    passwordReset: false,
  });
};

// POST /signup
exports.postSignup = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');

  if (req.validationErrors) {
    return renderSignupWithErrors(req, res, req.validationErrors);
  }

  try {
    const { name, email, phone, password, role, donorType, organizationName, skills, partnerName, homeAddress } = req.body;

    const captchaOk = await verifyRecaptcha(req.body['g-recaptcha-response']);
    if (!captchaOk) {
      const msg = 'CAPTCHA verification failed. Please try again.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const existing = await User.findOne({ email });
    if (existing) {
      const msg = 'An account with this email already exists.';
      return isApi
        ? res.status(409).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const passwordHash = await User.hashPassword(password);

    let user;
    if (role === 'donor') {
      user = await Donor.create({
        name,
        email,
        phone,
        passwordHash,
        donorType: donorType || 'individual',
        organizationName: donorType && donorType !== 'individual' ? organizationName : null,
      });
    } else if (role === 'volunteer') {
      const lionsClubAdmin = await getLionsClubAdmin('_id');
      if (!lionsClubAdmin) {
        const msg = 'Lions Club administration has not been configured yet.';
        return isApi
          ? res.status(400).json({ success: false, message: msg })
          : renderSignupWithErrors(req, res, [msg]);
      }

      user = await Volunteer.create({
        name,
        email,
        phone,
        passwordHash,
        ngoId: lionsClubAdmin._id,
        skills: skills ? String(skills).split(',').map((s) => s.trim()).filter(Boolean) : [],
        isApproved: false, // requires NGO admin approval before taking tasks
      });
    } else if (role === 'elderly') {
      user = await Elderly.create({
        name,
        email,
        phone,
        passwordHash,
        partnerName,
        homeAddress,
      });
    } else {
      const msg = 'Invalid role selected.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderSignupWithErrors(req, res, [msg]);
    }

    const token = signToken({ id: user._id, role: user.role });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    if (role === 'volunteer') {
      const { emitNewVolunteerSignup } = require('../sockets');
      emitNewVolunteerSignup(user);
    }

    if (isApi) {
      return res.status(201).json({ success: true, user: { id: user._id, name: user.name, role: user.role } });
    }

    if (role === 'volunteer') {
      return res.redirect('/volunteer/pending-approval');
    }
    return res.redirect(`/${role === 'ngo_admin' ? 'admin' : role}/dashboard`);
  } catch (err) {
    console.error('[auth] signup error:', err);
    const msg = 'Something went wrong while creating your account. Please try again.';
    return isApi
      ? res.status(500).json({ success: false, message: msg })
      : renderSignupWithErrors(req, res, [msg]);
  }
};

// POST /login
exports.postLogin = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');
  const adminOnly = req.originalUrl.startsWith('/admin/login');

  if (req.validationErrors) {
    return renderLoginWithErrors(req, res, req.validationErrors);
  }

  try {
    const { email, password } = req.body;

    const captchaOk = await verifyRecaptcha(req.body['g-recaptcha-response']);
    if (!captchaOk) {
      const msg = 'CAPTCHA verification failed. Please try again.';
      return isApi
        ? res.status(400).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    // The admin route is deliberately not a general NGO-admin login. There is
    // one provisioned Lions Club account and its credentials are fixed.
    if (adminOnly && (email !== LIONS_CLUB_ADMIN.email || password !== LIONS_CLUB_ADMIN.password)) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const user = adminOnly
      ? await getLionsClubAdmin('+passwordHash')
      : await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.isActive) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      const msg = 'Invalid email or password.';
      return isApi
        ? res.status(401).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    if (adminOnly && user.role !== 'ngo_admin') {
      const msg = 'This login is reserved for the Lions Club administrator.';
      return isApi
        ? res.status(403).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    if (!adminOnly && user.role === 'ngo_admin') {
      const msg = 'Please use the Lions Club Admin Login to access this account.';
      return isApi
        ? res.status(403).json({ success: false, message: msg })
        : renderLoginWithErrors(req, res, [msg]);
    }

    const token = signToken({ id: user._id, role: user.role });
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    if (isApi) {
      return res.json({ success: true, user: { id: user._id, name: user.name, role: user.role } });
    }

    if (user.role === 'volunteer' && !user.isApproved) {
      return res.redirect('/volunteer/pending-approval');
    }
    return res.redirect(`/${user.role === 'ngo_admin' ? 'admin' : user.role}/dashboard`);
  } catch (err) {
    console.error('[auth] login error:', err);
    const msg = 'Something went wrong while logging in. Please try again.';
    return isApi
      ? res.status(500).json({ success: false, message: msg })
      : renderLoginWithErrors(req, res, [msg]);
  }
};

// POST /logout
exports.logout = (req, res) => {
  const { performLogout } = require('../middleware/auth');
  const isApi = req.originalUrl.startsWith('/api/');
  
  performLogout(req, res, () => {
    if (isApi) {
      return res.json({ success: true });
    }
    return res.redirect('/login');
  });
};

// ---------------------------------------------------------------------------
// Password Reset (Forgot Password Flow)
// ---------------------------------------------------------------------------

// GET /forgot-password
exports.getForgotPassword = (req, res) => {
  res.render('auth/forgot-password', {
    title: 'Forgot Password',
    errors: null,
    success: false,
    formData: {},
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
  });
};

// POST /forgot-password
exports.postForgotPassword = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');
  const { email } = req.body;

  if (req.validationErrors) {
    if (isApi) {
      return res.status(400).json({ success: false, errors: req.validationErrors });
    }
    return res.status(400).render('auth/forgot-password', {
      title: 'Forgot Password',
      errors: req.validationErrors,
      success: false,
      formData: req.body,
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    });
  }

  try {
    const captchaOk = await verifyRecaptcha(req.body['g-recaptcha-response']);
    if (!captchaOk) {
      const msg = 'CAPTCHA verification failed. Please try again.';
      if (isApi) {
        return res.status(400).json({ success: false, message: msg });
      }
      return res.status(400).render('auth/forgot-password', {
        title: 'Forgot Password',
        errors: [msg],
        success: false,
        formData: req.body,
        recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
      });
    }

    // Always show success message to prevent email enumeration attacks
    // Even if email doesn't exist, we display success for security
    const successMessage = 'If an account exists with that email address, you will receive password reset instructions shortly.';

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (user && user.isActive) {
      // User exists, create token and send email
      const { createPasswordResetToken } = require('../utils/passwordReset');
      const { sendPasswordResetEmail } = require('../utils/email');

      const { token } = await createPasswordResetToken(user._id);
      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

      await sendPasswordResetEmail({
        toEmail: user.email,
        recipientName: user.name,
        resetToken: token,
        resetUrl,
      });

      console.log(`[auth] Password reset email sent to <${user.email}>`);
    } else {
      // User doesn't exist or is inactive - don't reveal this information
      console.log(`[auth] Password reset requested for non-existent email: ${email}`);
    }

    if (isApi) {
      return res.json({ success: true, message: successMessage });
    }

    return res.render('auth/forgot-password', {
      title: 'Forgot Password',
      errors: null,
      success: true,
      successMessage,
      formData: {},
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    });
  } catch (err) {
    console.error('[auth] forgot password error:', err);
    const msg = 'Something went wrong. Please try again.';
    if (isApi) {
      return res.status(500).json({ success: false, message: msg });
    }
    return res.status(500).render('auth/forgot-password', {
      title: 'Forgot Password',
      errors: [msg],
      success: false,
      formData: req.body,
      recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY,
    });
  }
};

// GET /reset-password
exports.getResetPassword = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).render('auth/reset-password', {
      title: 'Reset Password',
      errors: ['Invalid or missing reset token.'],
      validToken: false,
      token: null,
    });
  }

  try {
    const { verifyResetToken } = require('../utils/passwordReset');
    const resetDoc = await verifyResetToken(token);

    if (!resetDoc) {
      return res.status(400).render('auth/reset-password', {
        title: 'Reset Password',
        errors: ['This password reset link is invalid or has expired.'],
        validToken: false,
        token: null,
      });
    }

    res.render('auth/reset-password', {
      title: 'Reset Password',
      errors: null,
      validToken: true,
      token,
      userName: resetDoc.userId.name,
    });
  } catch (err) {
    console.error('[auth] reset password verification error:', err);
    return res.status(500).render('auth/reset-password', {
      title: 'Reset Password',
      errors: ['An error occurred. Please try again.'],
      validToken: false,
      token: null,
    });
  }
};

// POST /reset-password
exports.postResetPassword = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');
  const { token, newPassword, confirmPassword } = req.body;

  // Validation
  const errors = [];

  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    errors.push('Reset token is required.');
  }

  if (!newPassword || newPassword.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  if (!confirmPassword) {
    errors.push('Please confirm your password.');
  }

  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  // Password strength validation
  if (newPassword && newPassword.length >= 8) {
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    
    if (!hasLetter || !hasNumber) {
      errors.push('Password should contain both letters and numbers for better security.');
    }
  }

  if (errors.length > 0) {
    if (isApi) {
      return res.status(400).json({ success: false, errors });
    }
    return res.status(400).render('auth/reset-password', {
      title: 'Reset Password',
      errors,
      validToken: true,
      token: token || '',
    });
  }

  try {
    const { verifyResetToken } = require('../utils/passwordReset');
    const resetDoc = await verifyResetToken(token);

    if (!resetDoc) {
      const msg = 'This password reset link is invalid, has expired, or has already been used. Please request a new reset link.';
      if (isApi) {
        return res.status(400).json({ success: false, message: msg });
      }
      return res.status(400).render('auth/reset-password', {
        title: 'Reset Password',
        errors: [msg],
        validToken: false,
        token: null,
      });
    }

    // Update user password
    const user = await User.findById(resetDoc.userId._id).select('+passwordHash');
    if (!user || !user.isActive) {
      const msg = 'User account not found or inactive.';
      if (isApi) {
        return res.status(404).json({ success: false, message: msg });
      }
      return res.status(404).render('auth/reset-password', {
        title: 'Reset Password',
        errors: [msg],
        validToken: false,
        token: null,
      });
    }

    // Hash and save new password
    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    // Mark token as used to prevent reuse
    await resetDoc.markAsUsed();

    console.log(`[auth] Password successfully reset for user: ${user.email}`);

    if (isApi) {
      return res.json({ 
        success: true, 
        message: 'Password reset successful. You can now log in with your new password.' 
      });
    }

    // Redirect to login with success message
    return res.redirect('/login?passwordReset=1');
  } catch (err) {
    console.error('[auth] reset password error:', err);
    const msg = 'Something went wrong while resetting your password. Please try again or request a new reset link.';
    if (isApi) {
      return res.status(500).json({ success: false, message: msg });
    }
    return res.status(500).render('auth/reset-password', {
      title: 'Reset Password',
      errors: [msg],
      validToken: false,
      token: null,
    });
  }
};

// ---------------------------------------------------------------------------
// Profile & Personal Information Management
// ---------------------------------------------------------------------------

// GET /profile
exports.getProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.redirect('/login');

  let rawDateValue = '';
  if (user.role === 'volunteer' && user.availableDate) {
    try {
      rawDateValue = new Date(user.availableDate).toISOString().split('T')[0];
    } catch (e) {}
  }

  res.render('auth/profile', {
    title: 'Edit Profile & Personal Information',
    user,
    errors: null,
    success: req.query.updated === '1',
    passwordSuccess: req.query.pwUpdated === '1',
    rawDateValue,
  });
};

// POST /profile
exports.postUpdateProfile = async (req, res) => {
  const isApi = req.originalUrl.startsWith('/api/');
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) {
    return isApi
      ? res.status(404).json({ success: false, message: 'User not found.' })
      : res.redirect('/login');
  }

  const {
    name,
    email,
    phone,
    // Donor fields
    donorType,
    organizationName,
    // Volunteer fields
    address,
    skills,
    availableDay,
    availableDate,
    availableStartTime,
    availableEndTime,
    isAvailable,
    // NGO Admin fields
    organizationAddress,
    upiId,
    // Elderly fields
    partnerName,
    homeAddress,
    // Password change fields
    currentPassword,
    newPassword,
    confirmPassword,
  } = req.body;

  const errors = [];

  // 1. Basic validation
  if (!name || name.trim().length === 0) {
    errors.push('Full Name is required.');
  } else if (name.trim().length > 100) {
    errors.push('Full Name cannot exceed 100 characters.');
  }

  if (!phone || !/^[0-9]{10}$/.test(phone.trim())) {
    errors.push('Please enter a valid 10-digit phone number.');
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    errors.push('Please enter a valid email address.');
  } else {
    const existing = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: user._id } });
    if (existing) {
      errors.push('That email address is already in use by another account.');
    }
  }

  // 2. Password change validation (if attempted)
  let updatePassword = false;
  if (currentPassword || newPassword || confirmPassword) {
    if (!currentPassword) {
      errors.push('Current password is required to set a new password.');
    } else {
      const match = await user.comparePassword(currentPassword);
      if (!match) {
        errors.push('Current password entered is incorrect.');
      }
    }

    if (!newPassword || newPassword.length < 8) {
      errors.push('New password must be at least 8 characters long.');
    } else if (newPassword !== confirmPassword) {
      errors.push('New password and confirm password do not match.');
    } else {
      updatePassword = true;
    }
  }

  if (errors.length > 0) {
    if (isApi) {
      return res.status(400).json({ success: false, errors });
    }
    let rawDateValue = '';
    if (user.role === 'volunteer' && (availableDate || user.availableDate)) {
      try {
        rawDateValue = availableDate || new Date(user.availableDate).toISOString().split('T')[0];
      } catch (e) {}
    }
    return res.status(400).render('auth/profile', {
      title: 'Edit Profile & Personal Information',
      user: { ...user.toObject(), ...req.body, location: { ...(user.location || {}), address } },
      errors,
      success: false,
      passwordSuccess: false,
      rawDateValue,
    });
  }

  // 3. Apply common field updates
  user.name = name.trim();
  user.phone = phone.trim();
  user.email = email.trim().toLowerCase();

  // 4. Apply role-specific updates
  if (user.role === 'donor') {
    if (donorType && ['individual', 'hotel', 'business'].includes(donorType)) {
      user.donorType = donorType;
    }
    user.organizationName = donorType !== 'individual' && organizationName ? organizationName.trim() : null;
  } else if (user.role === 'volunteer') {
    if (!user.location) user.location = {};
    if (address !== undefined) user.location.address = address ? address.trim() : null;
    if (skills !== undefined) {
      user.skills = skills
        ? String(skills)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    }
    if (availableDay !== undefined) user.availableDay = availableDay.trim() || 'All Days';
    if (availableDate !== undefined) {
      user.availableDate = availableDate && availableDate.trim() !== '' ? new Date(availableDate) : null;
    }
    if (availableStartTime !== undefined) user.availableStartTime = availableStartTime.trim() || '09:00';
    if (availableEndTime !== undefined) user.availableEndTime = availableEndTime.trim() || '18:00';
    if (isAvailable !== undefined) {
      user.isAvailable = isAvailable === 'true' || isAvailable === true || isAvailable === 'on' || isAvailable === '1';
    }
  } else if (user.role === 'ngo_admin') {
    if (organizationName && organizationName.trim()) user.organizationName = organizationName.trim();
    if (organizationAddress !== undefined) user.organizationAddress = organizationAddress.trim();
    if (upiId && upiId.trim()) user.upiId = upiId.trim();
  } else if (user.role === 'elderly') {
    if (partnerName && partnerName.trim()) user.partnerName = partnerName.trim();
    if (homeAddress && homeAddress.trim()) user.homeAddress = homeAddress.trim();
  }

  // 5. Apply password update if requested
  if (updatePassword) {
    user.passwordHash = await User.hashPassword(newPassword);
  }

  await user.save();

  if (isApi) {
    return res.json({ success: true, message: 'Profile updated successfully.' });
  }

  const queryParam = updatePassword ? 'updated=1&pwUpdated=1' : 'updated=1';
  res.redirect(`/profile?${queryParam}`);
};
