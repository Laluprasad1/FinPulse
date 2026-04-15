# FinPulse - Personal Finance Tracker

FinPulse is a full-stack web application for personal finance management with collaborative trip expense sharing.
[Live Site](https://finpulse-lalu.vercel.app)
It includes:
- Personal income and expense tracking
- Google login and OTP-based verification
- Budget planning and budget-overrun alerts
- Recurring transactions automation
- Analytics (monthly, weekly, category, forecast)
- CSV import and export
- Multi-member trip expense sharing with invite links and settlement

## Tech Stack

### Frontend
- React 18 (Create React App)
- Axios for API calls
- Recharts for analytics charts

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT authentication
- Google Sign-In token verification (google-auth-library)
- OTP email delivery with Nodemailer (Gmail App Password)

### Deployment
- Frontend: Vercel (static React build)
- Backend: Vercel serverless functions
- Database: MongoDB Atlas

## Project Structure

```text
finpulse/
  backend/
    api/index.js
    models/
    server.js
    vercel.json
  frontend/
    public/
    src/
    vercel.json
```

## Main Features

### Authentication
- Register with email and password
- OTP verification flow (email-based)
- Login with email/password
- Login with Google Sign-In
- JWT-based session management

### Finance Management
- Add, edit, and delete transactions
- Income/expense categorization
- Date range and tag filtering
- Dashboard totals and recent activity
- Budget creation and summary tracking
- Recurring transaction scheduling and apply workflow

### Analytics
- Monthly trend analytics
- Weekly trend analytics
- Category-wise distribution
- Forecast projection based on recent history
- Spending anomaly insights

### Trip Collaboration
- Create and manage trips
- Invite members by email
- Generate invite links
- Accept invite using tokenized invite flow
- Split expenses (none/equal/custom)
- Trip settlement balances across members
- Role-aware member management (owner/cohost/member)

## API Overview

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/request-otp
- POST /api/auth/verify-otp
- POST /api/auth/google
- GET /api/auth/me

### Profile
- GET /api/profile
- PUT /api/profile

### Transactions
- GET /api/transactions
- POST /api/transactions
- PUT /api/transactions/:id
- DELETE /api/transactions/:id
- POST /api/transactions/reset
- GET /api/transactions/export
- POST /api/transactions/import

### Trips
- GET /api/trips
- POST /api/trips
- GET /api/trips/:id
- PUT /api/trips/:id
- DELETE /api/trips/:id
- POST /api/trips/:id/invite
- POST /api/trips/:id/invite-link
- POST /api/trips/accept-invite
- GET /api/trips/:id/settle
- DELETE /api/trips/:tripId/members/:memberId
- PUT /api/trips/:tripId/members/:memberId/role

### Analytics and Insights
- GET /api/analytics/monthly
- GET /api/analytics/weekly
- GET /api/analytics/categories
- GET /api/analytics/forecast
- GET /api/insights/anomalies

### Budgets and Recurring
- GET /api/budgets
- POST /api/budgets
- GET /api/budgets/summary
- GET /api/recurring
- POST /api/recurring
- POST /api/recurring/apply

### Utility
- GET /health

## Environment Variables

### Backend (.env)

```env
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker
JWT_SECRET=replace-with-strong-secret
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your_16_char_google_app_password
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
APP_URL=http://localhost:3000
FRONTEND_PORT=3000
```

### Frontend (.env)

```env
REACT_APP_API_BASE=http://localhost:5000
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## Local Development Setup

## 1) Backend

```bash
cd finpulse/backend
npm install
npm start
```

Backend runs at http://localhost:5000.

## 2) Frontend

```bash
cd finpulse/frontend
npm install
npm start
```

Frontend runs at http://localhost:3000.

## 3) MongoDB
- Start local MongoDB server OR use MongoDB Atlas URI in backend .env.

## 4) Google OAuth Setup
- Create OAuth 2.0 Client ID in Google Cloud Console
- Add Authorized JavaScript Origins:
  - http://localhost:3000
  - your frontend production URL
- Use the same Client ID in both backend and frontend env vars

## Vercel Deployment

## Backend Project (Vercel)
- Root directory: finpulse/backend
- Required env vars: MONGO_URI, JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD, GOOGLE_CLIENT_ID, APP_URL, FRONTEND_URL (or APP_URL)
- Keep MongoDB Atlas network access open to Vercel (for example 0.0.0.0/0 while testing)

## Frontend Project (Vercel)
- Root directory: finpulse/frontend
- Required env vars: REACT_APP_API_BASE, REACT_APP_GOOGLE_CLIENT_ID
- REACT_APP_API_BASE must point to backend Vercel URL

## Important Deployment Notes
- Frontend environment variables are build-time values, so redeploy frontend after changing them.
- If Google login fails with audience/client mismatch, verify:
  - backend GOOGLE_CLIENT_ID
  - frontend REACT_APP_GOOGLE_CLIENT_ID
  - Google OAuth authorized origins
- If OTP fails, verify Gmail App Password and backend env values.
- If database timeout appears, verify MONGO_URI and Atlas network access.

## Security Notes
- Never commit real secrets to git.
- Use separate credentials for development and production.
- Rotate credentials if accidentally exposed.

## Current Limitations
- No automated test coverage is configured in backend.
- Backend uses a single server.js file with many routes (can be modularized later).

## Future Improvements
- Add role-based access middleware per route group
- Add validation layer (for example Joi/Zod)
- Add centralized logging and monitoring
- Split backend into controllers/services/routes
- Add unit and integration tests
