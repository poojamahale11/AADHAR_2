const FoodRequest = require('../models/FoodRequest');
const { Elderly, Volunteer } = require('../models/User');

exports.getDashboard = async (req, res) => {
  const [household, requests] = await Promise.all([
    Elderly.findById(req.user._id),
    FoodRequest.find({ householdId: req.user._id }).sort({ createdAt: -1 }).limit(10),
  ]);

  res.render('elderly/dashboard', {
    title: 'Food Support',
    household,
    requests,
    requested: req.query.requested === '1',
  });
};

exports.getRequestForm = (req, res) => {
  res.render('elderly/request-form', {
    title: 'Request Food Delivery',
    errors: null,
    formData: {
      deliveryAddress: req.user.homeAddress || '',
    },
  });
};

exports.postRequest = async (req, res) => {
  const { numberOfPeople, foodPreference, deliveryAddress, deliveryNote } = req.body;
  const formData = { numberOfPeople, foodPreference, deliveryAddress, deliveryNote };

  const errors = [];

  // Validate number of people
  if (!numberOfPeople || isNaN(numberOfPeople)) {
    errors.push('Please specify how many people need food.');
  } else if (numberOfPeople < 1 || numberOfPeople > 20) {
    errors.push('Number of people must be between 1 and 20.');
  }

  // Validate food preference
  if (!foodPreference || !['veg', 'non-veg'].includes(foodPreference)) {
    errors.push('Please select either Veg or Non-Veg preference.');
  }

  // Validate delivery address
  if (!deliveryAddress || !deliveryAddress.trim()) {
    errors.push('Please provide your delivery address.');
  }

  if (errors.length > 0) {
    return res.status(400).render('elderly/request-form', {
      title: 'Request Food Delivery',
      errors,
      formData,
    });
  }

  try {
    // Generate requirements text for backward compatibility
    const requirementsText = `Food for ${numberOfPeople} ${numberOfPeople === 1 ? 'person' : 'people'} - ${foodPreference === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}`;

    await FoodRequest.create({
      householdId: req.user._id,
      numberOfPeople: parseInt(numberOfPeople, 10),
      foodPreference: foodPreference,
      deliveryAddress: deliveryAddress.trim(),
      deliveryNote: deliveryNote ? deliveryNote.trim() : '',
      phone: req.user.phone,
      requirements: requirementsText, // For backward compatibility
    });
    res.redirect('/elderly/dashboard?requested=1');
  } catch (err) {
    console.error('[elderly] food request error:', err);
    res.status(500).render('elderly/request-form', {
      title: 'Request Food Delivery',
      errors: ['We could not save your request. Please try again.'],
      formData,
    });
  }
};

exports.getRequestDetail = async (req, res) => {
  const request = await FoodRequest.findOne({
    _id: req.params.id,
    householdId: req.user._id,
  }).populate('assignedVolunteerId', 'name phone avgRating');

  if (!request) {
    return res.status(404).render('error', {
      title: 'Not found',
      message: 'Food request not found.',
    });
  }

  res.render('elderly/request-detail', {
    title: 'Track Your Food Request',
    request,
  });
};
