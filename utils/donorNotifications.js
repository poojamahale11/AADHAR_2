/**
 * Donor Notifications - Notify donors about delivery completion
 */

const Donation = require('../models/Donation');
const Task = require('../models/Task');
const { User } = require('../models/User');
const FoodRequest = require('../models/FoodRequest');
const { sendDeliveryCompletionEmail } = require('./email');
const { emitDonorNotification } = require('../sockets');

/**
 * Notify donor when their donation has been successfully delivered
 * Called automatically when feedback is created after delivery
 */
async function notifyDonorOfDelivery(feedback) {
  try {
    if (!feedback.donationId) {
      console.log('[donorNotifications] No donation linked to feedback, skipping donor notification');
      return;
    }

    // Fetch complete donation details
    const donation = await Donation.findById(feedback.donationId)
      .populate('donorId', 'name email phone')
      .populate('assignedVolunteerId', 'name phone');

    if (!donation || !donation.donorId) {
      console.log('[donorNotifications] Donation or donor not found');
      return;
    }

    // Fetch task and recipient details
    const task = await Task.findById(feedback.taskId)
      .populate('beneficiaryId', 'name partnerName phone homeAddress');

    if (!task) {
      console.log('[donorNotifications] Task not found');
      return;
    }

    // Determine recipient details
    let recipientName = 'Recipient';
    let recipientType = 'Unknown';
    let deliveryAddress = task.deliveryLocation?.address || 'Unknown location';

    if (donation.recipientType === 'elderly_couple' && task.beneficiaryId) {
      const beneficiary = task.beneficiaryId;
      recipientName = beneficiary.partnerName 
        ? `${beneficiary.name} & ${beneficiary.partnerName}` 
        : beneficiary.name;
      recipientType = 'Elderly Couple';
    } else if (donation.recipientType === 'other_needy' && donation.customRecipient) {
      recipientName = donation.customRecipient.name;
      recipientType = 'Community Service';
    } else if (task.customRecipient?.name) {
      recipientName = task.customRecipient.name;
      recipientType = 'Community Service';
    }

    // Get food request details if available
    let foodRequestDetails = null;
    if (feedback.foodRequestId) {
      foodRequestDetails = await FoodRequest.findById(feedback.foodRequestId)
        .select('numberOfPeople foodPreference requiredDateTime');
    }

    // Mark feedback as shared with donor
    feedback.sharedWithDonor = true;
    await feedback.save();

    // Prepare notification data
    const notificationData = {
      donationCode: donation.donationCode,
      donationType: donation.type,
      quantity: donation.quantity,
      unit: donation.unit,
      recipientName,
      recipientType,
      deliveryAddress,
      deliveredAt: feedback.deliveredAt,
      volunteerName: donation.assignedVolunteerId?.name || 'Volunteer',
      rating: feedback.rating,
      category: feedback.category,
      comment: feedback.comment,
      recipientFeedback: feedback.recipientInfo?.feedback || null,
      photoProof: feedback.photoProof,
      voiceNote: feedback.voiceNote,
      feedbackId: feedback._id,
    };

    // Send email notification
    if (donation.donorId.email) {
      await sendDeliveryCompletionEmail({
        toEmail: donation.donorId.email,
        donorName: donation.donorId.name,
        ...notificationData,
      }).catch(err => {
        console.error('[donorNotifications] Email sending failed:', err.message);
      });
    }

    // Emit real-time socket notification
    emitDonorNotification(donation.donorId._id.toString(), {
      type: 'delivery_completed',
      message: `Your donation ${donation.donationCode} has been successfully delivered!`,
      data: notificationData,
    });

    console.log(`[donorNotifications] Notified donor ${donation.donorId.email} about delivery completion`);
  } catch (error) {
    console.error('[donorNotifications] Error:', error.message);
  }
}

/**
 * Get delivery history for a specific donor
 * Returns all completed donations with feedback
 */
async function getDonorDeliveryHistory(donorId) {
  try {
    const donations = await Donation.find({
      donorId,
      status: 'delivered',
    })
      .sort({ updatedAt: -1 })
      .populate('assignedVolunteerId', 'name phone')
      .populate('ngoId', 'organizationName');

    // Fetch associated tasks and feedback
    const deliveryHistory = await Promise.all(
      donations.map(async (donation) => {
        const task = await Task.findOne({ donationId: donation._id })
          .populate('beneficiaryId', 'name partnerName phone homeAddress');

        const feedback = await require('../models/Feedback')
          .findOne({ donationId: donation._id, visibleToDonor: true })
          .populate('submittedByVolunteerId', 'name');

        // Determine recipient info
        let recipientName = 'Unknown';
        let recipientType = 'Other';
        let recipientAddress = task?.deliveryLocation?.address || 'Unknown';

        if (donation.recipientType === 'elderly_couple' && task?.beneficiaryId) {
          const b = task.beneficiaryId;
          recipientName = b.partnerName ? `${b.name} & ${b.partnerName}` : b.name;
          recipientType = 'Elderly Couple';
          recipientAddress = b.homeAddress || recipientAddress;
        } else if (donation.recipientType === 'other_needy' && donation.customRecipient) {
          recipientName = donation.customRecipient.name;
          recipientType = 'Community Service';
          recipientAddress = donation.customRecipient.address || recipientAddress;
        } else if (task?.customRecipient?.name) {
          recipientName = task.customRecipient.name;
          recipientType = 'Community Service';
        }

        return {
          donation: donation.toObject(),
          task: task?.toObject() || null,
          feedback: feedback?.toObject() || null,
          recipientName,
          recipientType,
          recipientAddress,
          deliveredAt: task?.deliveredAt || donation.updatedAt,
          volunteerName: donation.assignedVolunteerId?.name || 'Unknown',
          ngoName: donation.ngoId?.organizationName || 'NGO',
        };
      })
    );

    return deliveryHistory;
  } catch (error) {
    console.error('[donorNotifications] Error fetching history:', error.message);
    return [];
  }
}

module.exports = {
  notifyDonorOfDelivery,
  getDonorDeliveryHistory,
};
