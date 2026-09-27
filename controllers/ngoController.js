const Donation = require('../models/Donation');
const Task = require('../models/Task');
const Report = require('../models/Report');
const Feedback = require('../models/Feedback');
const EmergencyAlert = require('../models/EmergencyAlert');
const FoodRequest = require('../models/FoodRequest');
const { Volunteer, NGOAdmin, Elderly } = require('../models/User');
const { haversineDistanceKm } = require('../utils/geo');
const { getDistanceMatrix } = require('../utils/distanceMatrix');
const { updateDonationStatus } = require('../utils/donationStatusService');
const { updateFoodRequestStatus } = require('../utils/foodRequestStatusService');
const { emitTaskAssigned, emitEmergencyAlert } = require('../sockets');
const { enrichVolunteerStatus } = require('../utils/volunteerStatus');

const pickupDateSort = { 'timeSlot.date': 1, createdAt: 1 };

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
exports.getOverview = async (req, res) => {
  const ngoId = req.user._id;
  const [totalDonations, activeVolunteers, pendingPickups, completedDeliveries, pendingApprovals, activeAlerts, pendingFoodRequests] =
    await Promise.all([
      Donation.countDocuments({ ngoId }),
      Volunteer.countDocuments({ ngoId, isApproved: true, isActive: true }),
      Donation.countDocuments({ ngoId, status: { $in: ['pending', 'assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] } }),
      Donation.countDocuments({ ngoId, status: 'delivered' }),
      Volunteer.countDocuments({ ngoId, isApproved: false, isActive: true }),
      EmergencyAlert.countDocuments({ isActive: true }),
      FoodRequest.countDocuments({ status: 'pending' }),
    ]);

  const recentDonations = await Donation.find({ ngoId }).sort(pickupDateSort).limit(6).populate('donorId', 'name');

  res.render('ngo/dashboard', {
    title: 'Lions Club Admin Dashboard',
    stats: { totalDonations, activeVolunteers, pendingPickups, completedDeliveries, pendingApprovals, activeAlerts, pendingFoodRequests },
    recentDonations,
  });
};

// ---------------------------------------------------------------------------
// Comprehensive Management View - Complete Real Working System
// ---------------------------------------------------------------------------
exports.getManagementView = async (req, res) => {
  const ngoId = req.user._id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get comprehensive stats
  const [
    allDonations,
    allFoodRequests,
    allTasks,
    volunteers,
    donorStats,
    elderlyStats
  ] = await Promise.all([
    // All donations with full donor info
    Donation.find({ ngoId })
      .sort({ 'timeSlot.date': 1, createdAt: -1 })
      .populate('donorId', 'name phone totalDonations')
      .populate('assignedVolunteerId', 'name phone'),
    
    // All food requests sorted by createdAt for urgency
    FoodRequest.find({})
      .sort({ createdAt: 1 }) // Oldest first = most urgent
      .populate('householdId', 'name partnerName phone homeAddress')
      .populate('assignedVolunteerId', 'name phone'),
    
    // All tasks for tracking
    Task.find({ ngoAssignedBy: ngoId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'donationId',
        populate: { path: 'donorId', select: 'name phone totalDonations' }
      })
      .populate({
        path: 'foodRequestId',
        populate: { path: 'householdId', select: 'name partnerName phone homeAddress' }
      })
      .populate('volunteerId', 'name phone completedTasks')
      .populate('beneficiaryId', 'name partnerName phone homeAddress'),
    
    // All active volunteers
    Volunteer.find({
      ngoId,
      isApproved: true,
      isActive: true
    }).select('name phone completedTasks'),
    
    // Donor statistics for identifying regulars
    Donation.aggregate([
      { $match: { ngoId } },
      { 
        $group: {
          _id: '$donorId',
          totalDonations: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          lastDonation: { $max: '$createdAt' }
        }
      },
      { $sort: { totalDonations: -1 } }
    ]),
    
    // Elderly statistics for identifying frequent requesters
    FoodRequest.aggregate([
      { 
        $group: {
          _id: '$householdId',
          totalRequests: { $sum: 1 },
          lastRequest: { $max: '$createdAt' },
          deliveredCount: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          }
        }
      },
      { $sort: { totalRequests: -1 } }
    ])
  ]);

  // Calculate comprehensive statistics
  const stats = {
    // Donation stats
    totalDonations: allDonations.length,
    pendingDonations: allDonations.filter(d => d.status === 'pending').length,
    assignedDonations: allDonations.filter(d => ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'].includes(d.status)).length,
    deliveredDonations: allDonations.filter(d => d.status === 'delivered').length,
    
    // Food request stats
    totalFoodRequests: allFoodRequests.length,
    pendingFoodRequests: allFoodRequests.filter(r => r.status === 'pending').length,
    assignedFoodRequests: allFoodRequests.filter(r => ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'].includes(r.status)).length,
    deliveredFoodRequests: allFoodRequests.filter(r => r.status === 'delivered').length,
    
    // Active tracking
    activeDeliveries: allTasks.filter(t => ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'].includes(t.status)).length,
    completedToday: allTasks.filter(t => t.status === 'delivered' && t.deliveredAt >= today).length,
    
    // Volunteer stats
    totalVolunteers: volunteers.length,
    
    // Regular users
    regularDonors: donorStats.filter(d => d.totalDonations >= 3).length,
    regularElderlyUsers: elderlyStats.filter(e => e.totalRequests >= 3).length
  };

  // Create maps for quick lookups
  const donorStatsMap = new Map(donorStats.map(d => [d._id.toString(), d]));
  const elderlyStatsMap = new Map(elderlyStats.map(e => [e._id.toString(), e]));
  const tasksByDonation = new Map();
  const tasksByFoodRequest = new Map();
  
  allTasks.forEach(task => {
    if (task.donationId) {
      tasksByDonation.set(task.donationId._id.toString(), task);
    }
    if (task.foodRequestId) {
      tasksByFoodRequest.set(task.foodRequestId._id.toString(), task);
    }
  });

  // Enrich donations with tracking info and regular donor flag
  const enrichedDonations = allDonations.map(d => {
    const task = tasksByDonation.get(d._id.toString());
    const donorId = d.donorId ? d.donorId._id.toString() : null;
    const donorStat = donorId ? donorStatsMap.get(donorId) : null;
    
    return {
      ...d.toObject(),
      task: task || null,
      isRegularDonor: donorStat ? donorStat.totalDonations >= 3 : false,
      donorTotalDonations: donorStat ? donorStat.totalDonations : 0,
      deliveryStatus: task ? task.status : null,
      volunteer: task ? task.volunteerId : null,
      beneficiary: task ? task.beneficiaryId : null
    };
  });

  // Enrich food requests with tracking info and regular user flag
  const enrichedFoodRequests = allFoodRequests.map(r => {
    const task = tasksByFoodRequest.get(r._id.toString());
    const householdId = r.householdId ? r.householdId._id.toString() : null;
    const elderlyStat = householdId ? elderlyStatsMap.get(householdId) : null;
    
    return {
      ...r.toObject(),
      task: task || null,
      isRegularRequester: elderlyStat ? elderlyStat.totalRequests >= 3 : false,
      elderlyTotalRequests: elderlyStat ? elderlyStat.totalRequests : 0,
      deliveryStatus: task ? task.status : null,
      volunteer: task ? task.volunteerId : null,
      assignedDonation: task && task.donationId ? task.donationId : null
    };
  });

  // Separate active deliveries
  const activeDeliveries = allTasks.filter(t => 
    ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'].includes(t.status)
  );

  // Build complete history with full details
  const completedTasks = allTasks.filter(t => t.status === 'delivered');
  const historyItems = completedTasks.map(task => {
    const isDonation = !!task.donationId;
    const base = {
      taskId: task._id,
      completedDate: task.deliveredAt || task.updatedAt,
      volunteer: task.volunteerId || null,
      beneficiary: task.beneficiaryId || null,
      deliveryLocation: task.deliveryLocation,
      statusHistory: []
    };

    if (isDonation && task.donationId) {
      const donation = task.donationId;
      const donorId = donation.donorId ? donation.donorId._id.toString() : null;
      const donorStat = donorId ? donorStatsMap.get(donorId) : null;
      
      return {
        ...base,
        type: 'donation',
        code: donation.donationCode,
        donor: donation.donorId || null,
        isRegularDonor: donorStat ? donorStat.totalDonations >= 3 : false,
        donorTotalDonations: donorStat ? donorStat.totalDonations : 0,
        details: `${donation.type} - ${donation.quantity} ${donation.unit || 'units'}`,
        description: donation.description,
        pickupLocation: donation.pickupLocation,
        timeSlot: donation.timeSlot,
        statusHistory: donation.statusHistory || []
      };
    } else if (task.foodRequestId) {
      const request = task.foodRequestId;
      const householdId = request.householdId ? request.householdId._id.toString() : null;
      const elderlyStat = householdId ? elderlyStatsMap.get(householdId) : null;
      
      return {
        ...base,
        type: 'foodRequest',
        code: `REQ-${request._id.toString().slice(-6).toUpperCase()}`,
        elderlyCouple: request.householdId || null,
        isRegularRequester: elderlyStat ? elderlyStat.totalRequests >= 3 : false,
        elderlyTotalRequests: elderlyStat ? elderlyStat.totalRequests : 0,
        details: `${request.numberOfPeople || 2} people - ${request.foodPreference === 'veg' ? '🥗 Veg' : '🍖 Non-Veg'}`,
        deliveryAddress: request.deliveryAddress,
        requestedAt: request.createdAt,
        statusHistory: request.statusHistory || []
      };
    }
    return null;
  }).filter(item => item !== null)
    .sort((a, b) => b.completedDate - a.completedDate);

  res.render('ngo/management-center', {
    title: 'Complete Management System',
    stats,
    donations: enrichedDonations,
    foodRequests: enrichedFoodRequests,
    activeDeliveries,
    historyItems,
    volunteers,
    donorStats: donorStats.slice(0, 20), // Top 20 donors
    elderlyStats: elderlyStats.slice(0, 20) // Top 20 elderly users
  });
};

// ---------------------------------------------------------------------------
// Manage Donations
// ---------------------------------------------------------------------------
exports.getDonationsList = async (req, res) => {
  const { status, type } = req.query;
  const filter = { ngoId: req.user._id };
  if (status && Donation.STATUSES.includes(status)) filter.status = status;
  if (type && Donation.TYPES.includes(type)) filter.type = type;

  const donations = await Donation.find(filter).sort(pickupDateSort).populate('donorId', 'name');

  res.render('ngo/donations-list', {
    title: 'Manage Donations',
    donations,
    statuses: Donation.STATUSES,
    types: Donation.TYPES,
    query: req.query,
  });
};

exports.getAssignDonation = async (req, res) => {
  const donation = await Donation.findById(req.params.id).populate('donorId', 'name phone');
  if (!donation) return res.status(404).render('error', { title: 'Not found', message: 'Donation not found.' });

  const [volunteers, activeTasks] = await Promise.all([
    Volunteer.find({
      ngoId: req.user._id,
      isApproved: true,
      isActive: true,
    }),
    Task.find({
      ngoAssignedBy: req.user._id,
      status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    }).populate('donationId', 'donationCode type timeSlot').populate('foodRequestId', 'requirements'),
  ]);

  const activeTaskMap = new Map();
  activeTasks.forEach((t) => {
    if (t.volunteerId) activeTaskMap.set(t.volunteerId.toString(), t);
  });

  const enrichedVolunteers = volunteers.map((v) => enrichVolunteerStatus(v, activeTaskMap.get(v._id.toString())));

  const hasCoords = donation.pickupLocation.lat != null && donation.pickupLocation.lng != null;
  const volunteersWithCoords = enrichedVolunteers.filter((v) => v.location.lat != null && v.location.lng != null);

  let rankingMethod = 'none';
  let ranked = enrichedVolunteers.map((v) => ({ volunteer: v, distanceKm: null, durationMin: null }));

  if (hasCoords && volunteersWithCoords.length > 0) {
    const matrix = await getDistanceMatrix(
      donation.pickupLocation,
      volunteersWithCoords.map((v) => v.location)
    );

    if (matrix) {
      rankingMethod = 'distance-matrix';
      const byId = new Map();
      volunteersWithCoords.forEach((v, i) => byId.set(v._id.toString(), matrix[i]));
      ranked = enrichedVolunteers.map((v) => {
        const m = byId.get(v._id.toString());
        return { volunteer: v, distanceKm: m ? m.distanceKm : null, durationMin: m ? m.durationMin : null };
      });
    } else {
      rankingMethod = 'haversine';
      ranked = enrichedVolunteers.map((v) => {
        let distanceKm = null;
        if (v.location.lat != null && v.location.lng != null) {
          distanceKm = haversineDistanceKm(
            donation.pickupLocation.lat,
            donation.pickupLocation.lng,
            v.location.lat,
            v.location.lng
          );
        }
        return { volunteer: v, distanceKm, durationMin: null };
      });
    }
  }

  // Sort available volunteers first, then by distance / name
  ranked.sort((a, b) => {
    const aAvailable = a.volunteer.liveStatus === 'available' ? 0 : 1;
    const bAvailable = b.volunteer.liveStatus === 'available' ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;

    if (a.distanceKm == null && b.distanceKm == null) return a.volunteer.name.localeCompare(b.volunteer.name);
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });

  // Get elderly couples with ACTIVE food requests (unassigned or not yet delivered)
  const elderlyCouples = await Elderly.find({ isActive: true })
    .select('name partnerName phone homeAddress location')
    .sort({ name: 1 });

  // Get active food requests for elderly couples
  const foodRequests = await FoodRequest.find({
    status: { $in: ['pending', 'assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
  })
    .populate('householdId', 'name partnerName phone homeAddress')
    .sort({ requiredDateTime: 1, createdAt: 1 }); // Sort by required date/time first

  // Only show elderly couples who have active requests
  const elderlyCouplesWithRequests = foodRequests.map(request => ({
    _id: request.householdId._id,
    name: request.householdId.name,
    partnerName: request.householdId.partnerName,
    phone: request.householdId.phone,
    address: request.deliveryAddress || request.householdId.homeAddress,
    foodRequestId: request._id,
    numberOfPeople: request.numberOfPeople,
    foodPreference: request.foodPreference,
    requiredDateTime: request.requiredDateTime,
    requestStatus: request.status,
    isAlreadyAssigned: request.assignedDonationId != null,
  }));

  const [ngo] = await Promise.all([
    NGOAdmin.findById(req.user._id),
  ]);

  res.render('ngo/donation-assign', {
    title: `Assign — ${donation.donationCode}`,
    donation,
    ranked,
    hasCoords,
    rankingMethod,
    defaultDeliveryAddress: ngo?.organizationAddress || '',
    elderlyCouplesWithRequests, // Filtered elderly couples with active requests
    errors: null,
    formData: {},
  });
};

exports.postAssignVolunteer = async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) return res.status(404).render('error', { title: 'Not found', message: 'Donation not found.' });
  if (donation.status !== 'pending') {
    return res.redirect(`/admin/donations/${donation._id}/assign`);
  }

  const { 
    volunteerId, 
    recipientType, 
    foodRequestId, 
    customRecipientName,
    customRecipientContact,
    customRecipientPhone,
    customRecipientAddress,
    customRecipientLat,
    customRecipientLng,
    customRecipientDateTime,
    customRecipientNotes
  } = req.body;

  const errors = [];

  if (!volunteerId) {
    errors.push('Please select a volunteer.');
  }

  if (!recipientType || !['elderly_couple', 'other_needy'].includes(recipientType)) {
    errors.push('Please select a valid recipient type.');
  }

  // Validate based on recipient type
  if (recipientType === 'elderly_couple') {
    if (!foodRequestId) {
      errors.push('Please select an elderly couple food request.');
    }
  } else if (recipientType === 'other_needy') {
    if (!customRecipientName || customRecipientName.trim() === '') {
      errors.push('Please enter recipient name/place.');
    }
    if (!customRecipientAddress || customRecipientAddress.trim() === '') {
      errors.push('Please enter delivery address.');
    }
  }

  if (errors.length > 0) {
    // Re-fetch data for form
    const [volunteers, activeTasks] = await Promise.all([
      Volunteer.find({ ngoId: req.user._id, isApproved: true, isActive: true }),
      Task.find({
        ngoAssignedBy: req.user._id,
        status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
      }),
    ]);

    const activeTaskMap = new Map();
    activeTasks.forEach((t) => {
      if (t.volunteerId) activeTaskMap.set(t.volunteerId.toString(), t);
    });

    const enrichedVolunteers = volunteers.map((v) => enrichVolunteerStatus(v, activeTaskMap.get(v._id.toString())));
    
    const foodRequests = await FoodRequest.find({
      status: { $in: ['pending', 'assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    })
      .populate('householdId', 'name partnerName phone homeAddress')
      .sort({ requiredDateTime: 1, createdAt: 1 });

    const elderlyCouplesWithRequests = foodRequests.map(request => ({
      _id: request.householdId._id,
      name: request.householdId.name,
      partnerName: request.householdId.partnerName,
      phone: request.householdId.phone,
      address: request.deliveryAddress || request.householdId.homeAddress,
      foodRequestId: request._id,
      numberOfPeople: request.numberOfPeople,
      foodPreference: request.foodPreference,
      requiredDateTime: request.requiredDateTime,
      requestStatus: request.status,
      isAlreadyAssigned: request.assignedDonationId != null,
    }));

    const ngo = await NGOAdmin.findById(req.user._id);

    return res.status(400).render('ngo/donation-assign', {
      title: `Assign — ${donation.donationCode}`,
      donation: await donation.populate('donorId', 'name phone'),
      ranked: enrichedVolunteers.map(v => ({ volunteer: v, distanceKm: null, durationMin: null })),
      hasCoords: false,
      rankingMethod: 'none',
      defaultDeliveryAddress: ngo?.organizationAddress || '',
      elderlyCouplesWithRequests,
      errors,
      formData: req.body,
    });
  }

  const volunteer = await Volunteer.findOne({
    _id: volunteerId,
    ngoId: req.user._id,
    isApproved: true,
    isActive: true,
  });

  if (!volunteer) {
    return res.status(400).render('error', {
      title: 'Assignment invalid',
      message: 'The selected volunteer could not be validated. Please choose an active volunteer and try again.',
    });
  }

  let task, deliveryAddress, deliveryLat, deliveryLng, beneficiaryId, customRecipient;

  if (recipientType === 'elderly_couple') {
    // Assign to elderly couple with food request
    const foodRequest = await FoodRequest.findById(foodRequestId).populate('householdId');
    
    if (!foodRequest) {
      return res.status(400).render('error', {
        title: 'Assignment invalid',
        message: 'The selected food request could not be found.',
      });
    }

    deliveryAddress = foodRequest.deliveryAddress;
    deliveryLat = foodRequest.location?.lat || null;
    deliveryLng = foodRequest.location?.lng || null;
    beneficiaryId = foodRequest.householdId._id;

    // Link donation to food request
    donation.recipientType = 'elderly_couple';
    donation.assignedFoodRequestId = foodRequest._id;

    // Update food request with donation assignment
    foodRequest.assignedDonationId = donation._id;
    await foodRequest.save();

    task = await Task.createForDonation({
      donation,
      volunteerId: volunteer._id,
      ngoId: req.user._id,
      beneficiaryId,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
    });

  } else {
    // Assign to other needy people (custom recipient)
    deliveryAddress = customRecipientAddress.trim();
    deliveryLat = customRecipientLat ? parseFloat(customRecipientLat) : null;
    deliveryLng = customRecipientLng ? parseFloat(customRecipientLng) : null;
    beneficiaryId = null; // No registered user

    customRecipient = {
      name: customRecipientName.trim(),
      contactPerson: customRecipientContact ? customRecipientContact.trim() : null,
      phone: customRecipientPhone ? customRecipientPhone.trim() : null,
    };

    // Store custom recipient details in donation
    donation.recipientType = 'other_needy';
    donation.customRecipient = {
      name: customRecipientName.trim(),
      contactPerson: customRecipientContact ? customRecipientContact.trim() : null,
      phone: customRecipientPhone ? customRecipientPhone.trim() : null,
      address: deliveryAddress,
      lat: deliveryLat,
      lng: deliveryLng,
      requiredDateTime: customRecipientDateTime ? new Date(customRecipientDateTime) : null,
      notes: customRecipientNotes ? customRecipientNotes.trim() : '',
    };

    task = await Task.createForDonation({
      donation,
      volunteerId: volunteer._id,
      ngoId: req.user._id,
      beneficiaryId,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      customRecipient,
    });
  }

  donation.assignedVolunteerId = volunteer._id;
  donation.assignedByNgoId = req.user._id;
  await updateDonationStatus(donation, 'assigned', `Assigned to ${volunteer.name}`);

  emitTaskAssigned(task, volunteer);

  res.redirect('/admin/donations?status=assigned');
};

// ---------------------------------------------------------------------------
// Elderly household food requests
// ---------------------------------------------------------------------------
exports.getFoodRequests = async (req, res) => {
  const requests = await FoodRequest.find({}).sort({ createdAt: -1 }).populate('householdId', 'name phone').populate('assignedVolunteerId', 'name');
  res.render('ngo/food-requests', { title: 'Elderly Food Requests', requests });
};

exports.getAssignFoodRequest = async (req, res) => {
  const request = await FoodRequest.findById(req.params.id).populate('householdId', 'name phone');
  if (!request) return res.status(404).render('error', { title: 'Not found', message: 'Food request not found.' });

  const [volunteers, activeTasks] = await Promise.all([
    Volunteer.find({ ngoId: req.user._id, isApproved: true, isActive: true }),
    Task.find({
      ngoAssignedBy: req.user._id,
      status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    }).populate('donationId', 'donationCode type timeSlot').populate('foodRequestId', 'requirements'),
  ]);

  const activeTaskMap = new Map();
  activeTasks.forEach((t) => {
    if (t.volunteerId) activeTaskMap.set(t.volunteerId.toString(), t);
  });

  const enrichedVolunteers = volunteers.map((v) => enrichVolunteerStatus(v, activeTaskMap.get(v._id.toString())));

  // Sort available first, then alphabetical
  enrichedVolunteers.sort((a, b) => {
    const aAvailable = a.liveStatus === 'available' ? 0 : 1;
    const bAvailable = b.liveStatus === 'available' ? 0 : 1;
    if (aAvailable !== bAvailable) return aAvailable - bAvailable;
    return a.name.localeCompare(b.name);
  });

  res.render('ngo/food-request-assign', { title: 'Assign Food Delivery', request, volunteers: enrichedVolunteers });
};

exports.postAssignFoodRequest = async (req, res) => {
  const request = await FoodRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { title: 'Not found', message: 'Food request not found.' });

  const volunteer = await Volunteer.findOne({
    _id: req.body.volunteerId,
    ngoId: req.user._id,
    isApproved: true,
    isActive: true,
  });
  if (!volunteer) return res.redirect(`/admin/food-requests/${request._id}/assign`);

  // Prevent duplicate assignment
  if (request.assignedVolunteerId && request.status !== 'cancelled' && request.status !== 'delivered') {
    return res.status(400).render('error', {
      title: 'Already assigned',
      message: 'This food request is already assigned to a volunteer. Cancel or reassign the existing task first.',
    });
  }

  // Create the task linking the food request, volunteer, and delivery details
  const task = await Task.createForFoodRequest({ request, volunteerId: volunteer._id, ngoId: req.user._id });

  // Set assignment tracking fields
  request.assignedVolunteerId = volunteer._id;
  request.assignedByNgoId = req.user._id;

  // Transition to assigned status with proper history tracking
  await updateFoodRequestStatus(
    request,
    'assigned',
    `Assigned to ${volunteer.name}`,
    req.user._id,
    'ngo_admin'
  );

  emitTaskAssigned(task, volunteer);
  res.redirect('/admin/food-requests');
};

// ---------------------------------------------------------------------------
// Volunteer Management
// ---------------------------------------------------------------------------
exports.getVolunteersList = async (req, res) => {
  const { tab = 'all' } = req.query;

  const [allVolunteers, activeTasks] = await Promise.all([
    Volunteer.find({ ngoId: req.user._id }).sort({ createdAt: -1 }),
    Task.find({
      ngoAssignedBy: req.user._id,
      status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    })
      .populate('donationId', 'donationCode type timeSlot pickupLocation')
      .populate('foodRequestId', 'requirements deliveryAddress')
      .populate('beneficiaryId', 'name partnerName phone homeAddress'),
  ]);

  const activeTaskMap = new Map();
  activeTasks.forEach((t) => {
    if (t.volunteerId) activeTaskMap.set(t.volunteerId.toString(), t);
  });

  const enrichedVolunteers = allVolunteers.map((v) => enrichVolunteerStatus(v, activeTaskMap.get(v._id.toString())));

  // Compute stats/counts for filter tabs
  const counts = {
    all: enrichedVolunteers.length,
    available: enrichedVolunteers.filter((v) => v.liveStatus === 'available').length,
    busy: enrichedVolunteers.filter((v) => v.liveStatus === 'busy').length,
    pending: enrichedVolunteers.filter((v) => v.liveStatus === 'pending').length,
    active: enrichedVolunteers.filter((v) => v.isActive && v.isApproved).length,
    inactive: enrichedVolunteers.filter((v) => v.liveStatus === 'inactive').length,
  };

  let filtered = enrichedVolunteers;
  if (tab === 'available') {
    filtered = enrichedVolunteers.filter((v) => v.liveStatus === 'available');
  } else if (tab === 'busy') {
    filtered = enrichedVolunteers.filter((v) => v.liveStatus === 'busy');
  } else if (tab === 'pending') {
    filtered = enrichedVolunteers.filter((v) => v.liveStatus === 'pending');
  } else if (tab === 'active') {
    filtered = enrichedVolunteers.filter((v) => v.isActive && v.isApproved);
  } else if (tab === 'inactive') {
    filtered = enrichedVolunteers.filter((v) => v.liveStatus === 'inactive');
  }

  res.render('ngo/volunteers-list', {
    title: 'Manage Volunteers',
    volunteers: filtered,
    activeTab: tab,
    counts,
  });
};

exports.postApproveVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isApproved: true, isActive: true });
  res.redirect('/admin/volunteers?tab=pending');
};

exports.postRejectVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isApproved: false, isActive: false });
  res.redirect('/admin/volunteers?tab=pending');
};

exports.postDeactivateVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isActive: false });
  res.redirect('/admin/volunteers?tab=all');
};

exports.postReactivateVolunteer = async (req, res) => {
  await Volunteer.findOneAndUpdate({ _id: req.params.id, ngoId: req.user._id }, { isActive: true });
  res.redirect('/admin/volunteers?tab=all');
};

exports.getVolunteerDetail = async (req, res) => {
  const volunteer = await Volunteer.findOne({ _id: req.params.id, ngoId: req.user._id });
  if (!volunteer) return res.status(404).render('error', { title: 'Not found', message: 'Volunteer not found.' });

  const [tasks, feedback, activeTask] = await Promise.all([
    Task.find({ volunteerId: volunteer._id })
      .sort({ createdAt: -1 })
      .populate('donationId', 'donationCode type quantity timeSlot pickupLocation')
      .populate('foodRequestId', 'requirements deliveryAddress')
      .populate('beneficiaryId', 'name partnerName phone homeAddress'),
    Feedback.find({ submittedByVolunteerId: volunteer._id }).sort({ createdAt: -1 }).limit(10),
    Task.findOne({
      volunteerId: volunteer._id,
      status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] },
    })
      .populate('donationId', 'donationCode type quantity timeSlot pickupLocation')
      .populate('foodRequestId', 'requirements deliveryAddress')
      .populate('beneficiaryId', 'name partnerName phone homeAddress'),
  ]);

  const enrichedVolunteer = enrichVolunteerStatus(volunteer, activeTask);

  res.render('ngo/volunteer-detail', {
    title: volunteer.name,
    volunteer: enrichedVolunteer,
    tasks,
    feedback,
    activeTask: enrichedVolunteer.activeTaskInfo,
  });
};

// ---------------------------------------------------------------------------
// Logistics — Real-time delivery tracking with live location updates
// ---------------------------------------------------------------------------
exports.getLogistics = async (req, res) => {
  const tasks = await Task.find({ 
    ngoAssignedBy: req.user._id, 
    status: { $in: ['assigned', 'accepted', 'pickup_reached', 'picked', 'in_transit'] } 
  })
    .sort({ inTransitAt: -1, createdAt: -1 }) // Show in-transit deliveries first
    .populate('donationId', 'donationCode type quantity timeSlot recipientType customRecipient')
    .populate('foodRequestId', 'requirements deliveryAddress numberOfPeople foodPreference requiredDateTime')
    .populate('beneficiaryId', 'name partnerName phone homeAddress')
    .populate('volunteerId', 'name phone location');

  // Enrich tasks with tracking details
  const enrichedTasks = tasks.map(task => {
    const enriched = task.toObject();
    
    // Calculate status label
    enriched.statusLabel = {
      'assigned': 'Assigned - Awaiting Acceptance',
      'accepted': 'Accepted by Volunteer',
      'pickup_reached': 'At Pickup Location',
      'picked': 'Food Picked Up',
      'in_transit': 'In Transit - Live Tracking'
    }[task.status] || task.status;

    // Check if tracking data available
    enriched.hasLiveTracking = task.status === 'in_transit' && task.currentLocation?.lat != null;
    
    // Format timestamps
    if (task.acceptedAt) enriched.acceptedAtFormatted = new Date(task.acceptedAt).toLocaleString();
    if (task.pickupReachedAt) enriched.pickupReachedAtFormatted = new Date(task.pickupReachedAt).toLocaleString();
    if (task.pickedAt) enriched.pickedAtFormatted = new Date(task.pickedAt).toLocaleString();
    if (task.inTransitAt) enriched.inTransitAtFormatted = new Date(task.inTransitAt).toLocaleString();
    if (task.estimatedArrivalTime) enriched.etaFormatted = new Date(task.estimatedArrivalTime).toLocaleString();

    // Recipient info
    if (task.donationId?.recipientType === 'other_needy' && task.donationId.customRecipient) {
      enriched.recipientName = task.donationId.customRecipient.name;
      enriched.recipientType = 'Other Needy People';
    } else if (task.beneficiaryId) {
      const b = task.beneficiaryId;
      enriched.recipientName = b.partnerName ? `${b.name} & ${b.partnerName}` : b.name;
      enriched.recipientType = 'Elderly Couple';
    } else {
      enriched.recipientName = 'NGO Collection Point';
      enriched.recipientType = 'Collection';
    }

    return enriched;
  });

  // Separate in-transit deliveries for live map view
  const inTransitTasks = enrichedTasks.filter(t => t.status === 'in_transit');
  const otherTasks = enrichedTasks.filter(t => t.status !== 'in_transit');

  res.render('ngo/logistics', { 
    title: 'Live Logistics Tracking', 
    inTransitTasks,
    otherTasks,
    allTasks: enrichedTasks
  });
};

// ---------------------------------------------------------------------------
// Transparency — admin-wide donation tracking lookup by code
// ---------------------------------------------------------------------------
exports.getTrack = async (req, res) => {
  const { code } = req.query;
  let donation = null;
  let notFound = false;

  if (code) {
    donation = await Donation.findOne({ donationCode: code.trim().toUpperCase(), ngoId: req.user._id })
      .populate('donorId', 'name phone')
      .populate('assignedVolunteerId', 'name phone');
    if (!donation) notFound = true;
  }

  res.render('ngo/track', { title: 'Track a Donation', donation, code: code || '', notFound });
};

// ---------------------------------------------------------------------------
// Reports — reads the trigger-maintained Report collection, no live aggregation
// ---------------------------------------------------------------------------
exports.getReports = async (req, res) => {
  const last30 = await Report.find({}).sort({ date: -1 }).limit(30);

  const totals = last30.reduce(
    (acc, r) => {
      acc.donationsDelivered += r.donationsDelivered;
      acc.mealsDelivered += r.mealsDelivered;
      acc.itemsDistributed += r.itemsDistributed;
      acc.moneyRaised += r.moneyRaised;
      acc.skillHoursOffered += r.skillHoursOffered;
      acc.wasteReducedKg += r.wasteReducedKg;
      return acc;
    },
    { donationsDelivered: 0, mealsDelivered: 0, itemsDistributed: 0, moneyRaised: 0, skillHoursOffered: 0, wasteReducedKg: 0 }
  );

  res.render('ngo/reports', { title: 'Reports', last30, totals });
};

// ---------------------------------------------------------------------------
// Emergency Mode
// ---------------------------------------------------------------------------
exports.getEmergency = async (req, res) => {
  const alerts = await EmergencyAlert.find({}).sort({ isActive: -1, createdAt: -1 }).populate('createdBy', 'name');
  res.render('ngo/emergency', { title: 'Emergency Mode', alerts, errors: null, notified: req.query.notified });
};

exports.postEmergency = async (req, res) => {
  const { title, message, address, lat, lng, radiusKm } = req.body;

  if (!title || !lat || !lng) {
    const alerts = await EmergencyAlert.find({}).sort({ isActive: -1, createdAt: -1 }).populate('createdBy', 'name');
    return res.status(400).render('ngo/emergency', {
      title: 'Emergency Mode',
      alerts,
      errors: ['Title and a location (latitude/longitude) are required.'],
    });
  }

  const alert = await EmergencyAlert.create({
    title,
    message: message || '',
    createdBy: req.user._id,
    area: { address: address || '', lat: Number(lat), lng: Number(lng), radiusKm: radiusKm ? Number(radiusKm) : 5 },
  });

  // Push to volunteers actually within range right now — computed here rather
  // than stored as a flag, so it's always accurate to current volunteer locations.
  const candidates = await Volunteer.find({
    ngoId: req.user._id,
    isApproved: true,
    isActive: true,
    'location.lat': { $ne: null },
    'location.lng': { $ne: null },
  }).select('_id location');

  const nearbyIds = candidates
    .filter((v) => haversineDistanceKm(alert.area.lat, alert.area.lng, v.location.lat, v.location.lng) <= alert.area.radiusKm)
    .map((v) => v._id.toString());

  emitEmergencyAlert(alert, nearbyIds);

  res.redirect(`/admin/emergency?notified=${nearbyIds.length}`);
};

exports.postResolveEmergency = async (req, res) => {
  await EmergencyAlert.findByIdAndUpdate(req.params.id, { isActive: false, resolvedAt: new Date() });
  res.redirect('/admin/emergency');
};


// ---------------------------------------------------------------------------
// Real-time Tracking API - Get live delivery locations
// ---------------------------------------------------------------------------
exports.getTrackingData = async (req, res) => {
  try {
    const tasks = await Task.find({
      ngoAssignedBy: req.user._id,
      status: 'in_transit',
    })
      .populate('donationId', 'donationCode type quantity recipientType customRecipient')
      .populate('foodRequestId', 'numberOfPeople foodPreference')
      .populate('beneficiaryId', 'name partnerName phone')
      .populate('volunteerId', 'name phone');

    const trackingData = tasks.map(task => ({
      taskId: task._id,
      donationCode: task.donationId?.donationCode || 'N/A',
      volunteerName: task.volunteerId?.name || 'Unknown',
      volunteerPhone: task.volunteerId?.phone || '',
      pickup: task.pickupLocation,
      delivery: task.deliveryLocation,
      currentLocation: task.currentLocation,
      estimatedArrival: task.estimatedArrivalTime,
      distanceRemaining: task.routeDistance,
      durationRemaining: task.routeDuration,
      status: task.status,
      inTransitAt: task.inTransitAt,
      recipientType: task.donationId?.recipientType || (task.beneficiaryId ? 'elderly_couple' : 'other'),
      recipientName: task.customRecipient?.name || 
                    (task.beneficiaryId ? `${task.beneficiaryId.name}${task.beneficiaryId.partnerName ? ' & ' + task.beneficiaryId.partnerName : ''}` : 'Unknown'),
    }));

    res.json({ success: true, deliveries: trackingData });
  } catch (error) {
    console.error('[ngo] Tracking data error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tracking data' });
  }
};
