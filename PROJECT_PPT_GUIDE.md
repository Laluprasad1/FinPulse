# FinPulse PPT Guide

This file helps you prepare and present a project PPT quickly.

## 1. One-Line Pitch

FinPulse is a full-stack personal finance tracker with analytics, budgets, recurring transactions, and collaborative trip expense settlement.

## 2. Problem Statement

Many users track expenses in disconnected tools and struggle to:
- Understand monthly/weekly spending trends
- Plan budgets and detect overspending early
- Manage recurring income/expenses reliably
- Split and settle group trip expenses transparently

## 3. Proposed Solution

FinPulse provides a single application where users can:
- Track personal finance transactions
- View visual analytics and forecasting
- Set budgets and receive overspend alerts
- Manage recurring transactions automatically
- Collaborate on trip costs with invite-based member onboarding

## 4. Objectives

- Build an intuitive personal finance dashboard
- Support secure authentication (email/password, OTP, Google)
- Provide actionable financial insights
- Enable collaborative trip expense management
- Deploy a production-ready cloud architecture

## 5. System Architecture (Slide Content)

- Frontend: React app (hosted on Vercel)
- Backend: Express API in Vercel serverless runtime
- Database: MongoDB Atlas
- Auth: JWT + Google ID token verification + OTP via Gmail

Data flow summary:
1. User authenticates from frontend
2. Frontend sends API requests to backend
3. Backend validates JWT and business rules
4. Backend reads/writes MongoDB Atlas
5. Frontend renders dashboards and charts

## 6. Key Modules

- Authentication Module
- Transaction Management Module
- Analytics Module
- Budget Module
- Recurring Transaction Module
- Trip Collaboration Module

## 7. Unique Selling Points

- Hybrid authentication (traditional + social + OTP)
- Trip invite links and member role management
- Settlement support including invited/email-only members
- Forecast and anomaly insights beyond basic CRUD tracking

## 8. Database Design Highlights

Core collections:
- users
- transactions
- trips
- budgets
- recurringtransactions
- otpcodes (TTL expiry for OTP)

Important relationships:
- User -> Transactions (1 to many)
- User -> Budgets (1 to many)
- User -> Recurring transactions (1 to many)
- Trip -> Members (embedded subdocuments)
- Trip -> Transactions (via transaction.tripId)

## 9. API Highlights for Demo Slide

- /api/auth/register, /api/auth/login, /api/auth/google
- /api/transactions (CRUD + import/export)
- /api/analytics/monthly, /weekly, /categories, /forecast
- /api/trips with invite and settlement routes

## 10. Security and Reliability

- JWT-based protected routes
- Password hashing with bcrypt
- Google token validation on backend
- OTP expiration via TTL index
- DB connection guard for serverless cold starts

## 11. Deployment and DevOps

- Two Vercel projects: frontend and backend
- Environment-driven configuration
- Atlas cloud DB connectivity
- Production troubleshooting checklist for OAuth, OTP, and DB access

## 12. Demo Flow (Recommended Order)

1. Register a user
2. Verify OTP and login
3. Add income and expense transactions
4. Show dashboard and analytics
5. Create budget and recurring transaction
6. Create trip, invite member, add split transaction
7. Show settlement balances
8. Sign out and sign in with Google

## 13. Challenges Faced

- Vercel CI build failures due to React hook lint rules
- Google OAuth origin and client ID mismatch
- OTP failures from wrong Gmail app password setup
- MongoDB Atlas connectivity on serverless cold starts

## 14. Fixes Implemented

- Hook dependency fixes for stable frontend builds
- Unified Google client ID configuration across frontend/backend
- Correct Gmail app password-based OTP email setup
- Added database connection middleware guard in backend

## 15. Impact / Results

- Stable cloud deployment on Vercel
- Multi-user authentication flows operational
- End-to-end financial tracking and collaboration working
- Better user experience with visual analytics and grouped spending insights

## 16. Future Scope

- Mobile app (React Native)
- Multi-currency conversion support
- Smarter AI recommendations for savings
- Team/family shared finance workspaces
- Advanced reporting and downloadable statements

## 17. Suggested Slide Deck Structure (12-15 Slides)

1. Title and Team
2. Problem Statement
3. Objectives
4. Proposed Solution
5. Architecture Diagram
6. Tech Stack
7. Feature Modules
8. Database Design
9. API and Security
10. Deployment and DevOps
11. Demo Screenshots / Live Demo Flow
12. Challenges and Fixes
13. Results
14. Future Scope
15. Q&A

## 18. Viva / Q&A Preparation

Prepare concise answers for:
- Why JWT instead of session-based auth?
- Why MongoDB for this use case?
- How do you secure Google login?
- How do you handle recurring jobs in serverless?
- What happens if MongoDB is temporarily unreachable?
- How can the architecture scale for more users?

## 19. Closing Statement

FinPulse demonstrates a practical full-stack system that combines personal finance intelligence with collaborative expense management and real-world cloud deployment readiness.
