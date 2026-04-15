# FinPulse Auth Implementation - Step by Step

## What Changed?

User authentication is now split into **2 ways to login**:

### Method 1: Email + Password (with OTP verification)
```
NEW USER SIGNUP:
1. Click "Need an account? Register"
2. Enter: Name, Email, Password
3. Click "Create account"
4. ✉️ OTP sent to your email
5. Enter 6-digit OTP code
6. Click "Verify OTP"
7. ✅ Account verified! Now you can login

EXISTING USER LOGIN:
1. Enter: Email, Password
2. Click "Sign in"
3. ✅ Done!
```

### Method 2: Google Account (One-click signup & login)
```
GOOGLE SIGNUP/LOGIN:
1. Click "Continue with Google" button
2. Select your Google account
3. ✅ Automatically logged in!
   (Account created automatically if first time)
```

---

## What Happens Behind the Scenes?

### Email + Password Registration:
```
Frontend sends:
{
  name: "John Doe",
  email: "john@gmail.com",
  password: "mypassword123"
}
        ↓
Backend:
- Creates unverified user account
- Generates 6-digit OTP code
- Sends OTP via Gmail
- Returns: "OTP sent for verification"
```

### OTP Verification:
```
Frontend sends:
{
  email: "john@gmail.com",
  code: "123456"
}
        ↓
Backend:
- Checks OTP is valid and not expired
- Marks user as verified ✅
- Generates JWT token
- Returns: { token, user }
```

### Password Login:
```
Frontend sends:
{
  email: "john@gmail.com",
  password: "mypassword123"
}
        ↓
Backend:
- Checks user exists and is verified ✅
- Checks password is correct
- Generates JWT token
- Returns: { token, user }
```

### Google OAuth:
```
Frontend sends: { idToken: "..." }
        ↓
Backend:
- Verifies Google token is valid
- Extracts email & profile from token
- Finds or creates user automatically
- Marks as verified ✅ (Google users always verified)
- Generates JWT token
- Returns: { token, user }
```

---

## New Database Fields

User model now has:

```javascript
{
  name: String,
  email: String (unique),
  passwordHash: String,
  avatarUrl: String,
  isVerified: Boolean  // ← NEW! Only verified users can login with password
}
```

---

## New Backend Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/register` | POST | Create account + send OTP |
| `/api/auth/verify-otp` | POST | Verify OTP + mark account verified |
| `/api/auth/login` | POST | Login with email + password |
| `/api/auth/request-otp` | POST | Resend OTP if needed |
| `/api/auth/google` | POST | Login with Google token (NEW) |

---

## Environment Variables Needed

### Backend (.env)
```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker
JWT_SECRET=super-secret-random-key
GMAIL_USER=your@gmail.com              # Your Gmail address
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx # 16-char app password from Google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com  # Optional, for Google OAuth
```

### Frontend (.env)
```dotenv
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com  # Optional, for Google OAuth
REACT_APP_API_BASE=http://localhost:5000
```

---

## File Changes Summary

### Backend
- ✅ `models/User.js` - Added `isVerified` field
- ✅ `server.js` - Updated auth endpoints, added Google OAuth
- ✅ `.env.example` - Added new variables
- ✅ `.env` - Empty placeholders for new variables
- ✅ `package.json` - Added `google-auth-library`

### Frontend
- ✅ `src/App.js` - Updated auth flow, added Google sign-in handler
- ✅ `public/index.html` - Added Google Sign-In script
- ✅ `.env` - New file for Google Client ID
- ✅ `.env.example` - Template for env variables

---

## Quick Test Checklist

- [ ] **Gmail OTP enabled**
  - [ ] Gmail 2-Step Verification turned on
  - [ ] Gmail App Password created
  - [ ] `GMAIL_USER` and `GMAIL_APP_PASSWORD` filled in `backend/.env`

- [ ] **Signup with Email + OTP works**
  - [ ] Can register with email/password
  - [ ] Receives OTP email
  - [ ] Can verify with OTP code
  - [ ] Can login after verification

- [ ] **Google OAuth setup (optional)**
  - [ ] Google Cloud OAuth credentials created
  - [ ] `GOOGLE_CLIENT_ID` filled in both frontend and backend `.env`
  - [ ] Google Sign-In button appears and works

---

## Admin Notes

- **JWT Token**: Valid for 7 days
- **OTP Code**: Valid for 10 minutes
- **OTP Length**: 6 digits
- **Password Hash**: bcryptjs (10 rounds)
- **Email Sending**: Gmail SMTP via nodemailer
- **Google OAuth**: Uses google-auth-library for token verification

---

## Common Questions

**Q: Can users change their email?**
A: Not yet. Future feature can be added.

**Q: What if user forgets password?**
A: Currently no reset. Add "Forgot Password" flow using OTP in the future.

**Q: Can user login with both email & Google?**
A: Yes! If Google email matches registered email, same account is used.

**Q: Is data encrypted?**
A: Passwords are hashed with bcryptjs. Sensitive data should use HTTPS in production.

**Q: What about 2FA?**
A: OTP is a form of 2FA for signup verification. Can be extended for login too.

---

## Next Steps

1. **Fill in Gmail credentials** from your Google account
2. **Test email + OTP flow** 
3. **Optional: Setup Google OAuth** for one-click login
4. Start using the app!

---

## Support

See `AUTH_SETUP_GUIDE.md` for detailed setup instructions.
