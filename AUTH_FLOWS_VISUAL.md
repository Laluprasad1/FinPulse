# Authentication Flows - Visual Guide

## The Two Ways to Use FinPulse

```
┌─────────────────────────────────────────────────────────────┐
│                    FINPULSE LOGIN SCREEN                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│   Have an account? Sign in      Need an account? Register   │
│   ─────────────────────────      ─────────────────────────   │
│                                                               │
│   Email:     ☐ email@gmail.com    Full Name: ☐ John Doe     │
│   Password:  ☐ ●●●●●●●●           Email:     ☐ john@gm.com  │
│                                    Password:  ☐ ●●●●●●●●     │
│   [ Sign in ]                      [ Create Account ]        │
│                                                               │
│   ──────────────────────────────────────────────────────────  │
│   [ Continue with Google ] 🔵                                │
│   ──────────────────────────────────────────────────────────  │
│                                                               │
│   Use OTP ✉️                                                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Email + Password Registration

```
START HERE: Click "Need an account? Register"
│
├─> REGISTER PAGE (Step 1/2)
│   ┌─────────────────────────────────────┐
│   │ Full Name: _______________          │
│   │ Email:     _______________          │
│   │ Password:  _______________  [Show]  │
│   │                                     │
│   │          [ Create account ]         │
│   └─────────────────────────────────────┘
│
└─> BACKEND CREATES UNVERIFIED USER
    │
    └─> SENDS OTP EMAIL
        │
        User gets email:
        "Your OTP code is: 123456"
        "It expires in 10 minutes"
        │
        └─> OTP VERIFICATION PAGE (Step 2/2)
            ┌─────────────────────────────────────┐
            │ OTP Code: [1][2][3][4][5][6]        │
            │                                     │
            │        [ Verify OTP ]               │
            │ [ Resend OTP ] [ Back to login ]    │
            └─────────────────────────────────────┘
            │
            └─> BACKEND VERIFIES OTP
                │
                └─> USER IS NOW VERIFIED ✅
                    │
                    └─> "Account verified! You can now login"
                        │
                        └─> BACK TO LOGIN PAGE
                            ┌─────────────────────────────────────┐
                            │ Email:     john@gmail.com           │
                            │ Password:  ●●●●●●●●                │
                            │                                     │
                            │        [ Sign in ]                  │
                            └─────────────────────────────────────┘
                            │
                            └─> ✅ LOGGED IN! → DASHBOARD
```

---

## Flow 2: Email + Password Login

```
START HERE: Click "Welcome back" (default)
│
├─> LOGIN PAGE
│   ┌─────────────────────────────────────┐
│   │ Email:     john@gmail.com           │
│   │ Password:  ●●●●●●●●        [Show]  │
│   │                                     │
│   │        [ Sign in ]                  │
│   │                                     │
│   │  Need an account? [ Register ]      │
│   │  [ Use OTP ] [ Continue w/ Google]  │
│   └─────────────────────────────────────┘
│
└─> BACKEND CHECKS:
    ✓ User exists
    ✓ Account is verified
    ✓ Password is correct
    │
    └─> ✅ LOGGED IN! → DASHBOARD
        └─> JWT Token stored in localStorage
```

---

## Flow 3: OTP-Only Login (Fast)

```
START HERE: Click "Use OTP"
│
├─> OTP LOGIN PAGE
│   ┌─────────────────────────────────────┐
│   │ Email: john@gmail.com               │
│   │                                     │
│   │ [ Send OTP ]                        │
│   │                                     │
│   │ (After sending)                     │
│   │                                     │
│   │ OTP Code: [1][2][3][4][5][6]       │
│   │                                     │
│   │ [ Verify OTP ] [ Resend OTP ]       │
│   │ [ Back to password login ]          │
│   └─────────────────────────────────────┘
│
└─> BACKEND:
    1. Checks user exists
    2. Generates new OTP
    3. Sends OTP email
    │
    └─> USER ENTERS CODE FROM EMAIL
        │
        └─> BACKEND VERIFIES CODE
            │
            └─> ✅ LOGGED IN! → DASHBOARD
```

---

## Flow 4: Google Sign-In

```
START HERE: Click [ Continue with Google ] 🔵
│
├─> GOOGLE SIGN-IN POPUP
│   ┌─────────────────────────────────────┐
│   │  Google                             │
│   │  ─────────────────────────────────  │
│   │  Sign in with your Google account   │
│   │                                     │
│   │  [ gmail@gmail.com ]                │
│   │  [ other@gmail.com ]                │
│   │                                     │
│   │  [ Use another account ]            │
│   └─────────────────────────────────────┘
│   (User selects account)
│
└─> GOOGLE RETURNS ID TOKEN TO FRONTEND
    │
    └─> FRONTEND SENDS TOKEN TO BACKEND
        │
        └─> BACKEND VERIFIES WITH GOOGLE:
            ✓ Token is valid
            ✓ Not expired
            ✓ From correct Google app
            │
            └─> BACKEND CHECKS USER:
                │
                ├─ If new user:
                │  - Create account (name, email, avatar)
                │  - Mark as VERIFIED ✅
                │
                └─ If existing user:
                   - Update name/avatar if missing
                   - Use existing account
                   │
                   └─> ✅ LOGGED IN! → DASHBOARD
                       └─> JWT Token sent to frontend
```

---

## Database State - What's Stored

### New User Registration Path:
```
INITIAL STATE (Before Verification):
┌──────────────────────────────────────┐
│ User {                               │
│   _id: "abc123",                     │
│   name: "John Doe",                  │
│   email: "john@gmail.com",           │
│   passwordHash: "hashed_password",   │
│   isVerified: false  ← Can't login!  │
│   avatarUrl: ""                      │
│ }                                    │
│                                      │
│ OtpCode {                            │
│   email: "john@gmail.com",           │
│   code: "123456",                    │
│   expiresAt: 2025-01-25 14:25:00     │
│ }                                    │
└──────────────────────────────────────┘

AFTER OTP VERIFICATION:
┌──────────────────────────────────────┐
│ User {                               │
│   _id: "abc123",                     │
│   name: "John Doe",                  │
│   email: "john@gmail.com",           │
│   passwordHash: "hashed_password",   │
│   isVerified: true  ← Can login! ✅  │
│   avatarUrl: ""                      │
│ }                                    │
│                                      │
│ OtpCode: {} (deleted)                │
└──────────────────────────────────────┘

LOGIN SEQUENCE:
1. Check user.email matches
2. Check user.isVerified == true
3. Compare password with passwordHash
4. Generate JWT token
5. Send token to frontend
```

### Google OAuth Path:
```
AFTER GOOGLE SIGN-IN:
┌──────────────────────────────────────┐
│ User {                               │
│   _id: "xyz789",                     │
│   name: "John Doe",                  │
│   email: "john@gmail.com",           │
│   passwordHash: "random_hash",       │
│   isVerified: true  ← Auto verified! │
│   avatarUrl: "https://...pic.jpg"   │
│ }                                    │
│                                      │
│ No OtpCode needed                    │
└──────────────────────────────────────┘
```

---

## API Endpoints - Request/Response

### 1. Register (Email + Password)
```
POST /api/auth/register
─────────────────────────
Request:
{
  "name": "John Doe",
  "email": "john@gmail.com",
  "password": "mypassword123"
}

Response (201):
{
  "message": "OTP sent for verification."
}

Next Step: User gets OTP in email, then verify-otp
```

### 2. Verify OTP
```
POST /api/auth/verify-otp
─────────────────────────
Request:
{
  "email": "john@gmail.com",
  "code": "123456"
}

Response (200):
{
  "token": "eyJhbGc...",
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@gmail.com",
    "avatarUrl": ""
  }
}

Next Step: Store token, show dashboard
```

### 3. Login (Email + Password)
```
POST /api/auth/login
────────────────────
Request:
{
  "email": "john@gmail.com",
  "password": "mypassword123"
}

Response (200):
{
  "token": "eyJhbGc...",
  "user": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@gmail.com",
    "avatarUrl": ""
  }
}

Next Step: Store token, show dashboard
```

### 4. Request OTP (for resend)
```
POST /api/auth/request-otp
──────────────────────────
Request:
{
  "email": "john@gmail.com"
}

Response (200):
{
  "message": "OTP sent."
}

Next Step: User gets new OTP in email
```

### 5. Google Sign-In
```
POST /api/auth/google
─────────────────────
Request:
{
  "idToken": "eyJhbGc..." (from Google)
}

Response (200):
{
  "token": "eyJhbGc...",
  "user": {
    "id": "xyz789",
    "name": "John Doe",
    "email": "john@gmail.com",
    "avatarUrl": "https://...pic.jpg"
  }
}

Next Step: Store token, show dashboard
```

---

## Error Scenarios

```
REGISTRATION ERRORS:
├─ Email/Password missing → 400 "Email and password are required"
│
└─ Email already registered → 409 sent to backend but handled

VERIFICATION ERRORS:
├─ Invalid/Expired OTP → 400 "Invalid or expired code"
├─ User not found → 404 "User not found for verification"
│
└─ Gmail not configured → 500 "Unable to send OTP"

LOGIN ERRORS:
├─ User not found → 401 "Invalid credentials"
├─ Account not verified → 403 "Account not verified"
├─ Wrong password → 401 "Invalid credentials"
│
└─ No backend → "Backend not reachable"

GOOGLE OAUTH ERRORS:
├─ Invalid token → 400 "Invalid Google token"
├─ Google OAuth not configured → 501 "Google OAuth not configured"
│
└─ Token verification failure → 500 "Unable to login with Google"
```

---

## Summary

```
┌──────────────┐
│ New User     │
├──────────────┤
│ Email        │ → Register → OTP Email → Verify → LOGIN ✅
│ Password     │
│              │
└──────────────┘

┌──────────────┐
│ Existing     │
│ User         │ → Email + Password → LOGIN ✅
│              │
└──────────────┘

┌──────────────┐
│ Any User     │ → Google Account → LOGIN ✅
│ (New/Old)    │ (Auto-creates or uses existing)
└──────────────┘
```

---

The system is **secure, user-friendly, and flexible!** 🎉
