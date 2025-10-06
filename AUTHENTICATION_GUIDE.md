# Authentication Guide

## Admin Accounts

The following accounts are automatically configured as administrators:
- **ingo@peachhausgroup.com**
- **anja@peachhausgroup.com**

**Password for both accounts:** `Z^kHcvYv2Zc%dUJ7`

These accounts are automatically approved and granted admin privileges when created.

## How to Log In

### For New Users
1. Navigate to the login page
2. Click "Don't have an account? Sign up"
3. Enter your email and password (minimum 6 characters)
4. Click "Sign Up"
5. **Wait for admin approval** - You'll see a message that your account is pending
6. Once an admin approves your account, you can log in

### For Admin Users (ingo@peachhausgroup.com or anja@peachhausgroup.com)
1. Navigate to the login page
2. If this is your first time:
   - Click "Don't have an account? Sign up"
   - Enter your email and the password above
   - You'll be automatically approved and can log in immediately
3. For subsequent logins:
   - Enter your email and password
   - Click "Sign In"

### For Approved Users
1. Navigate to the login page
2. Enter your email and password
3. Click "Sign In"
4. You'll be logged in and redirected to the dashboard

### Forgot Password?
1. Click "Forgot password?" on the login page
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for the password reset link
5. Click the link and you'll be logged in automatically
6. **Note:** If your account is not approved, you'll see a pending approval message after resetting your password

## Admin Functions

### Making Someone an Admin
Only existing admins can grant admin privileges to other users.

1. Log in as an admin (ingo@peachhausgroup.com or anja@peachhausgroup.com)
2. Click the "Admin" link in the navigation bar
3. Find the user in the "Approved Users" section
4. Click "Make Admin" button next to their name
5. The user will immediately receive admin privileges

### Admin Panel Features
The admin panel allows you to:
- **View Pending Approvals:** See all users waiting for approval
- **Approve Users:** Click "Approve" to grant access to pending users
- **Reject Users:** Click "Reject" to deny access
- **Manage Admin Roles:** Grant or revoke admin privileges for approved users
- **Revoke Access:** Remove access from approved users (changes status to rejected)
- **Re-approve Rejected Users:** Approve previously rejected users

## Session Duration

Users stay logged in for up to **1 year** with automatic token refresh. This means:
- You won't need to log in again for a year (unless you log out manually)
- Your session will automatically refresh in the background
- If you close and reopen your browser, you'll still be logged in

### Logging Out
To manually log out:
1. Click the "Logout" button in the top navigation bar
2. You'll be redirected to the login page

## Security Features

### Account Approval System
- All new signups (except admin emails) require admin approval
- Users with pending accounts cannot access the application
- Rejected users cannot log in
- Only approved users can access the system

### Password Security
- Passwords must be at least 6 characters
- Passwords are securely hashed and cannot be retrieved
- Use the "Forgot password?" feature to reset if needed

### Role-Based Access Control
- Admin roles are stored in a separate secure table
- Only admins can:
  - Approve/reject user accounts
  - Grant/revoke admin privileges
  - View the admin panel
- Regular users can only access their own data

## Email Configuration

### Auto-Confirm Email
Email confirmation is enabled for faster testing and development. Users can sign up and log in immediately without confirming their email (after admin approval).

### Password Reset Emails
When a user requests a password reset:
1. An email is sent to their registered email address
2. The email contains a secure link that expires
3. Clicking the link automatically logs them in
4. If their account is not approved, they'll see the pending approval message

## Troubleshooting

### "Account Pending Approval" Message
- Your account is waiting for an admin to approve it
- Contact an administrator (ingo@peachhausgroup.com or anja@peachhausgroup.com)
- Once approved, you can log in normally

### "Account Has Been Rejected"
- Your access has been denied by an administrator
- Contact an administrator if you believe this is an error

### Can't See Admin Panel
- You must be logged in as an admin user
- Check with ingo@peachhausgroup.com or anja@peachhausgroup.com to get admin privileges
- Only users with admin role can access the Admin panel

### Password Reset Not Working
- Make sure you're using the correct email address
- Check your spam folder for the reset email
- The reset link expires after some time - request a new one if needed
- If your account is not approved, you'll see a pending message after reset

## First-Time Setup

If you're setting up the system for the first time:

1. **Sign up both admin accounts:**
   - Go to the signup page
   - Create account for ingo@peachhausgroup.com with password `Z^kHcvYv2Zc%dUJ7`
   - Create account for anja@peachhausgroup.com with password `Z^kHcvYv2Zc%dUJ7`
   - Both will be automatically approved and granted admin privileges

2. **Log in and test:**
   - Log in with either admin account
   - You should see the "Admin" link in the navigation
   - Click it to access the admin panel

3. **Approve new users:**
   - As users sign up, they'll appear in the "Pending Approvals" section
   - Review and approve/reject as needed
