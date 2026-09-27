/**
 * Email service utility for AADHAR.
 * Handles dispatching transactional notification emails, including delivery OTPs.
 * Supports SMTP configuration via environment variables with a safe fallback logger.
 */

async function sendDeliveryOtpEmail({ toEmail, recipientName, otp, foodRequest, task }) {
  if (!toEmail) {
    console.warn('[email] No recipient email provided for delivery OTP notification.');
    return false;
  }

  const subject = 'AADHAR: Your Food Delivery Verification OTP';
  const requirements = foodRequest?.requirements ? ` "${foodRequest.requirements}"` : '';
  const plainText = [
    `Namaste ${recipientName || 'Resident'},`,
    '',
    `Your food request${requirements} is currently on its way to you!`,
    '',
    `Your Delivery Verification OTP is: ${otp}`,
    '',
    'Please share this 6-digit OTP with the AADHAR volunteer ONLY when you receive your food delivery in hand.',
    'Do not share this OTP over the phone or with anyone before receiving your delivery.',
    '',
    'Thank you for trusting AADHAR — The Soul Serves.',
  ].join('\n');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">AADHAR</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">The Soul Serves · Food Support</p>
      </div>
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 6px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Namaste <strong>${recipientName || 'Resident'}</strong>,</p>
        <p style="color: #334155; line-height: 1.5;">Your food request${requirements ? ` (<em>${requirements}</em>)` : ''} has been picked up and is on its way to your address.</p>
        <div style="text-align: center; margin: 25px 0;">
          <span style="display: inline-block; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 6px;">Your Delivery Verification OTP</span>
          <div style="font-family: monospace, Courier, sans-serif; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a; background: #ffffff; padding: 12px 24px; border: 2px dashed #cbd5e1; border-radius: 8px; display: inline-block;">
            ${otp}
          </div>
          <p style="color: #dc2626; font-size: 13px; margin-top: 8px; font-weight: 500;">Valid for this delivery confirmation only</p>
        </div>
        <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
          <strong>Important:</strong> Please provide this OTP to your delivery volunteer only after you have physically received your food package.
        </p>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from AADHAR. Please do not reply to this email.
      </p>
    </div>
  `;

  // Check if SMTP configuration is present
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const fromAddress = process.env.EMAIL_FROM || '"AADHAR Community Support" <noreply@aadhar.org>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(`[email] SMTP configuration is missing. Delivery OTP notification could not be emailed to <${toEmail}>.`);
    return false;
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    console.warn(`[email] Nodemailer is not installed. Delivery OTP notification could not be emailed to <${toEmail}>.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: plainText,
      html: htmlContent,
    });

    return true;
  } catch (err) {
    console.error(`[email] Failed to deliver OTP email to <${toEmail}>:`, err.message);
    return false;
  }
}

/**
 * Send a password reset email with a secure reset link
 * @param {Object} options - Email options
 * @param {string} options.toEmail - Recipient email address
 * @param {string} options.recipientName - Recipient's name
 * @param {string} options.resetToken - Secure reset token
 * @param {string} options.resetUrl - Full reset URL
 * @returns {Promise<boolean>} True if email sent successfully
 */
async function sendPasswordResetEmail({ toEmail, recipientName, resetToken, resetUrl }) {
  if (!toEmail) {
    console.warn('[email] No recipient email provided for password reset.');
    return false;
  }

  if (!resetToken || !resetUrl) {
    console.warn('[email] Missing reset token or URL for password reset email.');
    return false;
  }

  const subject = 'AADHAR: Reset Your Password';
  const plainText = [
    `Hello ${recipientName || 'User'},`,
    '',
    'We received a request to reset your AADHAR account password.',
    '',
    `To reset your password, please click the following link or copy it into your browser:`,
    resetUrl,
    '',
    'This link will expire in 1 hour for security reasons.',
    '',
    'If you did not request a password reset, please ignore this email. Your password will remain unchanged.',
    '',
    'For security reasons, never share this link with anyone.',
    '',
    'Best regards,',
    'AADHAR — The Soul Serves',
  ].join('\n');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 24px;">AADHAR</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">The Soul Serves</p>
      </div>
      
      <div style="padding: 20px; background-color: #f8fafc; border-radius: 6px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">Hello <strong>${recipientName || 'User'}</strong>,</p>
        
        <p style="color: #334155; line-height: 1.5;">
          We received a request to reset the password for your AADHAR account. If you made this request, click the button below to set a new password:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);">
            Reset My Password
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 0;">
          Or copy and paste this URL into your browser:<br>
          <a href="${resetUrl}" style="color: #dc2626; word-break: break-all;">${resetUrl}</a>
        </p>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
          <p style="color: #dc2626; font-size: 13px; margin: 0; font-weight: 600;">⏱️ This link expires in 1 hour</p>
        </div>
      </div>
      
      <div style="background-color: #fef2f2; border-left: 3px solid #dc2626; padding: 12px 16px; margin-bottom: 20px;">
        <p style="color: #475569; font-size: 13px; margin: 0; line-height: 1.4;">
          <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged. Someone may have entered your email address by mistake.
        </p>
      </div>
      
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from AADHAR. Please do not reply to this email.
      </p>
    </div>
  `;

  // Check if SMTP configuration is present
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const fromAddress = process.env.EMAIL_FROM || '"AADHAR Community Support" <noreply@aadhar.org>';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn(`[email] SMTP configuration is missing. Password reset email could not be sent to <${toEmail}>.`);
    return false;
  }

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (err) {
    console.warn(`[email] Nodemailer is not installed. Password reset email could not be sent to <${toEmail}>.`);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: plainText,
      html: htmlContent,
    });

    console.log(`[email] Password reset email sent successfully to <${toEmail}>`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send password reset email to <${toEmail}>:`, err.message);
    return false;
  }
}

module.exports = { sendDeliveryOtpEmail, sendPasswordResetEmail };


/**
 * Send delivery completion notification to donor
 * Includes feedback, photos, and recipient details
 */
async function sendDeliveryCompletionEmail({ 
  toEmail, 
  donorName, 
  donationCode, 
  donationType,
  quantity,
  unit,
  recipientName, 
  recipientType,
  deliveryAddress,
  deliveredAt,
  volunteerName,
  rating,
  category,
  comment,
  recipientFeedback,
  photoProof,
  voiceNote,
  feedbackId
}) {
  if (!toEmail) {
    console.warn('[email] No donor email provided for delivery completion notification.');
    return false;
  }

  const subject = `🎉 Your Donation ${donationCode} Has Been Delivered!`;
  
  const deliveryDate = new Date(deliveredAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const ratingStars = '⭐'.repeat(rating);
  const categoryEmoji = {
    'good': '😊',
    'average': '🙂',
    'bad': '😐'
  }[category] || '😊';

  const plainText = [
    `Dear ${donorName},`,
    '',
    `Wonderful news! Your donation ${donationCode} has been successfully delivered.`,
    '',
    `🎁 Donation Details:`,
    `   • Type: ${donationType}`,
    `   • Quantity: ${quantity} ${unit || ''}`,
    `   • Code: ${donationCode}`,
    '',
    `📍 Delivery Information:`,
    `   • Recipient: ${recipientName} (${recipientType})`,
    `   • Location: ${deliveryAddress}`,
    `   • Delivered: ${deliveryDate}`,
    `   • Volunteer: ${volunteerName}`,
    '',
    `⭐ Delivery Feedback:`,
    `   • Rating: ${ratingStars} (${rating}/5)`,
    `   • Category: ${category} ${categoryEmoji}`,
    comment ? `   • Comment: ${comment}` : '',
    recipientFeedback ? `   • Recipient says: "${recipientFeedback}"` : '',
    '',
    'Your generosity has made a real difference in someone\'s life. Thank you for being a part of the AADHAR community!',
    '',
    'View full delivery details including photos in your donor dashboard.',
    '',
    'With gratitude,',
    'Team AADHAR — The Soul Serves',
  ].filter(Boolean).join('\n');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 28px;">🎉 Delivery Successful!</h2>
        <p style="color: #64748b; font-size: 14px; margin: 8px 0 0 0;">AADHAR — The Soul Serves</p>
      </div>
      
      <div style="padding: 20px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #1e293b; margin: 0;">Dear <strong>${donorName}</strong>,</p>
        <p style="color: #334155; line-height: 1.6; margin: 12px 0 0 0;">
          Your donation <strong>${donationCode}</strong> has reached its destination and brought joy to those in need. Thank you for making a difference!
        </p>
      </div>

      <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="color: #0f172a; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          📦 Donation Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Type:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${donationType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Quantity:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${quantity} ${unit || ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Donation Code:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${donationCode}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="color: #0f172a; font-size: 18px; margin: 0 0 15px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
          📍 Delivery Information
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Recipient:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${recipientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Type:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${recipientType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Location:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${deliveryAddress}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Delivered:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${deliveryDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Volunteer:</td>
            <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right;">${volunteerName}</td>
          </tr>
        </table>
      </div>

      <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; border-left: 4px solid #f59e0b; margin-bottom: 20px;">
        <h3 style="color: #0f172a; font-size: 18px; margin: 0 0 15px 0;">
          ⭐ Delivery Feedback
        </h3>
        <div style="text-align: center; margin: 15px 0;">
          <div style="font-size: 32px; line-height: 1;">${ratingStars}</div>
          <div style="color: #64748b; font-size: 14px; margin-top: 5px;">${rating} out of 5 stars</div>
        </div>
        <div style="background-color: #ffffff; padding: 15px; border-radius: 4px; margin-top: 15px;">
          <p style="margin: 0; color: #334155; line-height: 1.5;">
            <strong>Category:</strong> <span style="text-transform: capitalize;">${category}</span> ${categoryEmoji}
          </p>
          ${comment ? `<p style="margin: 10px 0 0 0; color: #334155; line-height: 1.5;"><strong>Volunteer's Note:</strong><br>"${comment}"</p>` : ''}
          ${recipientFeedback ? `<p style="margin: 10px 0 0 0; color: #334155; line-height: 1.5;"><strong>Recipient's Feedback:</strong><br>"${recipientFeedback}"</p>` : ''}
        </div>
        ${photoProof || voiceNote ? `
          <div style="margin-top: 15px; padding: 10px; background-color: #ffffff; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px; font-weight: 600;">Delivery Media:</p>
            ${photoProof ? '<p style="margin: 4px 0; color: #334155; font-size: 14px;">📸 Photo proof available</p>' : ''}
            ${voiceNote ? '<p style="margin: 4px 0; color: #334155; font-size: 14px;">🎤 Voice note available</p>' : ''}
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; margin: 30px 0 20px 0;">
        <a href="${process.env.BASE_URL || 'http://localhost:3000'}/donor/donations/${donationCode}" 
           style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
          View Full Delivery Details
        </a>
      </div>

      <div style="background-color: #ecfdf5; padding: 15px; border-radius: 6px; margin-top: 20px;">
        <p style="color: #065f46; font-size: 14px; line-height: 1.6; margin: 0; text-align: center;">
          <strong>🙏 Your kindness matters!</strong><br>
          Thank you for being a valued member of the AADHAR community. Together, we're making a difference.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 20px 0 0 0; line-height: 1.5;">
        This is an automated notification from AADHAR. For any questions, please visit your donor dashboard or contact our support team.
      </p>
    </div>
  `;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const fromAddress = process.env.EMAIL_FROM || 'noreply@aadhar.org';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log('[email] SMTP not configured, logging delivery completion email:');
    console.log(`  To: ${toEmail}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Donation: ${donationCode} delivered to ${recipientName}`);
    return false;
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort == 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: plainText,
      html: htmlContent,
    });
    console.log(`[email] Delivery completion email sent successfully to <${toEmail}>`);
    return true;
  } catch (err) {
    console.error(`[email] Failed to send delivery completion email to <${toEmail}>:`, err.message);
    return false;
  }
}

module.exports.sendDeliveryCompletionEmail = sendDeliveryCompletionEmail;
