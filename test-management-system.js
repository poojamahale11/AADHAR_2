/**
 * Test script for Complete Management System
 * This validates all components are properly integrated
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Complete Management System...\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ ${description}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${error.message}`);
  }
}

// Test 1: Main view file exists
test('Main management-center.ejs view exists', () => {
  const viewPath = path.join(__dirname, 'views/ngo/management-center.ejs');
  if (!fs.existsSync(viewPath)) {
    throw new Error('File not found');
  }
});

// Test 2: All partial files exist
const partials = [
  'management-donations.ejs',
  'management-food-requests.ejs',
  'management-active-deliveries.ejs',
  'management-history.ejs',
  'management-regular-users.ejs'
];

partials.forEach(partial => {
  test(`Partial ${partial} exists`, () => {
    const partialPath = path.join(__dirname, 'views/ngo/partials', partial);
    if (!fs.existsSync(partialPath)) {
      throw new Error('File not found');
    }
  });
});

// Test 3: Controller has getManagementView method
test('ngoController has getManagementView method', () => {
  const controller = require('./controllers/ngoController');
  if (typeof controller.getManagementView !== 'function') {
    throw new Error('getManagementView method not found');
  }
});

// Test 4: Route is properly configured
test('Route /admin/manage is configured', () => {
  const routesContent = fs.readFileSync(
    path.join(__dirname, 'routes/ngoRoutes.js'),
    'utf-8'
  );
  if (!routesContent.includes("'/manage'") && !routesContent.includes('"/manage"')) {
    throw new Error('Route not found');
  }
  if (!routesContent.includes('getManagementView')) {
    throw new Error('Controller method not linked');
  }
});

// Test 5: Models are accessible
test('Donation model can be loaded', () => {
  const Donation = require('./models/Donation');
  if (!Donation) throw new Error('Model not found');
});

test('FoodRequest model can be loaded', () => {
  const FoodRequest = require('./models/FoodRequest');
  if (!FoodRequest) throw new Error('Model not found');
});

test('Task model can be loaded', () => {
  const Task = require('./models/Task');
  if (!Task) throw new Error('Model not found');
});

test('User models can be loaded', () => {
  const { Volunteer, Elderly, Donor } = require('./models/User');
  if (!Volunteer || !Elderly || !Donor) throw new Error('User models not found');
});

// Test 6: View includes all required partials
test('Management center includes all partials', () => {
  const viewContent = fs.readFileSync(
    path.join(__dirname, 'views/ngo/management-center.ejs'),
    'utf-8'
  );
  
  const requiredPartials = [
    'management-donations',
    'management-food-requests',
    'management-active-deliveries',
    'management-history',
    'management-regular-users'
  ];
  
  requiredPartials.forEach(partial => {
    if (!viewContent.includes(partial)) {
      throw new Error(`Partial ${partial} not included in view`);
    }
  });
});

// Test 7: Key features in donations partial
test('Donations partial has filtering and sorting', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/partials/management-donations.ejs'),
    'utf-8'
  );
  
  if (!content.includes('donation-filter')) {
    throw new Error('Filter not found');
  }
  if (!content.includes('donation-sort')) {
    throw new Error('Sort not found');
  }
  if (!content.includes('flow-visualization')) {
    throw new Error('Flow visualization not found');
  }
  if (!content.includes('isRegularDonor')) {
    throw new Error('Regular donor identification not found');
  }
});

// Test 8: Key features in food requests partial
test('Food requests partial has urgency sorting', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/partials/management-food-requests.ejs'),
    'utf-8'
  );
  
  if (!content.includes('urgency')) {
    throw new Error('Urgency sorting not found');
  }
  if (!content.includes('isRegularRequester')) {
    throw new Error('Regular requester identification not found');
  }
  if (!content.includes('foodPreference')) {
    throw new Error('Food preference display not found');
  }
  if (!content.includes('numberOfPeople')) {
    throw new Error('Number of people display not found');
  }
});

// Test 9: Active deliveries has timeline
test('Active deliveries has status timeline', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/partials/management-active-deliveries.ejs'),
    'utf-8'
  );
  
  if (!content.includes('status-timeline')) {
    throw new Error('Status timeline not found');
  }
  if (!content.includes('timeline-step')) {
    throw new Error('Timeline steps not found');
  }
  if (!content.includes('flow-visualization')) {
    throw new Error('Flow visualization not found');
  }
});

// Test 10: History has filtering
test('History partial has type and time filtering', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/partials/management-history.ejs'),
    'utf-8'
  );
  
  if (!content.includes('history-type-filter')) {
    throw new Error('Type filter not found');
  }
  if (!content.includes('history-time-filter')) {
    throw new Error('Time filter not found');
  }
  if (!content.includes('history-details')) {
    throw new Error('Expandable details not found');
  }
});

// Test 11: Regular users panels exist
test('Regular users has donor and elderly panels', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/partials/management-regular-users.ejs'),
    'utf-8'
  );
  
  if (!content.includes('Regular Donors')) {
    throw new Error('Regular donors panel not found');
  }
  if (!content.includes('Frequent Requesters')) {
    throw new Error('Frequent requesters panel not found');
  }
  if (!content.includes('achievement-badge')) {
    throw new Error('Achievement badges not found');
  }
  if (!content.includes('summary-stats')) {
    throw new Error('Summary statistics not found');
  }
});

// Test 12: Dashboard has link to management center
test('NGO dashboard has link to management center', () => {
  const content = fs.readFileSync(
    path.join(__dirname, 'views/ngo/dashboard.ejs'),
    'utf-8'
  );
  
  if (!content.includes('/admin/manage')) {
    throw new Error('Link to management center not found in dashboard');
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${passedTests}/${totalTests} passed`);
console.log('='.repeat(50));

if (passedTests === totalTests) {
  console.log('\n✅ All tests passed! Management system is ready.');
  console.log('\n🚀 Next steps:');
  console.log('   1. Start the server: npm start');
  console.log('   2. Login as NGO admin');
  console.log('   3. Navigate to: http://localhost:3000/admin/manage');
  console.log('   4. Or click "📊 Open Management Center" on dashboard');
  console.log('\n📋 Features available:');
  console.log('   ✓ View all donations with status tracking');
  console.log('   ✓ View all food requests sorted by urgency');
  console.log('   ✓ Real-time active deliveries tracking');
  console.log('   ✓ Complete history with filtering');
  console.log('   ✓ Regular donors and frequent requesters identification');
  console.log('   ✓ Complete flow visualization: Donor → Donation → Volunteer → Receiver → Status');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review the errors above.');
  process.exit(1);
}
