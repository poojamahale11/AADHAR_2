const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const options = { discriminatorKey: 'role', collection: 'users', timestamps: true };

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    phone: {
      type: String,
      required: function() {
        // Phone is not required for Google OAuth users initially
        return !this.googleId;
      },
      trim: true,
      match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number'],
    },
    passwordHash: { 
      type: String, 
      required: function() {
        // Password not required for Google OAuth users
        return !this.googleId;
      }, 
      select: false 
    },
    googleId: { 
      type: String, 
      sparse: true, 
      unique: true, 
      index: true 
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    isActive: { type: Boolean, default: true },
    profileImage: { type: String, default: null },
  },
  options
);

// role field is added automatically by discriminatorKey, but we also want it
// queryable/readable without touching Mongoose internals, so expose explicitly
// via a virtual-free plain path on each discriminator's own documents (role
// value is set automatically to the discriminator name on creation).

userSchema.methods.comparePassword = async function (candidatePassword) {
  // Google OAuth users don't have passwords
  if (this.authProvider === 'google' || !this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plainPassword) {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  return bcrypt.hash(plainPassword, saltRounds);
};

// Never leak the hash even if select('+passwordHash') was used upstream and
// the doc is serialized directly.
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

// ---------------------------------------------------------------------------
// Donor discriminator
// ---------------------------------------------------------------------------
const Donor = User.discriminator(
  'donor',
  new mongoose.Schema({
    donorType: {
      type: String,
      enum: ['individual', 'hotel', 'business'],
      default: 'individual',
    },
    organizationName: { type: String, trim: true, default: null }, // for hotel/business
    totalDonations: { type: Number, default: 0 },
    leaderboardScore: { type: Number, default: 0 },
    badges: [
      {
        badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge' },
        awardedAt: { type: Date, default: Date.now },
      },
    ],
  })
);

// ---------------------------------------------------------------------------
// Volunteer discriminator
// ---------------------------------------------------------------------------
const Volunteer = User.discriminator(
  'volunteer',
  new mongoose.Schema({
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      address: { type: String, default: null },
    },
    skills: [{ type: String, trim: true }], // for skill-volunteering module
    isApproved: { type: Boolean, default: false }, // NGO admin must approve
    isAvailable: { type: Boolean, default: true },
    availableDay: { type: String, default: 'All Days', trim: true }, // e.g. 'Monday', 'Weekdays', 'All Days'
    availableDate: { type: Date, default: null }, // specific date
    availableStartTime: { type: String, default: '09:00', trim: true }, // '09:00' (24h)
    availableEndTime: { type: String, default: '18:00', trim: true }, // '18:00' (24h)
    avgRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
  })
);

// ---------------------------------------------------------------------------
// NGO Admin discriminator
// ---------------------------------------------------------------------------
const NGOAdmin = User.discriminator(
  'ngo_admin',
  new mongoose.Schema({
    organizationName: { type: String, required: true, trim: true },
    organizationAddress: { type: String, trim: true, default: null },
    upiId: { type: String, required: true, trim: true },
  })
);

// ---------------------------------------------------------------------------
// Elderly couple / household discriminator
// ---------------------------------------------------------------------------
const Elderly = User.discriminator(
  'elderly',
  new mongoose.Schema({
    partnerName: { type: String, required: true, trim: true, maxlength: 100 },
    homeAddress: { type: String, required: true, trim: true, maxlength: 500 },
  })
);

module.exports = { User, Donor, Volunteer, NGOAdmin, Elderly };
