# FinPulse Authentication Setup Guide

## Overview
The app now supports two authentication methods:
1. **Email + Password with OTP verification** - Create account → Send OTP → Verify → Login
2. **Google OAuth Sign-In** - Sign in with Google account (automatic account creation)

---

## Part 1: Email + Password Authentication (Gmail OTP)

### Step 1: Create a Gmail App Password

1. Go to [Google Account Settings](https://myaccount.google.com)
2. Click **Security** in the left menu
3. Scroll to **2-Step Verification** and enable it (if not already enabled)
4. Scroll down to **App passwords**
5. Select **Mail** and **Windows Computer** (or your device)
6. Google will generate a **16-character password** (looks like: `xxxx xxxx xxxx xxxx`)
7. **Copy this password** (you'll need it next)

### Step 2: Fill Backend Environment Variables

Edit `backend/.env`:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker
JWT_SECRET=your-strong-random-secret-key-here
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

**Example:**
```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker
JWT_SECRET=my-super-secret-key-12345
GMAIL_USER=john@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

### Step 3: Test Email OTP Flow

1. Open the FinPulse app in the browser
2. Click **Need an account? Register**
3. Enter:
   - Full name (optional)
   - Email address
   - Password (any password)
4. Click **Create account**
5. You should see **"OTP sent for verification"** message
6. Check your email for the OTP code (should arrive within 1 minute)
7. Enter the 6-digit OTP code and click **Verify OTP**
8. Once verified, you can **Sign in** with email + password

---

## Part 2: Google OAuth Sign-In

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (name: "FinPulse" or whatever you prefer)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add Authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - `http://127.0.0.1:3000`
7. Add Authorized redirect URIs:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
8. Click **Create**
9. Copy your **Client ID** (looks like: `xxxx.apps.googleusercontent.com`)

### Step 2: Fill Frontend Environment Variables

Create `.env` file in `frontend/` folder:

```
REACT_APP_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
REACT_APP_API_BASE=http://localhost:5000
```

**Example:**
```
REACT_APP_GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
REACT_APP_API_BASE=http://localhost:5000
```

### Step 3: Fill Backend Environment Variables

Edit `backend/.env`:

```dotenv
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

**Full .env example:**
```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker
JWT_SECRET=my-super-secret-key-12345
GMAIL_USER=john@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
```

### Step 4: Test Google OAuth Flow

1. Restart the backend: `node server.js`
2. Restart the frontend: `npm start`
3. You should see a **"Continue with Google"** button on the login page
4. Click it and sign in with your Google account
5. You'll be automatically logged in and account created

---

## Authentication Flow Diagram

### Email + Password Flow:
```
Register (name, email, password)
    ↓
Backend creates unverified user + sends OTP email
    ↓
User enters OTP code
    ↓
Backend marks user as verified
    ↓
User can now login with email + password
```

### Google OAuth Flow:
```
Click "Continue with Google"
    ↓
User signs in with Google
    ↓
Backend receives Google token + verifies it
    ↓
Backend auto-creates account if new user
    ↓
User is immediately logged in
```

---

## API Endpoints

### Email + Password
- **POST /api/auth/register** - Create account + send OTP
  - Body: `{ name, email, password }`
  - Response: `{ message: "OTP sent for verification" }`
  
- **POST /api/auth/verify-otp** - Verify OTP + mark account verified
  - Body: `{ email, code }`
  - Response: `{ token, user }`

- **POST /api/auth/login** - Login with verified account
  - Body: `{ email, password }`
  - Response: `{ token, user }`

### Google OAuth
- **POST /api/auth/google** - Login/register with Google
  - Body: `{ idToken }`
  - Response: `{ token, user }`

---

## Troubleshooting

### Email OTP Not Arriving?
- Check **Spam/Promotions** folder
- Verify GMAIL_USER and GMAIL_APP_PASSWORD in `.env` are correct
- Make sure Gmail **2-Step Verification** is enabled
- Try **Resend OTP** button

### Google Sign-In Button Not Showing?
- Check if REACT_APP_GOOGLE_CLIENT_ID is set in `frontend/.env`
- Check browser console for errors
- Refresh the page

### "Backend not reachable" Error?
- Check if backend is running: `node server.js` in `backend/` folder
- Check if frontend API_BASE is correct (should be `http://localhost:5000`)
- Check MongoDB is running

### "Invalid Google token" Error?
- Verify Google Client ID is correct in both frontend and backend `.env`
- Check that you're using the correct OAuth credentials from Google Cloud Console

---

## Security Notes

- **JWT_SECRET** should be a strong random string (use online generator: https://random.org)
- **Gmail App Password** is different from your Gmail password
- **Google Client ID** can be public, but **Client Secret** should never be in frontend
- Store tokens only in localStorage (done automatically)
- Tokens expire in 7 days

---

## Running the App

### Terminal 1: MongoDB
```bash
mongod
```

### Terminal 2: Backend
```bash
cd backend
npm install
node server.js
```

### Terminal 3: Frontend
```bash
cd frontend
npm install
npm start
```

Then open http://localhost:3000 in your browser.

---

## Summary

**Quick Checklist:**
- [ ] Gmail 2-Step Verification enabled
- [ ] Gmail App Password created and added to `backend/.env`
- [ ] JWT_SECRET set in `backend/.env`
- [ ] Google OAuth credentials created (optional)
- [ ] Google Client ID added to `frontend/.env` and `backend/.env` (optional)
- [ ] Backend running on port 5000
- [ ] Frontend running on port 3000
- [ ] MongoDB running locally

Both auth methods are now fully functional!
