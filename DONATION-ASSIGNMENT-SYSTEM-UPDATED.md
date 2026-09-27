# 🎯 Donation Assignment System - Complete Update

## ✅ What's Been Updated

### 1. **Enhanced Database Models**

#### Donation Model (`models/Donation.js`)
**New Fields Added:**
- `recipientType` - Either 'elderly_couple' or 'other_needy'
- `assignedFoodRequestId` - Links donation to elderly couple food request
- `customRecipient` - Complete details for "Other Needy People":
  - name, contactPerson, phone, address
  - lat/lng coordinates for mapping
  - requiredDateTime
  - notes

#### FoodRequest Model (`models/FoodRequest.js`)
**New Fields Added:**
- `requiredDateTime` - When elderly couple needs the food (for sorting by urgency)
- `location.lat` and `location.lng` - GPS coordinates for mapping
- `assignedDonationId` - Links to the donation assigned to this request

#### Task Model (`models/Task.js`)
**New Fields Added:**
- `customRecipient` - Name, contact, phone for other needy people
- `currentLocation` - Real-time GPS tracking:
  - lat, lng, lastUpdated
- `estimatedArrivalTime` - Calculated ETA
- `routeDistance` - Distance remaining in km
- `routeDuration` - Time remaining in minutes

---

### 2. **Assignment Logic Updates**

#### NGO Controller (`controllers/ngoController.js`)

**`getAssignDonation` Method - Enhanced:**
- Now fetches elderly couples WITH active food requests only
- Sorts food requests by `requiredDateTime` (urgent first)
- Shows complete details:
  - Couple name
  - Food requirement (people count, veg/non-veg)
  - Required date/time
  - Full address
  - Current request status
  - Whether already assigned to another donation

**`postAssignVolunteer` Method - Completely Rewritten:**

**Now supports 2 recipient types:**

**1. Elderly Couple Assignment:**
- Select from food requests sorted by urgency
- Shows only unassigned or in-progress requests
- Links donation to food request
- Creates task with elderly couple as beneficiary
- Updates both donation and food request with cross-references

**2. Other Needy People Assignment:**
- Admin enters custom details:
  - Recipient name/place
  - Contact person
  - Phone number
  - Delivery address
  - GPS coordinates (optional)
  - Required date/time
  - Notes
- Creates task with custom recipient details
- No beneficiary user (not registered)

**Form Validation:**
- Validates all required fields
- Shows errors and preserves form data
- Re-renders form with data if validation fails

---

### 3. **Real-Time Tracking System**

#### Volunteer Controller (`controllers/volunteerController.js`)

**New Methods Added:**

**`postUpdateLocation` - Location Updates:**
- Volunteer's app sends GPS coordinates
- Updates `currentLocation` with timestamp
- Calculates distance to destination
- Estimates arrival time (30 km/h avg speed)
- Emits real-time socket update
- Returns distance remaining and ETA

**`getActiveDelivery` - Current Delivery Info:**
- Returns volunteer's active in-transit task
- Includes all location data
- Pickup and delivery coordinates
- Current position
- Route details

#### NGO Controller (`controllers/ngoController.js`)

**`getLogistics` Method - Enhanced:**
- Fetches all active deliveries (assigned to delivered)
- Prioritizes in-transit deliveries first
- Enriches with status labels:
  - "Assigned - Awaiting Acceptance"
  - "Accepted by Volunteer"
  - "At Pickup Location"
  - "Food Picked Up"
  - "In Transit - Live Tracking"
- Identifies recipient type (elderly vs other)
- Formats timestamps
- Separates in-transit tasks for map view
- Checks if live tracking data available

**`getTrackingData` - API Endpoint:**
- Returns JSON for all in-transit deliveries
- Real-time location updates
- Distance and ETA
- Volunteer details
- Pickup and delivery locations
- Recipient information

---

### 4. **API Endpoints Added**

#### Volunteer Routes (`routes/volunteerRoutes.js`)
```javascript
POST /volunteer/location/update
  - Body: { taskId, lat, lng }
  - Updates real-time location
  - Returns: distance remaining, ETA

GET /volunteer/delivery/active
  - Returns current active delivery
  - All tracking data included
```

#### NGO Routes (`routes/ngoRoutes.js`)
```javascript
GET /admin/api/tracking
  - Returns all in-transit deliveries
  - Real-time location data
  - For map/dashboard updates
```

---

## 🔄 Complete Assignment Flow

### Flow 1: Assign to Elderly Couple

```
1. NGO Admin clicks "Assign" on pending donation
   ↓
2. System shows:
   - List of volunteers (sorted by availability/distance)
   - Elderly couples with ACTIVE food requests
   - Sorted by required date/time (urgent first)
   ↓
3. Each elderly request shows:
   - Couple name
   - Number of people
   - Veg/Non-veg preference
   - Required date/time
   - Full delivery address
   - Current status
   ↓
4. Admin selects:
   - Volunteer
   - Recipient type: "Elderly Couple"
   - Food request from list
   ↓
5. System creates:
   - Task linking donation → volunteer → elderly couple
   - Updates donation with recipientType='elderly_couple'
   - Links donation.assignedFoodRequestId → food request
   - Links foodRequest.assignedDonationId → donation
   - Sets donation status to 'assigned'
   ↓
6. Volunteer receives assignment notification
   ↓
7. Complete delivery flow:
   Assigned → Accepted → Pickup Reached → Picked → 
   In Transit → Delivered
```

### Flow 2: Assign to Other Needy People

```
1. NGO Admin clicks "Assign" on pending donation
   ↓
2. Admin selects:
   - Volunteer
   - Recipient type: "Other Needy People"
   ↓
3. Form appears for custom recipient:
   - Name/Place (e.g., "Homeless Shelter")
   - Contact person
   - Phone number
   - Delivery address
   - GPS coordinates (optional - for maps)
   - Required date/time
   - Notes
   ↓
4. System creates:
   - Task with custom recipient details
   - Updates donation with recipientType='other_needy'
   - Stores all custom recipient data in donation
   - No beneficiaryId (not a registered user)
   ↓
5. Volunteer receives assignment with full details
   ↓
6. Complete delivery flow (same as above)
```

---

## 📍 Real-Time Tracking Flow

### Volunteer Side:

```
1. Volunteer accepts task
   ↓
2. Reaches pickup location → marks "Pickup Reached"
   ↓
3. Picks up food → marks "Picked"
   ↓
4. Starts delivery → marks "Start Delivery"
   - Status changes to 'in_transit'
   - Delivery OTP sent to recipient
   ↓
5. Volunteer's app automatically sends GPS updates:
   - Every 30 seconds (or on movement)
   - POST /volunteer/location/update
   - Body: { taskId, lat, lng }
   ↓
6. System calculates for each update:
   - Distance to destination (haversine formula)
   - Estimated arrival time (30 km/h average)
   - Updates task.currentLocation
   - Emits socket event for real-time update
   ↓
7. Arrives at destination → enters OTP → delivers
   - Takes proof photo
   - Marks as delivered
```

### NGO Admin Side:

```
1. Admin visits /admin/logistics
   ↓
2. Page shows two sections:
   
   A. In-Transit Deliveries (Live Tracking):
      - Real-time map with volunteer locations
      - Moving markers
      - Route lines (pickup → current → delivery)
      - ETA display
      - Distance remaining
      
   B. Other Active Tasks:
      - Assigned (awaiting acceptance)
      - Accepted
      - At pickup
      - Picked up
   ↓
3. JavaScript polls /admin/api/tracking every 10 seconds
   - Gets latest positions
   - Updates map markers
   - Refreshes ETA displays
   ↓
4. Each delivery shows:
   - Volunteer name & phone
   - Donation code
   - Recipient type & name
   - Current status
   - Live location (if in-transit)
   - Estimated arrival
   - Full address details
```

---

## 🗂️ Data Structure Examples

### Donation with Elderly Couple:
```javascript
{
  _id: "...",
  donationCode: "AAD-2026-ABC123",
  type: "food",
  quantity: 20,
  unit: "plates",
  status: "in_transit",
  recipientType: "elderly_couple",
  assignedFoodRequestId: "...",  // Links to FoodRequest
  assignedVolunteerId: "...",
  // ... other fields
}
```

### Donation with Other Needy:
```javascript
{
  _id: "...",
  donationCode: "AAD-2026-XYZ789",
  type: "food",
  quantity: 50,
  unit: "kg",
  status: "assigned",
  recipientType: "other_needy",
  customRecipient: {
    name: "City Homeless Shelter",
    contactPerson: "John Manager",
    phone: "9876543210",
    address: "123 Main St, Downtown",
    lat: 18.5204,
    lng: 73.8567,
    requiredDateTime: "2026-09-20T18:00:00Z",
    notes: "Evening meal for 50 people"
  },
  assignedVolunteerId: "...",
  // ... other fields
}
```

### Food Request (Elderly Couple):
```javascript
{
  _id: "...",
  householdId: "...",  // Elderly couple user ID
  numberOfPeople: 2,
  foodPreference: "veg",
  deliveryAddress: "45 Sunset Road, Apt 12",
  phone: "9988776655",
  requiredDateTime: "2026-09-19T19:00:00Z",  // URGENT - Tonight!
  location: {
    lat: 18.5314,
    lng: 73.8446
  },
  status: "assigned",
  assignedVolunteerId: "...",
  assignedDonationId: "...",  // Links back to donation
  // ... other fields
}
```

### Task with Live Tracking:
```javascript
{
  _id: "...",
  donationId: "...",
  volunteerId: "...",
  beneficiaryId: "...",  // or null for custom recipients
  
  pickupLocation: {
    address: "Hotel Grand, Kitchen Entrance",
    lat: 18.5150,
    lng: 73.8530
  },
  
  deliveryLocation: {
    address: "45 Sunset Road, Apt 12",
    lat: 18.5314,
    lng: 73.8446
  },
  
  // Real-time tracking
  currentLocation: {
    lat: 18.5240,
    lng: 73.8490,
    lastUpdated: "2026-09-19T18:45:30Z"
  },
  
  estimatedArrivalTime: "2026-09-19T19:05:00Z",
  routeDistance: 1.8,  // km
  routeDuration: 3.6,  // minutes
  
  status: "in_transit",
  inTransitAt: "2026-09-19T18:30:00Z",
  
  customRecipient: {  // Only if "other_needy"
    name: "...",
    phone: "..."
  },
  
  deliveryOtp: "ABC123",
  // ... other fields
}
```

---

## 🎨 Frontend Integration

### Assignment Form Structure:

```html
<form method="POST" action="/admin/donations/:id/assign">
  
  <!-- Select Volunteer -->
  <select name="volunteerId" required>
    <option value="">Choose Volunteer...</option>
    <!-- Volunteers sorted by availability/distance -->
  </select>
  
  <!-- Select Recipient Type -->
  <div class="recipient-type-selector">
    <input type="radio" name="recipientType" value="elderly_couple" id="type-elderly">
    <label for="type-elderly">Elderly Couple</label>
    
    <input type="radio" name="recipientType" value="other_needy" id="type-other">
    <label for="type-other">Other Needy People</label>
  </div>
  
  <!-- Option 1: Elderly Couple (shown when elderly_couple selected) -->
  <div id="elderly-section" style="display:none;">
    <label>Select Food Request (Sorted by Required Time):</label>
    <select name="foodRequestId">
      <% elderlyCouplesWithRequests.forEach(request => { %>
        <option value="<%= request.foodRequestId %>"
                <%= request.isAlreadyAssigned ? 'disabled' : '' %>>
          <%= request.name %> 
          <% if (request.partnerName) { %>& <%= request.partnerName %><% } %>
          - <%= request.numberOfPeople %> people
          - <%= request.foodPreference %>
          - Required: <%= formatDateTime(request.requiredDateTime) %>
          - <%= request.address %>
          <% if (request.isAlreadyAssigned) { %>(Already Assigned)<% } %>
        </option>
      <% }); %>
    </select>
  </div>
  
  <!-- Option 2: Other Needy (shown when other_needy selected) -->
  <div id="other-section" style="display:none;">
    <input type="text" name="customRecipientName" placeholder="Recipient Name/Place *" required>
    <input type="text" name="customRecipientContact" placeholder="Contact Person">
    <input type="tel" name="customRecipientPhone" placeholder="Phone Number">
    <textarea name="customRecipientAddress" placeholder="Delivery Address *" required></textarea>
    
    <!-- Optional: Map picker for coordinates -->
    <div class="map-picker">
      <input type="hidden" name="customRecipientLat">
      <input type="hidden" name="customRecipientLng">
      <div id="map"></div>
    </div>
    
    <input type="datetime-local" name="customRecipientDateTime" placeholder="Required Date/Time">
    <textarea name="customRecipientNotes" placeholder="Additional Notes"></textarea>
  </div>
  
  <button type="submit">Assign Donation</button>
</form>

<script>
// Show/hide sections based on recipient type selection
document.querySelectorAll('input[name="recipientType"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    if (e.target.value === 'elderly_couple') {
      document.getElementById('elderly-section').style.display = 'block';
      document.getElementById('other-section').style.display = 'none';
    } else {
      document.getElementById('elderly-section').style.display = 'none';
      document.getElementById('other-section').style.display = 'block';
    }
  });
});
</script>
```

### Real-Time Tracking Map:

```html
<!-- views/ngo/logistics.ejs -->
<div class="tracking-dashboard">
  
  <!-- Live Map -->
  <div class="map-container">
    <div id="live-map" style="height: 600px;"></div>
  </div>
  
  <!-- Delivery List -->
  <div class="deliveries-list">
    <h3>In-Transit Deliveries (<span id="count"><%= inTransitTasks.length %></span>)</h3>
    
    <div id="active-deliveries">
      <% inTransitTasks.forEach(task => { %>
        <div class="delivery-card" data-task-id="<%= task._id %>">
          <div class="delivery-header">
            <strong><%= task.donation?.donationCode || 'Food Request' %></strong>
            <span class="status-badge in-transit">🚚 <%= task.statusLabel %></span>
          </div>
          
          <div class="delivery-details">
            <p><strong>Volunteer:</strong> <%= task.volunteerId.name %> (<%= task.volunteerId.phone %>)</p>
            <p><strong>Recipient:</strong> <%= task.recipientName %> (<%= task.recipientType %>)</p>
            <p><strong>Delivery:</strong> <%= task.deliveryLocation.address %></p>
            
            <% if (task.hasLiveTracking) { %>
              <div class="tracking-info">
                <p>📍 <strong>Distance:</strong> <span class="distance"><%= task.routeDistance?.toFixed(1) || '--' %></span> km</p>
                <p>⏱️ <strong>ETA:</strong> <span class="eta"><%= task.etaFormatted || 'Calculating...' %></span></p>
                <p>🕐 <strong>Last Update:</strong> <span class="last-update"><%= formatTime(task.currentLocation.lastUpdated) %></span></p>
              </div>
            <% } else { %>
              <p class="no-tracking">📍 Waiting for live location updates...</p>
            <% } %>
          </div>
        </div>
      <% }); %>
    </div>
  </div>
</div>

<script>
let map, markers = {};

// Initialize map
function initMap() {
  map = new google.maps.Map(document.getElementById('live-map'), {
    center: { lat: 18.5204, lng: 73.8567 },
    zoom: 12
  });
  
  // Initial markers
  fetchAndUpdateTracking();
  
  // Poll for updates every 10 seconds
  setInterval(fetchAndUpdateTracking, 10000);
}

// Fetch real-time tracking data
async function fetchAndUpdateTracking() {
  try {
    const response = await fetch('/admin/api/tracking');
    const data = await response.json();
    
    if (data.success) {
      updateMap(data.deliveries);
      updateList(data.deliveries);
    }
  } catch (error) {
    console.error('Tracking update failed:', error);
  }
}

// Update map markers
function updateMap(deliveries) {
  deliveries.forEach(delivery => {
    if (!delivery.currentLocation?.lat) return;
    
    const position = {
      lat: delivery.currentLocation.lat,
      lng: delivery.currentLocation.lng
    };
    
    if (markers[delivery.taskId]) {
      // Update existing marker
      markers[delivery.taskId].setPosition(position);
    } else {
      // Create new marker
      markers[delivery.taskId] = new google.maps.Marker({
        position: position,
        map: map,
        title: delivery.volunteerName,
        icon: {
          url: '/images/delivery-truck-icon.png',
          scaledSize: new google.maps.Size(40, 40)
        },
        label: {
          text: delivery.donationCode,
          color: 'white',
          fontSize: '12px'
        }
      });
      
      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div>
            <h4>${delivery.donationCode}</h4>
            <p><strong>${delivery.volunteerName}</strong></p>
            <p>→ ${delivery.recipientName}</p>
            <p>📍 ${delivery.distanceRemaining?.toFixed(1) || '--'} km away</p>
            <p>⏱️ ETA: ${formatTime(delivery.estimatedArrival)}</p>
          </div>
        `
      });
      
      markers[delivery.taskId].addListener('click', () => {
        infoWindow.open(map, markers[delivery.taskId]);
      });
    }
  });
}

// Update delivery list
function updateList(deliveries) {
  deliveries.forEach(delivery => {
    const card = document.querySelector(`[data-task-id="${delivery.taskId}"]`);
    if (!card) return;
    
    // Update distance
    const distanceEl = card.querySelector('.distance');
    if (distanceEl && delivery.distanceRemaining) {
      distanceEl.textContent = delivery.distanceRemaining.toFixed(1);
    }
    
    // Update ETA
    const etaEl = card.querySelector('.eta');
    if (etaEl && delivery.estimatedArrival) {
      etaEl.textContent = formatTime(delivery.estimatedArrival);
    }
    
    // Update last update time
    const lastUpdateEl = card.querySelector('.last-update');
    if (lastUpdateEl && delivery.currentLocation?.lastUpdated) {
      lastUpdateEl.textContent = formatTime(delivery.currentLocation.lastUpdated);
    }
  });
}

function formatTime(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleTimeString();
}

// Initialize when page loads
google.maps.event.addDomListener(window, 'load', initMap);
</script>
```

---

## 📊 Benefits of Updated System

### 1. **Better Assignment Logic**
- ✅ Prioritizes urgent food requests (sorted by required time)
- ✅ Shows only elderly couples who actually need food
- ✅ Prevents duplicate assignments
- ✅ Supports flexible recipient types

### 2. **Complete Recipient Information**
- ✅ For elderly: linked to their food request with all details
- ✅ For others: custom fields for any recipient type
- ✅ GPS coordinates for accurate mapping
- ✅ Required date/time for planning

### 3. **Real-Time Tracking**
- ✅ Live GPS updates from volunteers
- ✅ Automatic ETA calculation
- ✅ Distance remaining display
- ✅ Map visualization for NGO admin
- ✅ No dummy data - all real deliveries

### 4. **Data Integrity**
- ✅ Cross-references between donations and food requests
- ✅ Complete audit trail
- ✅ Status history preserved
- ✅ No orphaned records

### 5. **Better UX**
- ✅ Clear recipient type selection
- ✅ Sorted by urgency
- ✅ Shows already-assigned status
- ✅ Form validation with helpful errors
- ✅ Live updates without page refresh

---

## 🧪 Testing the New System

### Test Assignment to Elderly Couple:

```bash
# 1. Create elderly user with food request
node -e "
const mongoose = require('mongoose');
const { Elderly } = require('./models/User');
const FoodRequest = require('./models/FoodRequest');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aadhar');

// Create elderly couple
const couple = await Elderly.create({
  name: 'Test Elder',
  partnerName: 'Test Partner',
  email: 'test.elder@example.com',
  phone: '9999888877',
  homeAddress: '123 Elder Street',
  isActive: true
});

// Create urgent food request
const request = await FoodRequest.create({
  householdId: couple._id,
  numberOfPeople: 2,
  foodPreference: 'veg',
  deliveryAddress: couple.homeAddress,
  phone: couple.phone,
  requiredDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
  location: { lat: 18.5314, lng: 73.8446 },
  status: 'pending'
});

console.log('Created elderly couple and food request');
console.log('Food Request ID:', request._id);
"

# 2. Go to /admin/donations
# 3. Click "Assign" on any pending donation
# 4. Select recipient type: "Elderly Couple"
# 5. Should see the test request at top (sorted by time)
# 6. Select volunteer and assign
# 7. Verify links created in both donation and food request
```

### Test Assignment to Other Needy:

```bash
# 1. Go to /admin/donations
# 2. Click "Assign" on pending donation
# 3. Select recipient type: "Other Needy People"
# 4. Fill form:
#    - Name: "Downtown Homeless Shelter"
#    - Contact: "John Smith"
#    - Phone: "9876543210"
#    - Address: "456 Help Street"
#    - Date/Time: Tomorrow evening
# 5. Click "Assign"
# 6. Verify donation has customRecipient populated
# 7. Verify task created with custom details
```

### Test Real-Time Tracking:

```bash
# 1. Assign donation to volunteer
# 2. Volunteer accepts → marks pickup reached → picked → start delivery
# 3. Status changes to "in_transit"
# 4. Simulate GPS update:

curl -X POST http://localhost:3000/volunteer/location/update \
  -H "Content-Type: application/json" \
  -H "Cookie: <volunteer-session-cookie>" \
  -d '{
    "taskId": "<task-id>",
    "lat": 18.5240,
    "lng": 73.8490
  }'

# 5. Check response for distance and ETA
# 6. Go to /admin/logistics
# 7. Should see delivery on map with live location
# 8. Send another update with different coordinates
# 9. Marker should move on map
# 10. Distance and ETA should update
```

---

## 🔧 Troubleshooting

### Issue: Elderly couples not showing in assignment

**Check:**
1. Are there active food requests in database?
   ```javascript
   FoodRequest.find({ status: { $nin: ['delivered', 'cancelled'] } })
   ```
2. Are requests linked to active elderly users?
3. Is `requiredDateTime` set for sorting?

### Issue: Tracking not updating

**Check:**
1. Is task status `in_transit`?
2. Is volunteer sending location updates?
3. Check browser console for JavaScript errors
4. Verify `/admin/api/tracking` endpoint returns data
5. Check socket connection

### Issue: Custom recipient data not saving

**Check:**
1. Is `recipientType` set to `'other_needy'`?
2. Are all required fields filled?
3. Check validation errors in form
4. Verify `customRecipient` field in donation document

---

## ✅ Summary

**Models Updated:** 3 (Donation, FoodRequest, Task)
**Controllers Updated:** 2 (ngoController, volunteerController)
**Routes Updated:** 2 (ngoRoutes, volunteerRoutes)
**New API Endpoints:** 3
**New Features:** 5

All changes preserve existing data and functionality while adding:
- ✅ Two-type recipient system
- ✅ Urgent food request sorting
- ✅ Complete recipient details
- ✅ Real-time GPS tracking
- ✅ Live ETA calculation
- ✅ Map visualization

**Status: READY FOR IMPLEMENTATION** 🚀
