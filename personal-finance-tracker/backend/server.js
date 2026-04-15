require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const Transaction = require('./models/Transaction');
const Trip = require('./models/Trip');
const User = require('./models/User');
const Budget = require('./models/Budget');
const RecurringTransaction = require('./models/RecurringTransaction');
const OtpCode = require('./models/OtpCode');

const app = express();
const port = process.env.PORT || 5000;
const mongoUri =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/personal_finance_tracker';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const gmailUser = process.env.GMAIL_USER || '';
const gmailPass = process.env.GMAIL_APP_PASSWORD || '';
const googleClientIds = String(
  process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || ''
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const googleClient = googleClientIds.length ? new OAuth2Client() : null;
const configuredAppUrl = String(process.env.APP_URL || process.env.FRONTEND_URL || '').trim();
const frontendPort = Number.parseInt(process.env.FRONTEND_PORT || '3000', 10) || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: 'FinPulse API',
    status: 'ok',
    docs: '/health',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error.message);
  });

const toMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const buildDateRange = (from, to) => {
  if (!from && !to) {
    return null;
  }

  const range = {};
  if (from) {
    range.$gte = new Date(from);
  }
  if (to) {
    range.$lte = new Date(to);
  }
  return range;
};

const parseTripId = (value) => {
  if (!value) {
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }
  return value;
};

const parseTags = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const sendOtpEmail = async (email, code) => {
  return sendEmail(
    email,
    'Your FinPulse OTP Code',
    `Your OTP code is ${code}. It expires in 10 minutes.`
  );
};

const sendEmail = async (to, subject, text) => {
  if (!gmailUser || !gmailPass) {
    throw new Error('Email delivery not configured.');
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  });

  await transporter.sendMail({
    from: `FinPulse <${gmailUser}>`,
    to,
    subject,
    text,
  });
};

const hasTripAccess = (trip, userId, userEmail) => {
  if (!trip) {
    return false;
  }
  const userIdValue = String(userId || '');
  const emailValue = normalizeEmail(userEmail || '');
  if (trip.userId?.toString() === userIdValue || trip.ownerId?.toString() === userIdValue) {
    return true;
  }
  return (trip.members || []).some(
    (member) =>
      (member.userId && member.userId.toString() === userIdValue) ||
      (member.email && normalizeEmail(member.email) === emailValue)
  );
};

const getTripMemberRole = (trip, userId, userEmail) => {
  if (!trip) {
    return null;
  }
  if (trip.ownerId?.toString() === String(userId || '')) {
    return 'owner';
  }
  const normalizedEmail = normalizeEmail(userEmail || '');
  const member = (trip.members || []).find(
    (entry) =>
      (entry.userId && entry.userId.toString() === String(userId || '')) ||
      (entry.email && normalizeEmail(entry.email) === normalizedEmail)
  );
  return member?.role || null;
};

const canManageTripMembers = (trip, userId, userEmail) => {
  const role = getTripMemberRole(trip, userId, userEmail);
  return role === 'owner' || role === 'cohost';
};

const buildInviteToken = (tripId, ownerId, email = '') => {
  return jwt.sign(
    {
      typ: 'trip-invite',
      tripId: tripId.toString(),
      ownerId: ownerId.toString(),
      email: normalizeEmail(email),
    },
    jwtSecret,
    { expiresIn: '14d' }
  );
};

const sanitizeUrl = (value) => String(value || '').trim().replace(/\/$/, '');

const isLocalHost = (value) => /localhost|127\.0\.0\.1|::1/i.test(String(value || ''));

const getLanIp = () => {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  Object.values(interfaces).forEach((items) => {
    (items || []).forEach((item) => {
      if (!item || item.internal || item.family !== 'IPv4') {
        return;
      }
      if (item.address.startsWith('192.168.') || item.address.startsWith('10.') || item.address.startsWith('172.')) {
        candidates.push(item.address);
      }
    });
  });
  return candidates[0] || '';
};

const resolveAppUrl = (req) => {
  const configured = sanitizeUrl(configuredAppUrl);
  if (configured && configured.toLowerCase() !== 'auto') {
    return configured;
  }

  const origin = sanitizeUrl(req?.headers?.origin || '');
  if (origin && !isLocalHost(origin)) {
    return origin;
  }

  const forwardedHost = sanitizeUrl(req?.headers?.['x-forwarded-host'] || '');
  if (forwardedHost) {
    const proto = sanitizeUrl(req?.headers?.['x-forwarded-proto'] || 'https') || 'https';
    return sanitizeUrl(`${proto}://${forwardedHost}`);
  }

  const lanIp = getLanIp();
  if (lanIp) {
    return `http://${lanIp}:${frontendPort}`;
  }

  return `http://localhost:${frontendPort}`;
};

const buildInviteLink = (req, inviteToken) =>
  `${resolveAppUrl(req)}/invite/${encodeURIComponent(inviteToken)}`;

const enrichTripMembersWithNames = async (tripDocs) => {
  const trips = Array.isArray(tripDocs) ? tripDocs : [tripDocs];
  const userIds = new Set();

  trips.forEach((trip) => {
    (trip?.members || []).forEach((member) => {
      if (member?.userId) {
        userIds.add(member.userId.toString());
      }
    });
  });

  if (userIds.size === 0) {
    return trips.map((trip) => (trip?.toObject ? trip.toObject() : trip));
  }

  const users = await User.find(
    { _id: { $in: Array.from(userIds).map((id) => new mongoose.Types.ObjectId(id)) } },
    { name: 1 }
  );
  const userNameMap = new Map(users.map((user) => [user._id.toString(), user.name || '']));

  return trips.map((trip) => {
    const tripObj = trip?.toObject ? trip.toObject() : trip;
    tripObj.members = (tripObj.members || []).map((member) => {
      const userName = member.userId ? userNameMap.get(member.userId.toString()) : '';
      return {
        ...member,
        name: userName || member.name || '',
      };
    });
    return tripObj;
  });
};

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};

const getPeriodRange = (period) => {
  const now = new Date();
  if (period === 'weekly') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const emailValue = normalizeEmail(email);
    const passwordHash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ email: emailValue });
    if (user && user.isVerified) {
      return res.status(409).json({ message: 'Account already exists.' });
    }

    if (user) {
      user.passwordHash = passwordHash;
      user.name = name ? name.trim() : user.name;
      await user.save();
    } else {
      user = await User.create({
        name: name ? name.trim() : '',
        email: emailValue,
        passwordHash,
        isVerified: false,
      });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OtpCode.deleteMany({ email: emailValue });
    await OtpCode.create({ email: emailValue, code, expiresAt });
    await sendOtpEmail(emailValue, code);

    res.status(201).json({ message: 'OTP sent for verification.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to register.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const emailValue = normalizeEmail(email);
    const user = await User.findOne({ email: emailValue });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    if (!user.isVerified) {
      return res.status(403).json({ message: 'Account not verified.' });
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to login.' });
  }
});

app.post('/api/auth/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    const emailValue = normalizeEmail(email);
    const user = await User.findOne({ email: emailValue });
    if (!user) {
      return res.status(404).json({ message: 'Create an account first.' });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: 'Account already verified.' });
    }
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await OtpCode.deleteMany({ email: emailValue });
    await OtpCode.create({ email: emailValue, code, expiresAt });

    await sendOtpEmail(emailValue, code);

    return res.json({ message: 'OTP sent.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to send OTP.' });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required.' });
    }
    const emailValue = normalizeEmail(email);
    const otp = await OtpCode.findOne({ email: emailValue, code }).sort({ createdAt: -1 });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const user = await User.findOne({ email: emailValue });
    if (!user) {
      return res.status(404).json({ message: 'User not found for verification.' });
    }
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    await OtpCode.deleteMany({ email: emailValue });
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to verify OTP.' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(501).json({ message: 'Google OAuth not configured.' });
    }
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Google token is required.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientIds,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || payload.email_verified === false) {
      return res.status(400).json({ message: 'Invalid Google token.' });
    }

    const emailValue = normalizeEmail(payload.email);
    let user = await User.findOne({ email: emailValue });
    if (!user) {
      const passwordHash = await bcrypt.hash(`${generateOtp()}-${Date.now()}`, 10);
      user = await User.create({
        name: payload.name || payload.given_name || '',
        email: emailValue,
        passwordHash,
        avatarUrl: payload.picture || '',
        isVerified: true,
      });
    } else {
      let changed = false;
      if (!user.isVerified) {
        user.isVerified = true;
        changed = true;
      }
      if (!user.name && payload.name) {
        user.name = payload.name;
        changed = true;
      }
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    }

    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: '7d' }
    );
    return res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || '',
      },
    });
  } catch (error) {
    const rawMessage = String(error?.message || 'Google token verification failed.');
    const isTokenIssue =
      /Wrong recipient|audience|jwt|token used too late|invalid token|signature|malformed/i.test(
        rawMessage
      );
    console.error('Google auth error:', rawMessage);
    if (isTokenIssue) {
      return res.status(401).json({
        message:
          'Google login failed: client ID mismatch or invalid token. Check GOOGLE_CLIENT_ID / REACT_APP_GOOGLE_CLIENT_ID and authorized origins.',
      });
    }
    const isDatabaseIssue = /mongo|mongoose|e11000|duplicate key|validation failed/i.test(
      rawMessage
    );
    if (isDatabaseIssue) {
      return res.status(500).json({
        message: 'Google login failed due to database write issue. Please retry.',
      });
    }
    return res.status(500).json({
      message: `Unable to login with Google. Reason: ${rawMessage}`,
    });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || '',
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
});

app.get('/api/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to load profile.' });
  }
});

app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const { name, avatarUrl } = req.body;
    const updates = {};
    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (typeof avatarUrl === 'string') {
      updates.avatarUrl = avatarUrl;
    }
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || '',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update profile.' });
  }
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const totals = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalIncome = totals.find((entry) => entry._id === 'income')?.total || 0;
    const totalExpenses = totals.find((entry) => entry._id === 'expense')?.total || 0;

    res.json({ totalIncome, totalExpenses });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load dashboard totals.' });
  }
});

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const { from, to, type, category, tripId, tag } = req.query;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const query = { userId: req.user.id };

    const dateRange = buildDateRange(from, to);
    if (dateRange) {
      query.date = dateRange;
    }
    if (type) {
      query.type = type;
    }
    if (category) {
      query.category = category;
    }
    if (tag) {
      query.tags = tag;
    }
    if (tripId) {
      const parsedTripId = parseTripId(tripId);
      if (!parsedTripId) {
        return res.status(400).json({ message: 'Invalid trip id.' });
      }
      const trip = await Trip.findById(parsedTripId);
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }
      if (!hasTripAccess(trip, req.user.id, req.user.email)) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      delete query.userId;
      query.tripId = parsedTripId;
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .limit(limit);

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load transactions.' });
  }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  try {
    const {
      type,
      amount,
      category,
      date,
      note,
      tripId,
      tags,
      splitType,
      splitMembers,
      paidBy,
    } = req.body;
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'Type must be income or expense.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero.' });
    }
    if (!category || !date) {
      return res.status(400).json({ message: 'Category and date are required.' });
    }

    const parsedTripId = parseTripId(tripId);
    if (tripId && !parsedTripId) {
      return res.status(400).json({ message: 'Invalid trip id.' });
    }

    let payerId = req.user.id;
    let resolvedSplitType = splitType || 'none';
    let resolvedSplitMembers = [];
    if (parsedTripId) {
      const trip = await Trip.findById(parsedTripId);
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }
      if (!hasTripAccess(trip, req.user.id, req.user.email)) {
        return res.status(403).json({ message: 'Access denied.' });
      }
      const tripMembers = trip.members.filter((member) => member.status !== 'removed');
      const allowedPayerIds = new Set(
        tripMembers
          .flatMap((member) => [member.userId?.toString(), normalizeEmail(member.email)])
          .filter(Boolean)
          .concat([req.user.id, normalizeEmail(req.user.email)])
      );
      if (paidBy && allowedPayerIds.has(String(paidBy)) ) {
        payerId = String(paidBy);
      }
      if (resolvedSplitType === 'equal' && tripMembers.length > 0) {
        const selectedMembers =
          Array.isArray(splitMembers) && splitMembers.length > 0
            ? splitMembers
            : tripMembers.map((member) => ({
                userId: member.userId || null,
                email: member.email,
              }));
        const normalizedMembers = selectedMembers.filter((member) => member.userId || member.email);
        const share = normalizedMembers.length > 0 ? Number(amount) / normalizedMembers.length : 0;
        resolvedSplitMembers = normalizedMembers.map((member) => ({
          userId: member.userId || null,
          email: normalizeEmail(member.email || ''),
          name:
            tripMembers.find(
              (active) =>
                String(active.userId || '') === String(member.userId || '') ||
                normalizeEmail(active.email || '') === normalizeEmail(member.email || '')
            )?.name || '',
          amount: share,
        }));
      }
      if (resolvedSplitType === 'custom') {
        if (!Array.isArray(splitMembers) || splitMembers.length === 0) {
          return res.status(400).json({ message: 'Custom splits are required.' });
        }
        resolvedSplitMembers = splitMembers.map((member) => ({
          userId: member.userId || null,
          email: normalizeEmail(member.email || ''),
          name:
            activeMembers.find(
              (active) =>
                String(active.userId || '') === String(member.userId || '') ||
                normalizeEmail(active.email || '') === normalizeEmail(member.email || '')
            )?.name || '',
          amount: Number(member.amount),
        }));
      }
    }

    const transaction = await Transaction.create({
      type,
      amount: Number(amount),
      category: category.trim(),
      date: new Date(date),
      note: note ? note.trim() : '',
      tags: parseTags(tags),
      paidBy: payerId,
      splitType: resolvedSplitType,
      splitMembers: resolvedSplitMembers,
      tripId: parsedTripId,
      userId: req.user.id,
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save transaction.' });
  }
});

app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, date, note, tripId, tags, splitType, splitMembers } = req.body;

    const parsedTripId = parseTripId(tripId);
    if (tripId && !parsedTripId) {
      return res.status(400).json({ message: 'Invalid trip id.' });
    }

    let resolvedSplitMembers = [];
    if (splitType === 'custom' && Array.isArray(splitMembers)) {
      resolvedSplitMembers = splitMembers.map((member) => ({
        userId: member.userId || null,
        email: normalizeEmail(member.email || ''),
        amount: Number(member.amount),
      }));
    }

    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      {
        type,
        amount: Number(amount),
        category,
        date,
        note: note || '',
        tags: parseTags(tags),
        tripId: parsedTripId,
        paidBy: req.body.paidBy || req.user.id,
        splitType: splitType || 'none',
        splitMembers: resolvedSplitMembers,
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update transaction.' });
  }
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    let removed = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!removed) {
      const candidate = await Transaction.findById(req.params.id);
      if (candidate?.tripId) {
        const trip = await Trip.findById(candidate.tripId);
        if (trip && canManageTripMembers(trip, req.user.id, req.user.email)) {
          removed = await Transaction.findByIdAndDelete(req.params.id);
        }
      }
    }

    if (!removed) {
      return res.status(404).json({ message: 'Transaction not found.' });
    }
    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete transaction.' });
  }
});

app.post('/api/transactions/reset', requireAuth, async (req, res) => {
  try {
    await Transaction.deleteMany({ userId: req.user.id });
    return res.json({ message: 'All transactions reset to zero.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reset transactions.' });
  }
});

app.get('/api/trips', requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find({
      $or: [
        { userId: req.user.id },
        { ownerId: req.user.id },
        { 'members.userId': req.user.id },
        { 'members.email': normalizeEmail(req.user.email) },
      ],
    }).sort({ date: -1, createdAt: -1 });
    const tripIds = trips.map((trip) => trip._id).filter(Boolean);
    const totals = await Transaction.aggregate([
      {
        $match: {
          tripId: { $in: tripIds },
        },
      },
      {
        $group: {
          _id: '$tripId',
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
        },
      },
    ]);
    const totalsMap = new Map(
      totals.map((row) => [row._id.toString(), { income: row.income, expenses: row.expenses }])
    );
    const tripsWithNames = await enrichTripMembersWithNames(trips);
    res.json(
      tripsWithNames.map((trip) => {
        const summary = totalsMap.get(trip._id.toString()) || { income: 0, expenses: 0 };
        return {
          ...trip,
          totals: summary,
          spent: summary.expenses,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Unable to load trips.' });
  }
});

app.post('/api/trips', requireAuth, async (req, res) => {
  try {
    const { name, date, budget } = req.body;
    if (!name || !date) {
      return res.status(400).json({ message: 'Trip name and date are required.' });
    }

    const trip = await Trip.create({
      name: name.trim(),
      date: new Date(date),
      budget: Number.isFinite(Number(budget)) ? Number(budget) : null,
      ownerId: req.user.id,
      userId: req.user.id,
      members: [
        {
          userId: req.user.id,
          email: req.user.email,
          name: req.user.name || '',
          role: 'owner',
          status: 'active',
        },
      ],
    });

    res.status(201).json(trip);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save trip.' });
  }
});

app.get('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid trip id.' });
    }
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (!hasTripAccess(trip, req.user.id, req.user.email)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const totals = await Transaction.aggregate([
      { $match: { tripId: trip._id } },
      {
        $group: {
          _id: '$tripId',
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
        },
      },
    ]);
    const summary = totals[0] || { income: 0, expenses: 0 };
    const [tripWithNames] = await enrichTripMembersWithNames([trip]);
    res.json({
      ...tripWithNames,
      totals: { income: summary.income, expenses: summary.expenses },
      spent: summary.expenses,
    });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load trip.' });
  }
});

app.post('/api/trips/:id/invite', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, method } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (!canManageTripMembers(trip, req.user.id, req.user.email)) {
      return res.status(403).json({ message: 'Only owner/co-host can invite.' });
    }
    const emailValue = normalizeEmail(email);
    const user = await User.findOne({ email: emailValue });
    const existing = trip.members.find(
      (member) =>
        member.email === emailValue ||
        (member.userId && user && member.userId.toString() === user._id.toString())
    );
    if (existing && existing.status === 'active') {
      return res.status(409).json({ message: 'Member already active.' });
    }
    const inviteToken = buildInviteToken(id, trip.ownerId, emailValue);
    const inviteExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    if (existing) {
      existing.userId = user?._id || existing.userId || null;
      existing.email = emailValue;
      existing.name = user?.name || existing.name || '';
      existing.role = 'member';
      existing.status = 'invited';
      existing.inviteToken = inviteToken;
      existing.inviteExpiresAt = inviteExpiresAt;
    } else {
      trip.members.push({
        userId: user?._id || null,
        email: emailValue,
        name: user?.name || '',
        role: 'member',
        status: 'invited',
        inviteToken,
        inviteExpiresAt,
      });
    }
    await trip.save();
    const inviteLink = buildInviteLink(req, inviteToken);

    if (method === 'email' && gmailUser && gmailPass) {
      try {
        await sendEmail(
          emailValue,
          `Trip invite: ${trip.name} on FinPulse`,
          `You have been invited to join the trip "${trip.name}" on FinPulse.\n\nOpen this link: ${inviteLink}\n\nSign in or create an account, then accept the invite.`
        );
      } catch (emailError) {
        console.error('Email send error:', emailError.message);
      }
    }

    res.json({ trip, inviteLink });
  } catch (error) {
    res.status(500).json({ message: 'Unable to invite member.' });
  }
});

app.post('/api/trips/:id/invite-link', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (!canManageTripMembers(trip, req.user.id, req.user.email)) {
      return res.status(403).json({ message: 'Only owner/co-host can generate invite link.' });
    }
    const inviteToken = buildInviteToken(id, trip.ownerId);
    return res.json({ inviteLink: buildInviteLink(req, inviteToken) });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to generate invite link.' });
  }
});

app.post('/api/trips/accept-invite', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Invite token is required.' });
    }
    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || decoded.typ !== 'trip-invite' || !decoded.tripId) {
      return res.status(400).json({ message: 'Invalid invite token.' });
    }
    const trip = await Trip.findById(decoded.tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (trip.ownerId.toString() === req.user.id) {
      return res.status(400).json({ message: 'Owner is already part of this trip.' });
    }

    const normalizedUserEmail = normalizeEmail(req.user.email);
    const existingMember = trip.members.find(
      (member) =>
        (member.userId && member.userId.toString() === req.user.id) ||
        normalizeEmail(member.email) === normalizedUserEmail
    );

    if (existingMember && existingMember.status === 'active') {
      return res.json({ message: 'Already joined this trip.', tripId: trip._id.toString() });
    }

    if (existingMember) {
      existingMember.userId = req.user.id;
      existingMember.email = normalizedUserEmail;
      existingMember.name = req.user.name || existingMember.name || '';
      existingMember.status = 'active';
      existingMember.inviteToken = '';
      existingMember.inviteExpiresAt = null;
    } else {
      trip.members.push({
        userId: req.user.id,
        email: normalizedUserEmail,
        name: req.user.name || '',
        role: 'member',
        status: 'active',
        inviteToken: '',
        inviteExpiresAt: null,
      });
    }
    await trip.save();
    return res.json({ message: 'Trip invitation accepted.', tripId: trip._id.toString() });
  } catch (error) {
    return res.status(400).json({ message: 'Invalid or expired invite token.' });
  }
});

app.get('/api/trips/:id/settle', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (!hasTripAccess(trip, req.user.id, req.user.email)) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const transactions = await Transaction.find({ tripId: id });
    const members = trip.members.filter((member) => member.status !== 'removed');
    const balances = new Map();
    members.forEach((member) => {
      const key = member.userId ? member.userId.toString() : normalizeEmail(member.email);
      balances.set(key, { member, paid: 0, share: 0 });
    });

    transactions.forEach((tx) => {
      const payerId = tx.paidBy?.toString() || tx.userId?.toString();
      let payer = balances.get(payerId);
      if (!payer && tx.paidBy) {
        const normalized = normalizeEmail(tx.paidBy);
        payer = Array.from(balances.values()).find(
          (entry) => normalizeEmail(entry.member.email) === normalized
        );
      }
      if (payer) {
        payer.paid += Number(tx.amount);
      }

      if (tx.splitType === 'custom' && tx.splitMembers.length) {
        tx.splitMembers.forEach((split) => {
          const key = split.userId ? split.userId.toString() : normalizeEmail(split.email);
          let entry = balances.get(key);
          if (!entry && split.email) {
            const normalized = normalizeEmail(split.email);
            entry = Array.from(balances.values()).find(
              (e) => normalizeEmail(e.member.email) === normalized
            );
          }
          if (entry) {
            entry.share += Number(split.amount);
          }
        });
        return;
      }

      if (tx.splitType === 'equal' && tx.splitMembers.length) {
        tx.splitMembers.forEach((split) => {
          const key = split.userId ? split.userId.toString() : normalizeEmail(split.email);
          let entry = balances.get(key);
          if (!entry && split.email) {
            const normalized = normalizeEmail(split.email);
            entry = Array.from(balances.values()).find(
              (e) => normalizeEmail(e.member.email) === normalized
            );
          }
          if (entry) {
            entry.share += Number(split.amount);
          }
        });
        return;
      }

      if (tx.splitType === 'equal' && members.length > 0) {
        const share = Number(tx.amount) / members.length;
        members.forEach((member) => {
          const key = member.userId ? member.userId.toString() : normalizeEmail(member.email);
          const entry = balances.get(key);
          if (entry) {
            entry.share += share;
          }
        });
        return;
      }

      if (payer) {
        payer.share += Number(tx.amount);
      }
    });

    const result = Array.from(balances.values()).map((entry) => ({
      name: entry.member.name || entry.member.email || entry.member.userId?.toString(),
      paid: entry.paid,
      share: entry.share,
      balance: entry.paid - entry.share,
      member: entry.member,
    }));
    res.json({ tripId: id, balances: result });
  } catch (error) {
    res.status(500).json({ message: 'Unable to compute settlement.' });
  }
});

app.put('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid trip id.' });
    }
    const { name, date, budget } = req.body;
    const updates = {};
    if (typeof name === 'string' && name.trim()) {
      updates.name = name.trim();
    }
    if (date) {
      updates.date = new Date(date);
    }
    if (budget === '' || budget === null) {
      updates.budget = null;
    } else if (Number.isFinite(Number(budget))) {
      updates.budget = Number(budget);
    }

    const updated = await Trip.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      updates,
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Unable to update trip.' });
  }
});

app.delete('/api/trips/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid trip id.' });
    }
    const trip = await Trip.findById(id);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    const isCreator =
      trip.ownerId?.toString() === req.user.id || trip.userId?.toString() === req.user.id;
    if (!isCreator) {
      return res.status(403).json({ message: 'Only owner can delete trip.' });
    }
    await Transaction.deleteMany({ tripId: id });
    await Trip.findByIdAndDelete(id);
    res.json({ message: 'Trip deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to delete trip.' });
  }
});

app.delete('/api/trips/:tripId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const { tripId, memberId } = req.params;
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (!canManageTripMembers(trip, req.user.id, req.user.email)) {
      return res.status(403).json({ message: 'Only owner/co-host can remove members.' });
    }
    const member = trip.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }
    if (member.role === 'owner') {
      return res.status(400).json({ message: 'Owner cannot be removed.' });
    }
    const requesterRole = getTripMemberRole(trip, req.user.id, req.user.email);
    if (requesterRole === 'cohost' && member.role === 'cohost') {
      return res.status(403).json({ message: 'Co-host cannot remove another co-host.' });
    }
    trip.members.pull({ _id: memberId });
    await trip.save();
    return res.json({ message: 'Member removed.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to remove member.' });
  }
});

app.put('/api/trips/:tripId/members/:memberId/role', requireAuth, async (req, res) => {
  try {
    const { tripId, memberId } = req.params;
    const { role } = req.body;
    if (!['member', 'cohost'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role.' });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found.' });
    }
    if (trip.ownerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only owner can change member role.' });
    }

    const member = trip.members.id(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found.' });
    }
    if (member.role === 'owner') {
      return res.status(400).json({ message: 'Owner role cannot be changed.' });
    }

    member.role = role;
    await trip.save();
    return res.json({ message: 'Member role updated.', trip });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update member role.' });
  }
});

app.get('/api/analytics/monthly', requireAuth, async (req, res) => {
  try {
    const months = Number.parseInt(req.query.months, 10) || 6;
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);

    const rows = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: start },
          userId: new mongoose.Types.ObjectId(req.user.id),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$date' },
          },
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const rowMap = new Map(rows.map((row) => [row._id, row]));
    const series = [];
    const cursor = new Date(start);
    for (let i = 0; i < months; i += 1) {
      const key = toMonthKey(cursor);
      const match = rowMap.get(key);
      series.push({
        month: key,
        income: match?.income || 0,
        expenses: match?.expenses || 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    res.json(series);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load monthly analytics.' });
  }
});

app.get('/api/analytics/weekly', requireAuth, async (req, res) => {
  try {
    const weeks = Number.parseInt(req.query.weeks, 10) || 8;
    const start = new Date();
    start.setDate(start.getDate() - (weeks - 1) * 7);
    start.setHours(0, 0, 0, 0);

    const rows = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: start },
          userId: new mongoose.Types.ObjectId(req.user.id),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateTrunc: { date: '$date', unit: 'week' } },
            },
          },
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(
      rows.map((row) => ({
        week: row._id,
        income: row.income,
        expenses: row.expenses,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Unable to load weekly analytics.' });
  }
});

app.get('/api/analytics/categories', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateRange = buildDateRange(from, to);
    const match = {
      type: 'expense',
      userId: new mongoose.Types.ObjectId(req.user.id),
    };
    if (dateRange) {
      match.date = dateRange;
    }

    const rows = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json(rows.map((row) => ({ category: row._id, total: row.total })));
  } catch (error) {
    res.status(500).json({ message: 'Unable to load category analytics.' });
  }
});

app.get('/api/analytics/forecast', requireAuth, async (req, res) => {
  try {
    const historyMonths = Number.parseInt(req.query.historyMonths, 10) || 3;
    const forecastMonths = Number.parseInt(req.query.months, 10) || 3;

    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() - (historyMonths - 1));
    start.setHours(0, 0, 0, 0);

    const history = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: start },
          userId: new mongoose.Types.ObjectId(req.user.id),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$date' },
          },
          income: {
            $sum: {
              $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0],
            },
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0],
            },
          },
        },
      },
    ]);

    const netTotals = history.reduce(
      (acc, row) => acc + (row.income - row.expenses),
      0
    );
    const averageNet = historyMonths > 0 ? netTotals / historyMonths : 0;

    const totals = await Transaction.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalIncome = totals.find((entry) => entry._id === 'income')?.total || 0;
    const totalExpenses =
      totals.find((entry) => entry._id === 'expense')?.total || 0;
    const baseBalance = totalIncome - totalExpenses;

    const series = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = 1; i <= forecastMonths; i += 1) {
      cursor.setMonth(cursor.getMonth() + 1);
      series.push({
        month: toMonthKey(cursor),
        projectedBalance: baseBalance + averageNet * i,
      });
    }

    res.json({ baseBalance, averageNet, series });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load forecast.' });
  }
});

app.get('/api/insights/anomalies', requireAuth, async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 2000;
    const now = new Date();
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const categoryCurrent = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          type: 'expense',
          date: { $gte: currentStart },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const categoryPrev = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          type: 'expense',
          date: { $gte: prevStart, $lt: currentStart },
        },
      },
      {
        $group: {
          _id: {
            category: '$category',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const prevMap = new Map();
    categoryPrev.forEach((row) => {
      const key = row._id.category;
      const entry = prevMap.get(key) || [];
      entry.push(row.total);
      prevMap.set(key, entry);
    });

    const categorySpikes = categoryCurrent
      .map((row) => {
        const prevTotals = prevMap.get(row._id) || [];
        const avg = prevTotals.length
          ? prevTotals.reduce((sum, val) => sum + val, 0) / prevTotals.length
          : 0;
        return {
          category: row._id,
          current: row.total,
          previousAverage: avg,
          delta: row.total - avg,
        };
      })
      .filter((row) => row.previousAverage > 0 && row.current > row.previousAverage * 1.5);

    const largeTransactions = await Transaction.find({
      userId: req.user.id,
      amount: { $gte: threshold },
    })
      .sort({ date: -1 })
      .limit(10);

    res.json({ categorySpikes, largeTransactions });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load anomalies.' });
  }
});

app.get('/api/transactions/export', requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateRange = buildDateRange(from, to);
    const query = dateRange ? { date: dateRange, userId: req.user.id } : { userId: req.user.id };

    const transactions = await Transaction.find(query).sort({ date: -1 });
    const records = transactions.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      type: item.type,
      category: item.category,
      amount: item.amount,
      note: item.note || '',
      tripId: item.tripId ? item.tripId.toString() : '',
      tags: (item.tags || []).join('|'),
    }));

    const csv = stringify(records, {
      header: true,
      columns: ['date', 'type', 'category', 'amount', 'note', 'tripId', 'tags'],
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('transactions.csv');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ message: 'Unable to export transactions.' });
  }
});

app.post('/api/transactions/import', requireAuth, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) {
      return res.status(400).json({ message: 'CSV content is required.' });
    }

    const records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const mapped = records.map((row) => {
      const parsedTripId = parseTripId(row.tripId);
      return {
        type: row.type,
        amount: Number(row.amount),
        category: row.category,
        date: new Date(row.date),
        note: row.note || '',
        tripId: parsedTripId,
        tags: parseTags(row.tags ? row.tags.split('|') : []),
        userId: req.user.id,
      };
    });

    const invalid = mapped.find(
      (row) =>
        !['income', 'expense'].includes(row.type) ||
        !row.category ||
        !row.date ||
        Number.isNaN(row.amount)
    );

    if (invalid) {
      return res.status(400).json({ message: 'CSV contains invalid rows.' });
    }

    const inserted = await Transaction.insertMany(mapped);
    res.status(201).json({ count: inserted.length });
  } catch (error) {
    res.status(500).json({ message: 'Unable to import transactions.' });
  }
});

app.get('/api/budgets', requireAuth, async (req, res) => {
  try {
    const budgets = await Budget.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load budgets.' });
  }
});

app.post('/api/budgets', requireAuth, async (req, res) => {
  try {
    const { name, period, category, amount } = req.body;
    if (!name || !period || !amount) {
      return res.status(400).json({ message: 'Name, period, and amount are required.' });
    }
    const budget = await Budget.create({
      name: name.trim(),
      period,
      category: category?.trim() || 'All',
      amount: Number(amount),
      userId: req.user.id,
    });
    res.status(201).json(budget);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save budget.' });
  }
});

app.get('/api/budgets/summary', requireAuth, async (req, res) => {
  try {
    const period = req.query.period || 'monthly';
    const { start, end } = getPeriodRange(period);
    const budgets = await Budget.find({ userId: req.user.id, active: true });
    const expenses = await Transaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user.id),
          type: 'expense',
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
    ]);
    const expenseMap = new Map(expenses.map((row) => [row._id, row.total]));
    res.json(
      budgets.map((budget) => {
        const spent = budget.category === 'All' ?
          expenses.reduce((sum, row) => sum + row.total, 0) :
          expenseMap.get(budget.category) || 0;
        return {
          id: budget._id.toString(),
          name: budget.name,
          period: budget.period,
          category: budget.category,
          amount: budget.amount,
          spent,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Unable to load budget summary.' });
  }
});

app.get('/api/recurring', requireAuth, async (req, res) => {
  try {
    const recurring = await RecurringTransaction.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(recurring);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load recurring transactions.' });
  }
});

app.post('/api/recurring', requireAuth, async (req, res) => {
  try {
    const { type, amount, category, note, frequency, nextRun, tags } = req.body;
    if (!type || !amount || !category || !frequency || !nextRun) {
      return res.status(400).json({ message: 'Missing required fields.' });
    }
    const recurring = await RecurringTransaction.create({
      userId: req.user.id,
      type,
      amount: Number(amount),
      category: category.trim(),
      note: note ? note.trim() : '',
      tags: parseTags(tags),
      frequency,
      nextRun: new Date(nextRun),
    });
    res.status(201).json(recurring);
  } catch (error) {
    res.status(500).json({ message: 'Unable to save recurring transaction.' });
  }
});

app.post('/api/recurring/apply', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const recurring = await RecurringTransaction.find({ userId: req.user.id, active: true });
    let createdCount = 0;
    for (const item of recurring) {
      let nextRun = new Date(item.nextRun);
      let guard = 0;
      while (nextRun <= now && guard < 24) {
        await Transaction.create({
          userId: req.user.id,
          type: item.type,
          amount: item.amount,
          category: item.category,
          date: nextRun,
          note: item.note,
          tags: item.tags,
          tripId: null,
        });
        createdCount += 1;
        if (item.frequency === 'weekly') {
          nextRun.setDate(nextRun.getDate() + 7);
        } else {
          nextRun.setMonth(nextRun.getMonth() + 1);
        }
        guard += 1;
      }
      item.nextRun = nextRun;
      await item.save();
    }
    res.json({ created: createdCount });
  } catch (error) {
    res.status(500).json({ message: 'Unable to apply recurring transactions.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});