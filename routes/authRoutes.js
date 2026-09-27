const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { signupValidators, loginValidators, handleValidationErrors } = require('../middleware/validators');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/signup', authController.getSignup);
router.post('/signup', authLimiter, signupValidators, handleValidationErrors, authController.postSignup);

router.get('/login', authController.getLogin);
router.post('/login', authLimiter, loginValidators, handleValidationErrors, authController.postLogin);
router.get('/admin/login', authController.getAdminLogin);
router.post('/admin/login', authLimiter, loginValidators, handleValidationErrors, authController.postLogin);

router.post('/logout', authController.logout);
router.get('/logout', authController.logout); // convenience for a simple <a> link

// Password Reset (Forgot Password)
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', passwordResetLimiter, authLimiter, handleValidationErrors, authController.postForgotPassword);
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', passwordResetLimiter, authLimiter, handleValidationErrors, authController.postResetPassword);

// Profile & Personal Information Management
router.get('/profile', requireAuth, asyncHandler(authController.getProfile));
router.post('/profile', requireAuth, asyncHandler(authController.postUpdateProfile));

module.exports = router;
