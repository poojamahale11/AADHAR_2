const mongoose = require('mongoose');

const REQUEST_STATUSES = ['pending', 'assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit', 'delivered', 'cancelled'];
const FOOD_PREFERENCES = ['veg', 'non-veg'];

const foodRequestSchema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    numberOfPeople: { type: Number, required: true, min: 1, max: 20 },
    foodPreference: { type: String, enum: FOOD_PREFERENCES, required: true },
    deliveryAddress: { type: String, required: true, trim: true, maxlength: 500 },
    phone: { type: String, required: true, trim: true },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
    deliveryNote: { type: String, trim: true, maxlength: 500, default: '' },

    // New: Required delivery date/time for sorting and assignment
    requiredDateTime: { type: Date, default: null, index: true }, // When elderly couple needs food
    
    // Location coordinates for mapping
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // Kept for backward compatibility with existing requests
    requirements: { type: String, trim: true, maxlength: 1000, default: '' },

    // Assignment tracking
    assignedVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedByNgoId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedDonationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null }, // Link to assigned donation

    // Lifecycle timestamps
    assignedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    pickupReachedAt: { type: Date, default: null },
    pickedAt: { type: Date, default: null },
    inTransitAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    deliveryProofPhoto: { type: String, default: null },

    // Complete status history for full transparency
    statusHistory: [
      {
        from: { type: String, default: null },
        to: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        actorRole: { type: String, default: null },
        note: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

foodRequestSchema.index({ 'location.lat': 1, 'location.lng': 1 });
foodRequestSchema.index({ status: 1, requiredDateTime: 1 }); // For efficient sorting by required time

foodRequestSchema.statics.STATUSES = REQUEST_STATUSES;
foodRequestSchema.statics.FOOD_PREFERENCES = FOOD_PREFERENCES;

module.exports = mongoose.model('FoodRequest', foodRequestSchema);
