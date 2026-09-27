const mongoose = require('mongoose');
const { generateOtp } = require('../utils/otp');

const TASK_STATUSES = ['assigned', 'accepted', 'rejected', 'pickup_reached', 'picked', 'in_transit', 'delivered'];

const taskSchema = new mongoose.Schema(
  {
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null, index: true },
    foodRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRequest', default: null, index: true },
    beneficiaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ngoAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    pickupLocation: {
      address: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    
    // Delivery location - can be elderly couple, NGO center, or custom recipient
    deliveryLocation: {
      address: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // New: Custom recipient details for "Other Needy People"
    customRecipient: {
      name: { type: String, trim: true, default: null },
      contactPerson: { type: String, trim: true, default: null },
      phone: { type: String, trim: true, default: null },
    },

    // New: Real-time tracking data
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      lastUpdated: { type: Date, default: null },
    },

    estimatedArrivalTime: { type: Date, default: null },
    routeDistance: { type: Number, default: null }, // in kilometers
    routeDuration: { type: Number, default: null }, // in minutes

    status: { type: String, enum: TASK_STATUSES, default: 'assigned', index: true },

    acceptedAt: { type: Date, default: null },
    pickupReachedAt: { type: Date, default: null },
    pickedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    // Generated at assignment time, entered by the volunteer at drop-off to
    // confirm the delivery actually reached the recipient (Transparency
    // System — see project spec, NGO Admin Dashboard section 4).
    deliveryOtp: { type: String, required: true },
    deliveryOtpExpiresAt: { type: Date, default: null },
    deliveryOtpVerified: { type: Boolean, default: false },
    proofPhoto: { type: String, default: null },
  },
  { timestamps: true }
);

taskSchema.pre('validate', function (next) {
  if (!this.donationId && !this.foodRequestId) return next(new Error('A task must reference a donation or food request.'));
  if (this.donationId && this.foodRequestId) return next(new Error('A task cannot reference both a donation and food request.'));
  next();
});

taskSchema.statics.STATUSES = TASK_STATUSES;

taskSchema.statics.createForDonation = async function ({ 
  donation, 
  volunteerId, 
  ngoId, 
  beneficiaryId, 
  deliveryAddress, 
  deliveryLat, 
  deliveryLng,
  customRecipient = null
}) {
  return this.create({
    donationId: donation._id,
    beneficiaryId,
    volunteerId,
    ngoAssignedBy: ngoId,
    pickupLocation: donation.pickupLocation,
    deliveryLocation: {
      address: deliveryAddress,
      lat: deliveryLat ?? null,
      lng: deliveryLng ?? null,
    },
    customRecipient: customRecipient || {},
    deliveryOtp: generateOtp(),
  });
};

taskSchema.statics.createForFoodRequest = async function ({ request, volunteerId, ngoId }) {
  return this.create({
    foodRequestId: request._id,
    beneficiaryId: request.householdId,
    volunteerId,
    ngoAssignedBy: ngoId,
    pickupLocation: { address: 'Lions Club food collection point' },
    deliveryLocation: {
      address: request.deliveryAddress,
      lat: request.location?.lat ?? null,
      lng: request.location?.lng ?? null,
    },
    deliveryOtp: generateOtp(),
  });
};

module.exports = mongoose.model('Task', taskSchema);
