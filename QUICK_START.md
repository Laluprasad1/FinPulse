# Quick Setup Card

## Step 1: Gmail Setup (5 minutes)

1. Go to https://myaccount.google.com/security
2. Enable **2-Step Verification** (if not enabled)
3. Go to **App passwords**
4. Select **Mail** + **Windows Computer**
5. Copy the 16-character password

**Edit `backend/.env`:**
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=copied-16-char-password
JWT_SECRET=anything-you-want
```

## Step 2: Start Servers

**Terminal 1 - Backend:**
```bash
cd personal-finance-tracker/backend
npm install
node server.js
```

**Terminal 2 - Frontend:**
```bash
cd personal-finance-tracker/frontend
npm install
npm start
```

**Terminal 3 - MongoDB (if not running):**
```bash
mongod
```

## Step 3: Test in Browser

Open http://localhost:3000

**Test #1: Register with Email + OTP**
- Click "Need an account? Register"
- Enter name, email, password
- Click "Create account"
- Check your email for OTP code
- Enter OTP code and verify
- Login with email + password

**Test #2: Google Sign-In (Optional)**
- Need Google OAuth Client ID from Google Cloud Console
- Add to `frontend/.env` and `backend/.env`
- Google button will appear and work

---

## File Locations

| What | Where | Example |
|------|-------|---------|
| Gmail settings | `backend/.env` | `GMAIL_USER=you@gmail.com` |
| JWT secret | `backend/.env` | `JWT_SECRET=abc123def456` |
| Google ID | `frontend/.env` | `REACT_APP_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com` |
| Google ID | `backend/.env` | `GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com` |

---

## What Just Changed?

### Before
- Direct account creation without verification
- Google OAuth placeholder button (disabled)

### After
- **Email + Password**: Create account → Send OTP → Verify → Login (with password)
- **Google OAuth**: Sign in with Google → Auto-create account (if new)
- Users can only login after verification

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| OTP not in email | Check spam folder, restart backend, verify credentials |
| Backend not starting | Check MongoDB running, check .env has GMAIL_USER/GMAIL_APP_PASSWORD |
| Google button not showing | Add REACT_APP_GOOGLE_CLIENT_ID to `frontend/.env` |
| "Backend not reachable" | Check backend running on port 5000 |

---

## Need Help?

Read the full guides:
- `AUTH_SETUP_GUIDE.md` - Detailed step-by-step instructions
- `AUTH_IMPLEMENTATION_SUMMARY.md` - Technical overview
