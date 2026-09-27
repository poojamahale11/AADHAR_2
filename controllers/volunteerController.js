const Task = require('../models/Task');
const Donation = require('../models/Donation');
const Feedback = require('../models/Feedback');
const EmergencyAlert = require('../models/EmergencyAlert');
const FoodRequest = require('../models/FoodRequest');
const { Volunteer, User } = require('../models/User');
const { haversineDistanceKm } = require('../utils/geo');
const { updateDonationStatus } = require('../utils/donationStatusService');
const { updateFoodRequestStatus } = require('../utils/foodRequestStatusService');
const { sendDeliveryOtpEmail } = require('../utils/email');
const { emitVolunteerTaskUpdate } = require('../sockets');
const { enrichVolunteerStatus } = require('../utils/volunteerStatus');

// ---------------------------------------------------------------------------
// Dashboard — assigned tasks + emergency alerts in range + availability
// ---------------------------------------------------------------------------
exports.getDashboard = async (req, res) => {
  const [tasks, volunteer] = await Promise.all([
    Task.find({
      volunteerId: req.user._id,
      status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    })
      .sort({ createdAt: -1 })
      .populate('donationId')
      .populate('foodRequestId')
      .populate('beneficiaryId', 'name partnerName phone homeAddress'),
    Volunteer.findById(req.user._id),
  ]);

  const enrichedVolunteer = volunteer ? enrichVolunteerStatus(volunteer, tasks[0] || null) : null;

  let nearbyAlerts = [];
  const { lat, lng } = req.user.location || {};
  if (lat != null && lng != null) {
    const activeAlerts = await EmergencyAlert.find({ isActive: true });
    nearbyAlerts = activeAlerts.filter(
      (a) => haversineDistanceKm(lat, lng, a.area.lat, a.area.lng) <= a.area.radiusKm
    );
  }

  // Format date for date input value (YYYY-MM-DD)
  let rawDateValue = '';
  if (volunteer && volunteer.availableDate) {
    try {
      rawDateValue = new Date(volunteer.availableDate).toISOString().split('T')[0];
    } catch (e) {}
  }

  res.render('volunteer/dashboard', {
    title: 'Volunteer Dashboard',
    tasks,
    nearbyAlerts,
    justDelivered: req.query.delivered === '1',
    availabilityUpdated: req.query.availabilityUpdated === '1',
    volunteerInfo: enrichedVolunteer,
    rawDateValue,
  });
};

// ---------------------------------------------------------------------------
// Update Volunteer Availability Schedule
// ---------------------------------------------------------------------------
exports.postUpdateAvailability = async (req, res) => {
  const { availableDay, availableDate, availableStartTime, availableEndTime, isAvailable } = req.body;

  let parsedDate = null;
  if (availableDate && availableDate.trim() !== '') {
    const d = new Date(availableDate);
    if (!isNaN(d.getTime())) {
      parsedDate = d;
    }
  }

  await Volunteer.findByIdAndUpdate(req.user._id, {
    availableDay: availableDay?.trim() || 'All Days',
    availableDate: parsedDate,
    availableStartTime: availableStartTime?.trim() || '09:00',
    availableEndTime: availableEndTime?.trim() || '18:00',
    isAvailable: isAvailable === 'true' || isAvailable === 'on' || isAvailable === true || isAvailable === '1',
  });

  res.redirect('/volunteer/dashboard?availabilityUpdated=1');
};

// ---------------------------------------------------------------------------
// Accept / Reject
// ---------------------------------------------------------------------------
exports.postAcceptTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'assigned' });
  if (task) {
    task.status = 'accepted';
    task.acceptedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'accepted', 'Volunteer accepted the assignment');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'accepted',
          'Volunteer accepted the assignment',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postRejectTask = async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    volunteerId: req.user._id,
    status: { $in: ['assigned', 'accepted'] },
  });
  if (task) {
    task.status = 'rejected';
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      donation.assignedVolunteerId = null;
      donation.assignedByNgoId = null;
      await updateDonationStatus(donation, 'pending', 'Volunteer declined — needs reassignment');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'pending',
          'Volunteer declined — needs reassignment',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

// ---------------------------------------------------------------------------
// Mark picked
// ---------------------------------------------------------------------------
exports.postMarkPickupReached = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'accepted' });
  if (task) {
    task.status = 'pickup_reached';
    task.pickupReachedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'pickup_reached', 'Volunteer reached pickup location');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'pickup_reached',
          'Volunteer reached pickup location',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postMarkPicked = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'pickup_reached' });
  if (task) {
    task.status = 'picked';
    task.pickedAt = new Date();
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'picked', 'Picked up by volunteer');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'picked',
          'Food picked up by volunteer',
          req.user._id,
          'volunteer'
        );
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

exports.postStartDelivery = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'picked' });
  if (task) {
    task.status = 'in_transit';
    task.inTransitAt = new Date();
    task.deliveryOtpExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiration window
    await task.save();
    emitVolunteerTaskUpdate(task);

    const donation = task.donationId ? await Donation.findById(task.donationId) : null;
    if (donation) {
      await updateDonationStatus(donation, 'in_transit', 'Volunteer started the delivery route');
    } else if (task.foodRequestId) {
      const foodRequest = await FoodRequest.findById(task.foodRequestId);
      if (foodRequest) {
        await updateFoodRequestStatus(
          foodRequest,
          'in_transit',
          'Volunteer started the delivery route',
          req.user._id,
          'volunteer'
        );

        // Fetch beneficiary user details to dispatch delivery OTP email
        const recipient = await User.findById(task.beneficiaryId || foodRequest.householdId);
        if (recipient && recipient.email) {
          sendDeliveryOtpEmail({
            toEmail: recipient.email,
            recipientName: recipient.name || recipient.partnerName || 'Resident',
            otp: task.deliveryOtp,
            foodRequest,
            task,
          }).catch((err) => console.error('[volunteer] Delivery OTP email sending failed:', err.message));
        }
      }
    }
  }
  res.redirect('/volunteer/dashboard');
};

// ---------------------------------------------------------------------------
// Delivery confirmation — OTP + feedback collection
// ---------------------------------------------------------------------------
exports.getDeliverForm = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'in_transit' })
    .populate('donationId')
    .populate('foodRequestId');
  if (!task) {
    return res.status(404).render('error', { title: 'Not found', message: 'Task not found or not ready for delivery.' });
  }
  res.render('volunteer/deliver-form', { title: 'Confirm Delivery', task, errors: null, formData: {} });
};

exports.postDeliver = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, volunteerId: req.user._id, status: 'in_transit' })
    .populate('donationId')
    .populate('foodRequestId')
    .populate('beneficiaryId', 'name partnerName');
  
  if (!task) {
    return res.status(404).render('error', { title: 'Not found', message: 'Task not found or not ready for delivery.' });
  }

  const { 
    otp, 
    rating, 
    category, 
    comment, 
    deliveryNotes,
    recipientFeedback,
    recipientSatisfaction
  } = req.body;
  
  const errors = [];

  if (!otp || otp.trim() !== task.deliveryOtp) {
    errors.push('The OTP entered does not match the code generated for this delivery.');
  }

  if (task.deliveryOtpExpiresAt && new Date() > task.deliveryOtpExpiresAt) {
    errors.push('The delivery verification OTP has expired. Please contact the NGO administrator.');
  }

  if (!rating || !['1', '2', '3', '4', '5'].includes(String(rating))) {
    errors.push('Please select a star rating.');
  }
  if (!category || !['good', 'average', 'bad'].includes(category)) {
    errors.push('Please choose a feedback category.');
  }
  if (!req.files || !req.files.proofPhoto || req.files.proofPhoto.length === 0) {
    errors.push('A delivery proof photo is required.');
  }

  if (errors.length) {
    return res.status(400).render('volunteer/deliver-form', { title: 'Confirm Delivery', task, errors, formData: req.body });
  }

  // Handle file uploads
  const proofPhotoPath = `/uploads/proofs/${req.files.proofPhoto[0].filename}`;
  const voiceNotePath = req.files.voiceNote && req.files.voiceNote.length > 0 
    ? `/uploads/voicenotes/${req.files.voiceNote[0].filename}` 
    : null;
  
  // Handle additional photos (if multiple uploaded)
  const additionalPhotos = [];
  if (req.files.additionalPhotos && req.files.additionalPhotos.length > 0) {
    req.files.additionalPhotos.forEach(file => {
      additionalPhotos.push(`/uploads/proofs/${file.filename}`);
    });
  }

  // Update task
  task.status = 'delivered';
  task.deliveredAt = new Date();
  task.deliveryOtpVerified = true;
  task.proofPhoto = proofPhotoPath;
  await task.save();
  emitVolunteerTaskUpdate(task);

  // Update donation/food request
  const donation = task.donationId;
  if (donation) {
    donation.deliveryProofPhoto = proofPhotoPath;
    await updateDonationStatus(donation, 'delivered', 'Delivered and confirmed by OTP');
  } else if (task.foodRequestId) {
    const foodRequest = await FoodRequest.findById(task.foodRequestId._id || task.foodRequestId);
    if (foodRequest) {
      foodRequest.deliveryProofPhoto = proofPhotoPath;
      await updateFoodRequestStatus(
        foodRequest,
        'delivered',
        'Delivered and confirmed via OTP',
        req.user._id,
        'volunteer'
      );
    }
  }

  // Determine recipient information
  let recipientType = 'ngo_center';
  let recipientName = 'NGO Collection Point';
  
  if (donation?.recipientType === 'elderly_couple' && task.beneficiaryId) {
    recipientType = 'elderly_couple';
    const beneficiary = task.beneficiaryId;
    recipientName = beneficiary.partnerName 
      ? `${beneficiary.name} & ${beneficiary.partnerName}` 
      : beneficiary.name;
  } else if (donation?.recipientType === 'other_needy' && (donation.customRecipient || task.customRecipient)) {
    recipientType = 'other_needy';
    recipientName = donation.customRecipient?.name || task.customRecipient?.name || 'Community Service';
  } else if (task.customRecipient?.name) {
    recipientType = 'other_needy';
    recipientName = task.customRecipient.name;
  } else if (task.beneficiaryId) {
    recipientType = 'elderly_couple';
    const beneficiary = task.beneficiaryId;
    recipientName = beneficiary.partnerName 
      ? `${beneficiary.name} & ${beneficiary.partnerName}` 
      : beneficiary.name;
  }

  // Create comprehensive feedback with recipient info
  await Feedback.create({
    taskId: task._id,
    donationId: donation ? donation._id : null,
    foodRequestId: task.foodRequestId ? (task.foodRequestId._id || task.foodRequestId) : null,
    rating: Number(rating),
    category,
    comment: comment || '',
    deliveryNotes: deliveryNotes || '',
    photoProof: proofPhotoPath,
    additionalPhotos,
    voiceNote: voiceNotePath,
    recipientInfo: {
      type: recipientType,
      name: recipientName,
      feedback: recipientFeedback || '',
      satisfactionLevel: recipientSatisfaction || null,
    },
    deliveredAt: task.deliveredAt,
    submittedByVolunteerId: req.user._id,
    visibleToDonor: true,
  });

  res.redirect('/volunteer/dashboard?delivered=1');
};

// ---------------------------------------------------------------------------
// Rating history — feedback this volunteer has collected
// ---------------------------------------------------------------------------
exports.getMyFeedback = async (req, res) => {
  const volunteer = await Volunteer.findById(req.user._id);
  const feedbackList = await Feedback.find({ submittedByVolunteerId: req.user._id })
    .populate('donationId', 'donationCode type')
    .sort({ createdAt: -1 });

  res.render('volunteer/my-feedback', { title: 'My Rating History', feedbackList, volunteer });
};

// ---------------------------------------------------------------------------
// Real-time Location Tracking for Active Deliveries
// ---------------------------------------------------------------------------
exports.postUpdateLocation = async (req, res) => {
  const { taskId, lat, lng } = req.body;

  if (!taskId || !lat || !lng) {
    return res.status(400).json({ success: false, message: 'Missing required fields: taskId, lat, lng' });
  }

  try {
    const task = await Task.findOne({
      _id: taskId,
      volunteerId: req.user._id,
      status: 'in_transit',
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Active delivery task not found.' });
    }

    // Update current location
    task.currentLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      lastUpdated: new Date(),
    };

    // Calculate distance to destination if coordinates available
    if (task.deliveryLocation.lat && task.deliveryLocation.lng) {
      const distanceKm = haversineDistanceKm(
        parseFloat(lat),
        parseFloat(lng),
        task.deliveryLocation.lat,
        task.deliveryLocation.lng
      );
      
      task.routeDistance = distanceKm;
      
      // Estimate arrival time (assuming average speed of 30 km/h in city)
      const durationMin = (distanceKm / 30) * 60;
      task.routeDuration = durationMin;
      task.estimatedArrivalTime = new Date(Date.now() + durationMin * 60 * 1000);
    }

    await task.save();
    
    // Emit real-time update via socket
    emitVolunteerTaskUpdate(task);

    res.json({
      success: true,
      message: 'Location updated successfully',
      distanceRemaining: task.routeDistance,
      estimatedArrival: task.estimatedArrivalTime,
    });
  } catch (error) {
    console.error('[volunteer] Location update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
};

// ---------------------------------------------------------------------------
// Get Active Delivery Info (for real-time tracking display)
// ---------------------------------------------------------------------------
exports.getActiveDelivery = async (req, res) => {
  try {
    const task = await Task.findOne({
      volunteerId: req.user._id,
      status: 'in_transit',
    })
      .populate('donationId')
      .populate('foodRequestId')
      .populate('beneficiaryId', 'name partnerName phone homeAddress');

    if (!task) {
      return res.json({ success: false, message: 'No active delivery found' });
    }

    res.json({
      success: true,
      task: {
        _id: task._id,
        status: task.status,
        pickupLocation: task.pickupLocation,
        deliveryLocation: task.deliveryLocation,
        currentLocation: task.currentLocation,
        estimatedArrivalTime: task.estimatedArrivalTime,
        routeDistance: task.routeDistance,
        routeDuration: task.routeDuration,
        customRecipient: task.customRecipient,
        beneficiary: task.beneficiaryId,
        donation: task.donationId,
        foodRequest: task.foodRequestId,
      },
    });
  } catch (error) {
    console.error('[volunteer] Get active delivery error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active delivery' });
  }
};
