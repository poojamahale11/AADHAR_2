const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    donationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', default: null, index: true },
    foodRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodRequest', default: null, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },

    rating: { type: Number, min: 1, max: 5, required: true },
    category: { type: String, enum: ['good', 'average', 'bad'], required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },

    // Enhanced media support
    photoProof: { type: String, default: null }, // Main delivery proof photo (required)
    additionalPhotos: [{ type: String }], // Additional feedback photos (optional)
    voiceNote: { type: String, default: null },

    // Recipient information (captured at delivery time)
    recipientInfo: {
      type: { type: String, enum: ['elderly_couple', 'other_needy', 'ngo_center'], default: null },
      name: { type: String, trim: true, default: '' },
      feedback: { type: String, trim: true, maxlength: 500, default: '' }, // Direct feedback from recipient
      satisfactionLevel: { type: String, enum: ['very_satisfied', 'satisfied', 'neutral', 'unsatisfied'], default: null },
    },

    // Delivery context
    deliveryNotes: { type: String, trim: true, maxlength: 500, default: '' }, // Volunteer's notes about delivery
    deliveredAt: { type: Date, required: true, default: Date.now },

    // Feedback is collected by the volunteer on behalf of the recipient at
    // the point of delivery (see project spec, Volunteer Dashboard section).
    submittedByVolunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Visibility flags
    visibleToDonor: { type: Boolean, default: true }, // Can donor see this feedback?
    sharedWithDonor: { type: Boolean, default: false }, // Has donor been notified?
    donorViewedAt: { type: Date, default: null }, // When donor viewed the feedback
  },
  { timestamps: true }
);

feedbackSchema.index({ donationId: 1, createdAt: -1 });
feedbackSchema.index({ submittedByVolunteerId: 1, createdAt: -1 });

// Stash whether this was a brand-new document, same pattern as Donation.js —
// post-save hooks don't reliably expose isNew otherwise.
feedbackSchema.pre('save', function (next) {
  this.$locals.wasNew = this.isNew;
  next();
});

feedbackSchema.post('save', async function (doc) {
  if (!doc.$locals.wasNew) return;
  try {
    const { onFeedbackCreated } = require('../utils/volunteerStatsEngine');
    await onFeedbackCreated(doc);
    
    // Notify donor about delivery completion
    const { notifyDonorOfDelivery } = require('../utils/donorNotifications');
    await notifyDonorOfDelivery(doc);
  } catch (err) {
    console.error('[feedback] post-save hooks failed:', err.message);
  }
});

module.exports = mongoose.model('Feedback', feedbackSchema);
