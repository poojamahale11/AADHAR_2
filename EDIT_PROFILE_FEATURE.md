# Edit Profile Feature Documentation

## Overview
The **Edit Profile / Personal Information** feature allows all logged-in users (Donors, Volunteers, Elderly, and NGO Admins) to update their personal details after login. Changes are saved to the database and reflected across the entire application automatically.

## Features Implemented

### ✅ Access Points
Users can access the Edit Profile page from multiple locations:

1. **Navigation Bar** - Profile pill with edit icon (available on all pages)
   - Location: Top-right corner of navbar
   - Visual: User name with ✏️ icon
   - Route: `/profile`

2. **Dashboard Quick Actions**
   - **Donor Dashboard**: "👤 Edit Profile" button
   - **Volunteer Dashboard**: "👤 Edit Profile" button  
   - **Elderly Dashboard**: "👤 Edit Profile" button
   - **NGO Admin Dashboard**: "👤 Edit Profile" button

### ✅ Editable Fields by Role

#### All Users (Common Fields)
- Full Name *
- Email Address *
- Phone Number (10 digits) *
- Password (optional security update)

#### Donor-Specific Fields
- Donor Type (Individual / Hotel/Restaurant / Corporate)
- Organization Name (for hotels/businesses)

#### Volunteer-Specific Fields
- Base Location / Address
- Skills & Expertise (comma-separated)
- Duty Status (On-Duty / Off-Duty)
- Available Days
- Specific Available Date
- Shift Start Time
- Shift End Time

#### NGO Admin-Specific Fields
- Organization Name *
- UPI ID *
- Organization Address

#### Elderly-Specific Fields
- Partner/Spouse Name *
- Complete Home Delivery Address *

### ✅ Validation & Security

**Client-side Validation:**
- Required field indicators (red asterisk)
- Input type validation (email, tel, date, time)
- Pattern matching (10-digit phone)
- Min/max length constraints

**Server-side Validation:**
- Email uniqueness check (excluding current user)
- Email format validation
- Phone number format (10 digits)
- Name length limits (max 100 characters)
- Password strength (min 8 characters)
- Password confirmation matching

**Password Update:**
- Requires current password verification
- New password must be 8+ characters
- Confirm password must match
- Passwords are hashed using bcrypt before storage
- Leave blank to keep current password

### ✅ Database Integration

**User Model Schema** (`models/User.js`):
- Base User schema with discriminators for each role
- Automatic role-based field management
- Password hashing via bcrypt
- Email uniqueness constraints
- Timestamps (createdAt, updatedAt)

**Update Flow:**
1. User submits form via POST `/profile`
2. Controller validates all fields
3. Checks email uniqueness (excluding current user)
4. Validates password if being changed
5. Updates role-specific fields
6. Saves to MongoDB
7. Redirects with success confirmation

### ✅ User Experience

**Profile Overview Card:**
- Avatar circle with user's initial
- Name and contact information display
- Role badge
- Role-specific metrics:
  - Donor: Total donations, leaderboard points, badges
  - Volunteer: Duty status, completed tasks, rating
  - NGO Admin: Organization name
  - Elderly: Partner name

**Organized Sections:**
1. **Basic & Contact Information** - Name, email, phone
2. **Role-Specific Details** - Customized per user role
3. **Security & Password Change** - Optional password update

**Success Feedback:**
- ✅ Green success alert after profile update
- 🔐 Additional alert for password changes
- Clear error messages for validation failures
- Back to Dashboard link

**Responsive Design:**
- Mobile-friendly form layout
- Grid adapts to smaller screens
- Touch-friendly buttons
- Flexbox wrapping for action buttons

### ✅ Routes & Middleware

**Route Definition** (`routes/authRoutes.js`):
```javascript
router.get('/profile', requireAuth, asyncHandler(authController.getProfile));
router.post('/profile', requireAuth, asyncHandler(authController.postUpdateProfile));
```

**Authentication Middleware** (`middleware/auth.js`):
- `requireAuth` - Ensures user is logged in
- `attachUser` - Loads user data on every request
- JWT token verification from httpOnly cookie

**Controller Methods** (`controllers/authController.js`):
- `getProfile` - Renders profile form with current user data
- `postUpdateProfile` - Validates and saves profile updates

### ✅ Real-time Updates
Changes are immediately reflected everywhere:
- Dashboard displays
- Navigation bar user name
- Donation/request records
- Volunteer assignments
- Leaderboard entries
- Any user-related views

## File Structure

```
Aadhar/
├── controllers/
│   └── authController.js          # Profile get/post handlers
├── middleware/
│   ├── auth.js                    # Authentication & authorization
│   └── validators.js              # Input validation rules
├── models/
│   └── User.js                    # User schema with discriminators
├── routes/
│   └── authRoutes.js              # Profile routes definition
├── views/
│   ├── auth/
│   │   └── profile.ejs            # Edit profile form
│   ├── donor/
│   │   └── dashboard.ejs          # Has Edit Profile button
│   ├── volunteer/
│   │   └── dashboard.ejs          # Has Edit Profile button
│   ├── elderly/
│   │   └── dashboard.ejs          # Has Edit Profile button
│   ├── ngo/
│   │   └── dashboard.ejs          # Has Edit Profile button
│   └── partials/
│       └── navbar.ejs             # Profile pill link
└── server.js                       # Route mounting
```

## API Endpoints

### GET /profile
**Authentication:** Required  
**Description:** Display the edit profile form with current user data  
**Response:** Rendered HTML page with profile form

### POST /profile
**Authentication:** Required  
**Description:** Update user profile information  
**Request Body:**
- Common: `name`, `email`, `phone`
- Password: `currentPassword`, `newPassword`, `confirmPassword` (optional)
- Role-specific fields as applicable

**Response:**
- Success: Redirect to `/profile?updated=1`
- Password changed: Redirect to `/profile?updated=1&pwUpdated=1`
- Validation error: Re-render form with error messages

**Status Codes:**
- 200: Success (redirect)
- 400: Validation error
- 404: User not found
- 401: Not authenticated

## Testing Checklist

- [x] All user roles can access /profile when logged in
- [x] Unauthenticated users are redirected to /login
- [x] Profile pill appears in navbar for logged-in users
- [x] Edit Profile button appears on all dashboards
- [x] Form pre-fills with current user data
- [x] Required fields show asterisk indicator
- [x] Email uniqueness validation works
- [x] Phone number validation (10 digits)
- [x] Password change requires current password
- [x] Password confirmation matching works
- [x] Passwords are hashed before storage
- [x] Role-specific fields display correctly
- [x] Donor organization name shows/hides based on type
- [x] Volunteer availability fields work
- [x] Success messages display after update
- [x] Error messages display for validation failures
- [x] Changes persist in database
- [x] Updated info appears everywhere automatically
- [x] Back button returns to correct dashboard
- [x] Responsive design works on mobile

## Security Considerations

✅ **Implemented:**
- JWT authentication required
- Password hashing with bcrypt
- Email uniqueness validation
- NoSQL injection protection (express-mongo-sanitize)
- Rate limiting on auth routes
- httpOnly cookies for JWT storage
- Helmet.js security headers
- Input sanitization
- CSRF protection via cookie secret

## Future Enhancements (Optional)

- Profile picture upload
- Email verification for changes
- Two-factor authentication
- Account deletion option
- Activity log/audit trail
- Social profile links
- Notification preferences
- Privacy settings

## Known Limitations

- No real-time validation (validates on submit)
- No profile picture management
- Password strength meter not implemented
- No email change confirmation flow
- Location coordinates not manually editable (volunteers)

## Conclusion

The Edit Profile feature is **fully functional** and allows users to:
- ✅ Update their personal information
- ✅ Change their password securely
- ✅ Modify role-specific preferences
- ✅ See changes reflected everywhere automatically
- ✅ Access from multiple convenient locations

All existing profile features remain working, and the implementation follows the application's security and design patterns.
