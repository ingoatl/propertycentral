# PeachHaus Property Manager - Authentication Guide

## 🔐 How to Login

### For New Users:
1. Go to the application URL
2. Click **"Don't have an account? Sign up"**
3. Enter your email and password (minimum 6 characters)
4. Click **"Sign Up"**
5. **IMPORTANT:** Your account will be in "pending" status
6. Wait for an administrator to approve your account
7. Once approved, you can log in normally

### For Existing Users:
1. Go to the application URL
2. Enter your email and password
3. Click **"Sign In"**
4. You'll stay logged in for up to **1 year** (automatic session refresh)

### If You Forgot Your Password:
1. Click **"Forgot password?"** on the login page
2. Enter your email address
3. Click **"Send Reset Link"**
4. Check your email for the password reset link
5. Click the link and set your new password
6. Return to the login page and sign in with your new password

---

## 👑 Admin Functions

### Making Someone an Admin:
To create the first admin (must be done via database):

1. Open Lovable Cloud backend dashboard
2. Go to the **profiles** table
3. Find the user you want to make admin
4. Set `is_admin` to `true` for that user
5. Save the changes

Once you have at least one admin, they can:
- Approve/reject new user signups
- Grant admin privileges to other users
- Revoke user access

### Admin Panel Features:
Access the admin panel at `/admin` (only visible to admins in the navigation)

**Pending Approvals:**
- View all users waiting for approval
- Click **"Approve"** to grant access
- Click **"Reject"** to deny access

**Approved Users:**
- See all active users
- Grant/revoke admin privileges
- Revoke access if needed

**Rejected Users:**
- View previously rejected users
- Re-approve if circumstances change

---

## ⏰ Session Duration

**Users stay logged in for up to 1 YEAR** with these features:
- Sessions persist in browser localStorage
- Automatic token refresh before expiration
- No need to log in repeatedly
- Only signed out when:
  - User clicks "Logout"
  - User clears browser data
  - Token is manually revoked

To configure the exact session duration:
1. Open your Lovable Cloud backend dashboard
2. Go to **Authentication** → **Settings**
3. Under **Security and Protection**:
   - Set **JWT Expiry** to `31536000` (1 year in seconds)
   - Enable **Auto Refresh Token**
4. Save changes

---

## 🔒 Security Features

### Account Approval System:
- New signups are automatically set to "pending"
- Users cannot access the app until approved by an admin
- Prevents unauthorized access
- Admins have full control over who can use the system

### Password Security:
- Minimum 6 characters required
- Passwords are encrypted (hashed) in database
- No one (including admins) can see user passwords
- Password reset available if forgotten

### Role-Based Access:
- Regular users can manage properties, visits, and expenses
- Admins can additionally manage user accounts
- All data requires authentication to access

---

## 📧 Email Configuration

### Current Setup:
- **Auto-confirm emails:** ENABLED (users don't need to verify email)
- **Password reset emails:** Sent automatically via Supabase
- **Edge function emails:** Require JWT authentication

### For Production Use:
Consider disabling auto-confirm and requiring email verification:
1. Go to Lovable Cloud backend → Authentication → Email Auth
2. Disable "Enable email confirmations"
3. Users will need to verify their email before logging in

---

## 🆘 Troubleshooting

### "Account Pending Approval" Message:
- Your account has been created but needs admin approval
- Contact an administrator to approve your account
- You cannot access the app until approved

### "Account Rejected" Message:
- Your account was rejected by an administrator
- Contact an administrator if you believe this is an error

### Can't Remember Password:
- Use the "Forgot password?" link on login page
- Check your email spam folder if you don't receive the reset email

### Need to Reset Someone's Password:
- Users must use the password reset feature themselves
- Admins cannot see or reset passwords directly
- This is a security feature to protect user data

---

## 🎯 First-Time Setup

1. **Create First Admin Account:**
   - Sign up normally through the app
   - Manually set `is_admin = true` in the database
   - Log in with admin privileges

2. **Approve Waiting Users:**
   - Go to Admin panel
   - Review and approve pending accounts

3. **Configure Session Duration:**
   - Set JWT expiry in backend settings
   - Enable auto-refresh tokens

4. **Test the System:**
   - Create a test account
   - Approve it
   - Test password reset
   - Verify session persistence

---

## 📝 Notes

- The system requires authentication for ALL features
- Storage files use 1-hour signed URLs for security
- Edge functions require JWT tokens
- All form inputs are validated on both client and server
- Sessions automatically refresh before expiration
