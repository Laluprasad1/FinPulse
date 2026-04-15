import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
const CATEGORY_OPTIONS = [
  'Housing',
  'Food',
  'Transport',
  'Utilities',
  'Shopping',
  'Health',
  'Savings',
  'Entertainment',
  'Salary',
  'Freelance',
  'Other',
];
const PIE_COLORS = ['#f37550', '#2da676', '#4f79ff', '#f6c453', '#8f6ded'];
const LOCALE_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'Hindi (IN)' },
  { value: 'bn-BD', label: 'Bangla (BD)' },
  { value: 'ja-JP', label: 'Japanese (JP)' },
];
const DEFAULT_PROFILE = {
  name: 'User',
  avatarUrl: '',
};
const DEFAULT_SETTINGS = {
  weeklySummary: true,
  budgetAlerts: true,
  showForecast: true,
};
const EMPTY_TRIP_DRAFT = {
  name: '',
  date: '',
  budget: '',
};
const EMPTY_TRIP_TRANSACTION = {
  type: 'expense',
  amount: '',
  category: '',
  date: '',
  note: '',
  tags: '',
  splitType: 'none',
  paidBy: '',
  selectedMemberIds: [],
  splitMembers: {},
};

const Dashboard = ({ user, onSignOut, pendingInviteToken, onInviteTokenConsumed }) => {
  const [data, setData] = useState({ totalIncome: 0, totalExpenses: 0 });
  const [transactions, setTransactions] = useState([]);
  const [monthlySeries, setMonthlySeries] = useState([]);
  const [weeklySeries, setWeeklySeries] = useState([]);
  const [categorySeries, setCategorySeries] = useState([]);
  const [forecast, setForecast] = useState({ baseBalance: 0, averageNet: 0, series: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [currency, setCurrency] = useState('USD');
  const [locale, setLocale] = useState('en-US');
  const [theme, setTheme] = useState('light');
  const [chartRange, setChartRange] = useState('monthly');
  const [formState, setFormState] = useState({
    type: 'expense',
    amount: '',
    category: '',
    date: '',
    note: '',
    tags: '',
    recurring: false,
    frequency: 'monthly',
    nextRun: '',
  });
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [profileDraft, setProfileDraft] = useState(DEFAULT_PROFILE);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [trips, setTrips] = useState([]);
  const [tripDraft, setTripDraft] = useState({ ...EMPTY_TRIP_DRAFT });
  const [tripError, setTripError] = useState('');
  const [tripsLoading, setTripsLoading] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [tripTransactions, setTripTransactions] = useState([]);
  const [tripTransactionsLoading, setTripTransactionsLoading] = useState(false);
  const [tripTransactionForm, setTripTransactionForm] = useState({
    ...EMPTY_TRIP_TRANSACTION,
    tags: '',
    paidBy: user?.id || '',
  });
  const [filterTag, setFilterTag] = useState('');
  const [budgetSummary, setBudgetSummary] = useState([]);
  const [budgetDraft, setBudgetDraft] = useState({
    name: '',
    amount: '',
    period: 'monthly',
    category: 'All',
  });
  const [budgetError, setBudgetError] = useState('');
  const [anomalies, setAnomalies] = useState({ categorySpikes: [], largeTransactions: [] });
  const [tripInviteError, setTripInviteError] = useState('');
  const [tripSettlement, setTripSettlement] = useState([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [tripInviteLink, setTripInviteLink] = useState('');
  const [invitePopupOpen, setInvitePopupOpen] = useState(false);
  const [transactionDetailOpen, setTransactionDetailOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const toastTimerRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const topRef = useRef(null);
  const addSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const profileMenuRef = useRef(null);
  const [activePanel, setActivePanel] = useState('home');

  const currencyFormatter = useMemo(() => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
  }, [currency, locale]);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  }, []);

  const loadTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/trips`);
      setTrips(response.data);
    } catch (err) {
      showToast('Unable to load trips.', 'error');
    } finally {
      setTripsLoading(false);
    }
  }, [showToast]);

  const loadBudgets = useCallback(async () => {
    try {
      const summaryResponse = await axios.get(`${API_BASE}/api/budgets/summary`);
      setBudgetSummary(summaryResponse.data);
      if (settings.budgetAlerts) {
        summaryResponse.data
          .filter((item) => item.amount > 0 && item.spent > item.amount)
          .forEach((item) => {
            showToast(`Budget alert: ${item.name} exceeded.`, 'error');
          });
      }
    } catch (err) {
      showToast('Unable to load budgets.', 'error');
    }
  }, [settings.budgetAlerts, showToast]);

  const loadAnomalies = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/insights/anomalies`);
      setAnomalies(response.data);
    } catch (err) {
      showToast('Unable to load anomalies.', 'error');
    }
  }, [showToast]);

  const loadTripSettlement = useCallback(
    async (tripId) => {
      if (!tripId) {
        setTripSettlement([]);
        return;
      }
      try {
        const response = await axios.get(`${API_BASE}/api/trips/${tripId}/settle`);
        setTripSettlement(response.data.balances || []);
      } catch (err) {
        showToast('Unable to load trip settlement.', 'error');
      }
    },
    [showToast]
  );

  const loadTripTransactions = useCallback(
    async (tripId) => {
      if (!tripId) {
        setTripTransactions([]);
        return;
      }
      setTripTransactionsLoading(true);
      try {
        const response = await axios.get(`${API_BASE}/api/transactions`, {
          params: { tripId, limit: 100 },
        });
        setTripTransactions(response.data);
      } catch (err) {
        showToast('Unable to load trip transactions.', 'error');
      } finally {
        setTripTransactionsLoading(false);
      }
    },
    [showToast]
  );

  const loadDashboard = useCallback(async (isRefresh = false) => {
    setError('');
    setActionMessage('');
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      try {
        await axios.post(`${API_BASE}/api/recurring/apply`);
      } catch (error) {
        // Non-critical: recurring apply failure should not block dashboard load.
      }

      const results = await Promise.allSettled([
        axios.get(`${API_BASE}/api/dashboard`),
        axios.get(`${API_BASE}/api/transactions?limit=8`),
        axios.get(`${API_BASE}/api/analytics/monthly?months=6`),
        axios.get(`${API_BASE}/api/analytics/weekly?weeks=8`),
        axios.get(`${API_BASE}/api/analytics/categories`),
        axios.get(`${API_BASE}/api/analytics/forecast?months=4&historyMonths=3`),
      ]);

      const [summary, recent, monthly, weekly, categories, forecastResponse] = results;

      const hasSummary = summary.status === 'fulfilled';
      const hasRecent = recent.status === 'fulfilled';
      if (!hasSummary && !hasRecent) {
        setError('Could not load dashboard data. Please try again.');
        return;
      }

      if (hasSummary) {
        setData(summary.value.data);
      }
      if (hasRecent) {
        setTransactions(recent.value.data);
      }
      if (monthly.status === 'fulfilled') {
        setMonthlySeries(monthly.value.data);
      } else {
        setMonthlySeries([]);
      }
      if (weekly.status === 'fulfilled') {
        setWeeklySeries(weekly.value.data);
      } else {
        setWeeklySeries([]);
      }
      if (categories.status === 'fulfilled') {
        setCategorySeries(categories.value.data);
      } else {
        setCategorySeries([]);
      }
      if (forecastResponse.status === 'fulfilled') {
        setForecast(forecastResponse.value.data);
      } else {
        setForecast({ baseBalance: 0, averageNet: 0, series: [] });
      }

      setLastUpdated(new Date());
      await Promise.allSettled([loadTrips(), loadBudgets(), loadAnomalies()]);
    } catch (err) {
      setError('Could not load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadAnomalies, loadBudgets, loadTrips]);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem('pf-locale');
    const storedCurrency = window.localStorage.getItem('pf-currency');
    const storedTheme = window.localStorage.getItem('pf-theme');
    const storedSettings = window.localStorage.getItem('pf-settings');
    if (storedLocale) {
      setLocale(storedLocale);
    }
    if (storedCurrency) {
      setCurrency(storedCurrency);
    }
    if (storedTheme) {
      setTheme(storedTheme);
    }
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      } catch (error) {
        setSettings(DEFAULT_SETTINGS);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('pf-locale', locale);
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem('pf-currency', currency);
  }, [currency]);

  useEffect(() => {
    window.localStorage.setItem('pf-theme', theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem('pf-settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!user) {
      return;
    }
    axios
      .get(`${API_BASE}/api/profile`)
      .then((response) => {
        const nextProfile = {
          name: response.data.name || user.name || 'User',
          avatarUrl: response.data.avatarUrl || '',
        };
        setProfile(nextProfile);
        setProfileDraft(nextProfile);
      })
      .catch(() => {
        setProfile({ name: user.name || 'User', avatarUrl: '' });
      });
  }, [user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current) {
        return;
      }
      if (!profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const balance = data.totalIncome - data.totalExpenses;
  const savingsRate = data.totalIncome > 0 ? (balance / data.totalIncome) * 100 : 0;
  const chartData = chartRange === 'weekly' ? weeklySeries : monthlySeries;
  const profileInitials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = filterType === 'all' || item.type === filterType;
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesTag = !filterTag || (item.tags || []).includes(filterTag);
      return matchesSearch && matchesType && matchesCategory && matchesTag;
    });
  }, [transactions, searchTerm, filterType, filterCategory, filterTag]);

  const suggestCategory = (note) => {
    const value = note.toLowerCase();
    if (value.includes('uber') || value.includes('taxi') || value.includes('bus')) {
      return 'Transport';
    }
    if (value.includes('rent') || value.includes('mortgage')) {
      return 'Housing';
    }
    if (value.includes('grocery') || value.includes('food') || value.includes('restaurant')) {
      return 'Food';
    }
    if (value.includes('netflix') || value.includes('movie') || value.includes('game')) {
      return 'Entertainment';
    }
    return '';
  };

  const selectedTrip = useMemo(() => {
    if (!selectedTripId) {
      return null;
    }
    return trips.find((trip) => (trip._id || trip.id) === selectedTripId) || null;
  }, [selectedTripId, trips]);

  const getTripMemberKey = useCallback((member) => {
    return member?._id || member?.userId || member?.email || '';
  }, []);

  const getTripMemberLabel = useCallback((member) => {
    if (member?.name && String(member.name).trim()) {
      return member.name.trim();
    }
    return member?.userId ? `Member ${String(member.userId).slice(-4)}` : 'Member';
  }, []);

  const resolveTripMemberName = useCallback(
    (memberId) => {
      if (!memberId) {
        return 'Unknown';
      }
      const match = selectedTrip?.members?.find(
        (member) =>
          String(member._id || '') === String(memberId) ||
          String(member.userId || '') === String(memberId)
      );
      if (match) {
        return getTripMemberLabel(match);
      }
      if (String(memberId) === String(user?.id || '')) {
        return user?.name || 'You';
      }
      return String(memberId);
    },
    [getTripMemberLabel, selectedTrip?.members, user?.id, user?.name]
  );

  const activeTripMembers = useMemo(() => {
    if (!selectedTrip?.members) {
      return [];
    }
    return selectedTrip.members.filter((member) => member.status !== 'removed');
  }, [selectedTrip]);

  const getTripSpent = (trip) => Number(trip.spent || trip.totals?.expenses || 0);

  const tripTransactionSummary = useMemo(() => {
    return tripTransactions.reduce(
      (acc, item) => {
        if (item.type === 'income') {
          acc.income += Number(item.amount || 0);
        } else {
          acc.expenses += Number(item.amount || 0);
        }
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [tripTransactions]);

  const selectedSplitMembers = useMemo(() => {
    return activeTripMembers.filter((member) =>
      tripTransactionForm.selectedMemberIds.includes(getTripMemberKey(member))
    );
  }, [activeTripMembers, getTripMemberKey, tripTransactionForm.selectedMemberIds]);

  const myTripMember = useMemo(() => {
    if (!selectedTrip?.members?.length) {
      return null;
    }
    return (
      selectedTrip.members.find(
        (member) =>
          String(member.userId || '') === String(user?.id || '') ||
          (member.email || '').toLowerCase() === (user?.email || '').toLowerCase()
      ) || null
    );
  }, [selectedTrip?.members, user?.email, user?.id]);

  const isTripOwner = useMemo(() => {
    return selectedTrip ? String(selectedTrip.ownerId || '') === String(user?.id || '') : false;
  }, [selectedTrip, user?.id]);

  const canManageMembers = useMemo(() => {
    return isTripOwner || myTripMember?.role === 'cohost';
  }, [isTripOwner, myTripMember?.role]);

  const handleFormChange = (field, value) => {
    setFormState((prev) => {
      if (field === 'note' && !prev.category) {
        const suggested = suggestCategory(value);
        return { ...prev, [field]: value, category: suggested || prev.category };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleAddTransaction = async (event) => {
    event.preventDefault();
    setActionError('');
    setActionMessage('');

    if (!formState.amount || !formState.category || !formState.date) {
      setActionError('Please fill in amount, category, and date.');
      return;
    }

    try {
      await axios.post(`${API_BASE}/api/transactions`, {
        ...formState,
        amount: Number(formState.amount),
        tags: formState.tags,
      });
      if (formState.recurring) {
        const nextRun = formState.nextRun || formState.date;
        await axios.post(`${API_BASE}/api/recurring`, {
          type: formState.type,
          amount: Number(formState.amount),
          category: formState.category,
          note: formState.note,
          tags: formState.tags,
          frequency: formState.frequency,
          nextRun,
        });
      }
      setFormState({
        type: 'expense',
        amount: '',
        category: '',
        date: '',
        note: '',
        tags: '',
        recurring: false,
        frequency: 'monthly',
        nextRun: '',
      });
      setActionMessage('Transaction saved.');
      showToast('Transaction saved.');
      loadDashboard(true);
    } catch (err) {
      setActionError('Unable to save transaction.');
      showToast('Unable to save transaction.', 'error');
    }
  };

  const handleExportCsv = async () => {
    setActionError('');
    setActionMessage('');
    try {
      const response = await axios.get(`${API_BASE}/api/transactions/export`, {
        responseType: 'blob',
      });
      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'transactions.csv';
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      showToast('CSV exported.');
    } catch (err) {
      setActionError('Export failed.');
      showToast('Export failed.', 'error');
    }
  };

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setImporting(true);
    setActionError('');
    setActionMessage('');
    try {
      const text = await file.text();
      await axios.post(`${API_BASE}/api/transactions/import`, { csv: text });
      setActionMessage('CSV imported successfully.');
      showToast('CSV imported successfully.');
      loadDashboard(true);
    } catch (err) {
      setActionError('Import failed. Check CSV format.');
      showToast('Import failed. Check CSV format.', 'error');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const applyQuickAdd = (patch) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  };

  const handleProfileDraftChange = (field, value) => {
    setProfileDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleTripDraftChange = (field, value) => {
    setTripDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleTripTransactionChange = (field, value) => {
    setTripTransactionForm((prev) => {
      if (field === 'splitType') {
        return {
          ...prev,
          splitType: value,
          selectedMemberIds:
            value === 'none' ? [] : prev.selectedMemberIds.length ? prev.selectedMemberIds : activeTripMembers.map((member) => getTripMemberKey(member)),
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const toggleTripMemberSelection = (memberKey) => {
    setTripTransactionForm((prev) => {
      const isSelected = prev.selectedMemberIds.includes(memberKey);
      const nextSelectedMemberIds = isSelected
        ? prev.selectedMemberIds.filter((id) => id !== memberKey)
        : [...prev.selectedMemberIds, memberKey];
      return {
        ...prev,
        selectedMemberIds: nextSelectedMemberIds,
      };
    });
  };

  const handleSplitAmountChange = (memberKey, value) => {
    setTripTransactionForm((prev) => ({
      ...prev,
      splitMembers: {
        ...prev.splitMembers,
        [memberKey]: value,
      },
    }));
  };

  const handleDeleteTrip = async () => {
    if (!selectedTripId) return;
    if (!window.confirm('Are you sure? This will delete the trip and all its transactions.')) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/trips/${selectedTripId}`);
      setSelectedTripId(null);
      await loadTrips();
      showToast('Trip deleted.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to delete trip.';
      showToast(message, 'error');
    }
  };

  const handleOpenShareModal = () => {
    if (!selectedTripId) {
      return;
    }
    setTripInviteError('');
    axios
      .post(`${API_BASE}/api/trips/${selectedTripId}/invite-link`)
      .then((response) => {
        setTripInviteLink(response.data.inviteLink || '');
        setShareModalOpen(true);
      })
      .catch((error) => {
        const message = error?.response?.data?.message || 'Unable to create invite link.';
        setTripInviteError(message);
      });
  };

  const handleCopyInviteLink = async () => {
    if (!tripInviteLink) {
      return;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tripInviteLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = tripInviteLink;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast('Invite link copied to clipboard!');
      setShareModalOpen(false);
    } catch (error) {
      showToast('Unable to copy link to clipboard.', 'error');
    }
  };

  const handleWhatsAppShare = () => {
    if (!tripInviteLink) {
      return;
    }
    const trip = trips.find((t) => t._id === selectedTripId);
    const message = `Join me on FinPulse for the trip "${trip?.name}"!\n\n${tripInviteLink}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    setShareModalOpen(false);
  };

  const handleEmailInvite = async () => {
    if (!selectedTripId) {
      return;
    }
    const email = window.prompt('Enter your friend\'s email');
    if (!email) {
      return;
    }
    setTripInviteError('');
    try {
      await axios.post(`${API_BASE}/api/trips/${selectedTripId}/invite`, {
        email: email.trim(),
        method: 'email',
      });
      showToast('Invite sent via email!');
      setShareModalOpen(false);
      await loadTrips();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to send email invite.';
      setTripInviteError(message);
      showToast(message, 'error');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!selectedTripId || !memberId) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/trips/${selectedTripId}/members/${memberId}`);
      await loadTrips();
      showToast('Member removed from trip.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to remove member.';
      showToast(message, 'error');
    }
  };

  const handleUpdateMemberRole = async (memberId, role) => {
    if (!selectedTripId || !memberId) {
      return;
    }
    try {
      await axios.put(`${API_BASE}/api/trips/${selectedTripId}/members/${memberId}/role`, {
        role,
      });
      await loadTrips();
      showToast('Member role updated.');
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update member role.';
      showToast(message, 'error');
    }
  };

  const openTransactionDetails = (item, source = 'history') => {
    setSelectedTransaction({ ...item, source });
    setTransactionDetailOpen(true);
  };

  const closeTransactionDetails = () => {
    setTransactionDetailOpen(false);
    setSelectedTransaction(null);
  };

  const handleDeleteTransaction = async (transactionId, source = 'history') => {
    if (!transactionId) {
      return;
    }
    if (!window.confirm('Delete this transaction?')) {
      return;
    }
    try {
      await axios.delete(`${API_BASE}/api/transactions/${transactionId}`);
      showToast('Transaction deleted.');
      if (source === 'trip' && selectedTripId) {
        await loadTripTransactions(selectedTripId);
        await loadTripSettlement(selectedTripId);
      }
      await loadDashboard(true);
      closeTransactionDetails();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to delete transaction.';
      showToast(message, 'error');
    }
  };

  const handleResetAllBalances = async () => {
    if (!window.confirm('Reset all income, expense and balance data to zero?')) {
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/transactions/reset`);
      showToast('All totals reset to zero.');
      await loadDashboard(true);
      if (selectedTripId) {
        await loadTripTransactions(selectedTripId);
        await loadTripSettlement(selectedTripId);
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to reset totals.';
      showToast(message, 'error');
    }
  };

  const handleAcceptTripInvite = async () => {
    if (!pendingInviteToken) {
      return;
    }
    try {
      const response = await axios.post(`${API_BASE}/api/trips/accept-invite`, {
        token: pendingInviteToken,
      });
      showToast(response.data.message || 'Trip invitation accepted.');
      await loadTrips();
      setInvitePopupOpen(false);
      if (typeof onInviteTokenConsumed === 'function') {
        onInviteTokenConsumed();
      }
      setActivePanel('trips');
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to accept invite.';
      showToast(message, 'error');
      if (typeof onInviteTokenConsumed === 'function') {
        onInviteTokenConsumed();
      }
      setInvitePopupOpen(false);
    }
  };

  const handleDeclineTripInvite = () => {
    setInvitePopupOpen(false);
    if (typeof onInviteTokenConsumed === 'function') {
      onInviteTokenConsumed();
    }
  };

  const handleBudgetChange = (field, value) => {
    setBudgetDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddBudget = async (event) => {
    event.preventDefault();
    setBudgetError('');
    if (!budgetDraft.name || !budgetDraft.amount) {
      setBudgetError('Name and amount are required.');
      return;
    }
    try {
      await axios.post(`${API_BASE}/api/budgets`, {
        name: budgetDraft.name,
        amount: Number(budgetDraft.amount),
        period: budgetDraft.period,
        category: budgetDraft.category,
      });
      setBudgetDraft({ name: '', amount: '', period: 'monthly', category: 'All' });
      await loadBudgets();
      showToast('Budget saved.');
    } catch (err) {
      setBudgetError('Unable to save budget.');
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 160;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        if (!context) {
          handleProfileDraftChange('avatarUrl', reader.result);
          return;
        }
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (size - width) / 2;
        const y = (size - height) / 2;
        context.drawImage(image, x, y, width, height);
        const resized = canvas.toDataURL('image/jpeg', 0.92);
        handleProfileDraftChange('avatarUrl', resized);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!profileDraft.name.trim()) {
      setActionError('Name is required.');
      showToast('Name is required.', 'error');
      return;
    }
    try {
      const response = await axios.put(`${API_BASE}/api/profile`, {
        name: profileDraft.name.trim(),
        avatarUrl: profileDraft.avatarUrl || '',
      });
      const nextProfile = {
        name: response.data.name || profileDraft.name.trim(),
        avatarUrl: response.data.avatarUrl || profileDraft.avatarUrl || '',
      };
      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      showToast('Profile updated.');
      setActivePanel('home');
    } catch (error) {
      setActionError('Unable to update profile.');
      showToast('Unable to update profile.', 'error');
    }
  };

  const resetProfileDraft = () => {
    setProfileDraft(profile);
  };

  const handleAddTrip = (event) => {
    event.preventDefault();
    setTripError('');
    const trimmedName = tripDraft.name.trim();
    if (!trimmedName || !tripDraft.date) {
      setTripError('Please add a trip name and date.');
      showToast('Please add a trip name and date.', 'error');
      return;
    }
    const payload = {
      name: trimmedName,
      date: tripDraft.date,
      budget: tripDraft.budget === '' ? null : Number(tripDraft.budget),
    };
    axios
      .post(`${API_BASE}/api/trips`, payload)
      .then((response) => {
        const tripId = response.data._id || response.data.id;
        setTrips((prev) => [response.data, ...prev]);
        setTripDraft({ ...EMPTY_TRIP_DRAFT });
        showToast('Trip saved.');
        setSelectedTripId(tripId);
        setTripTransactionForm({ ...EMPTY_TRIP_TRANSACTION, paidBy: user?.id || '' });
        setActivePanel('trips');
        loadTripTransactions(tripId);
      })
      .catch((err) => {
        const message = err?.response?.data?.message || 'Unable to save trip.';
        setTripError(message);
        showToast(message, 'error');
      });
  };

  const handleAddTripTransaction = async (event) => {
    event.preventDefault();
    if (!selectedTripId) {
      showToast('Select a trip first.', 'error');
      return;
    }
    if (!tripTransactionForm.amount || !tripTransactionForm.category || !tripTransactionForm.date) {
      showToast('Please fill in amount, category, and date.', 'error');
      return;
    }

    const chosenMembers =
      tripTransactionForm.selectedMemberIds.length > 0
        ? activeTripMembers.filter((member) =>
            tripTransactionForm.selectedMemberIds.includes(getTripMemberKey(member))
          )
        : activeTripMembers;

    let splitMembers = [];
    if (tripTransactionForm.splitType === 'custom') {
      splitMembers = chosenMembers
        .map((member) => {
          const key = getTripMemberKey(member);
          const amount = Number(tripTransactionForm.splitMembers[key] || 0);
          return {
            userId: member.userId || null,
            email: member.email,
            name: member.name || member.email,
            amount,
          };
        })
        .filter((entry) => entry.amount > 0);
      const totalSplit = splitMembers.reduce((sum, entry) => sum + entry.amount, 0);
      if (Math.abs(totalSplit - Number(tripTransactionForm.amount)) > 0.01) {
        showToast('Split amounts must match the total amount.', 'error');
        return;
      }
    }

    try {
      await axios.post(`${API_BASE}/api/transactions`, {
        ...tripTransactionForm,
        amount: Number(tripTransactionForm.amount),
        tripId: selectedTripId,
        tags: tripTransactionForm.tags,
        splitType: tripTransactionForm.splitType,
        splitMembers:
          tripTransactionForm.splitType === 'none'
            ? []
            : tripTransactionForm.splitType === 'equal'
              ? chosenMembers.map((member) => ({
                  userId: member.userId || null,
                  email: member.email,
                  name: member.name || member.email,
                }))
              : splitMembers,
        paidBy: tripTransactionForm.paidBy || user?.id || '',
      });
      setTripTransactionForm({ ...EMPTY_TRIP_TRANSACTION, paidBy: user?.id || '' });
      showToast('Trip transaction saved.');
      await loadTripTransactions(selectedTripId);
      await loadDashboard(true);
    } catch (err) {
      showToast('Unable to save trip transaction.', 'error');
    }
  };

  const scrollToSection = (ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openPanel = (panel, ref) => {
    if (panel === 'profile') {
      setProfileDraft(profile);
    }
    if (panel === 'trip') {
      setTripDraft({ ...EMPTY_TRIP_DRAFT });
      setTripError('');
    }
    if (panel === 'trips' && trips.length > 0 && !selectedTripId) {
      const firstTripId = trips[0]._id || trips[0].id;
      setSelectedTripId(firstTripId);
      loadTripTransactions(firstTripId);
    }
    setActivePanel(panel);
    if (panel === 'home' || panel === 'analytics' || panel === 'history' || panel === 'trips') {
      scrollToSection(ref);
    }
  };

  const closePanel = () => {
    setActivePanel('home');
  };

  useEffect(() => {
    if (selectedTripId) {
      loadTripTransactions(selectedTripId);
      loadTripSettlement(selectedTripId);
    }
  }, [loadTripSettlement, loadTripTransactions, selectedTripId]);

  useEffect(() => {
    if (!activeTripMembers.length) {
      return;
    }
    setTripTransactionForm((prev) => {
      const filteredSelectedIds = prev.selectedMemberIds.filter((id) =>
        activeTripMembers.some((member) => getTripMemberKey(member) === id)
      );
      const nextSelectedMemberIds =
        filteredSelectedIds.length > 0
          ? filteredSelectedIds
          : activeTripMembers.map((member) => getTripMemberKey(member));

      return {
        ...prev,
        paidBy: prev.paidBy || user?.id || '',
        selectedMemberIds: nextSelectedMemberIds,
      };
    });
  }, [activeTripMembers, getTripMemberKey, user?.id]);

  useEffect(() => {
    if (trips.length === 0) {
      return;
    }
    const hasSelected = trips.some((trip) => (trip._id || trip.id) === selectedTripId);
    if (!hasSelected) {
      const fallbackId = trips[0]._id || trips[0].id;
      setSelectedTripId(fallbackId);
    }
  }, [selectedTripId, trips]);

  useEffect(() => {
    if (pendingInviteToken) {
      setInvitePopupOpen(true);
      setActivePanel('trips');
    }
  }, [pendingInviteToken]);

  const isModalPanel = useMemo(() => {
    return ['add', 'trip', 'settings', 'profile', 'currency'].includes(
      activePanel
    );
  }, [activePanel]);

  return (
    <div className="wallet-shell" ref={topRef}>
      <header className="top-nav" role="banner">
        <div className="nav-left">
          <div className="brand-mark">FP</div>
          <button
            type="button"
            className={`theme-toggle ${theme === 'dark' ? 'dark' : 'light'}`}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="theme-icon" aria-hidden="true">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
        </div>
        <div className="nav-center">
          <h1 className="app-title">FinPulse</h1>
        </div>
        <div className="nav-right" ref={profileMenuRef}>
          <button
            className="profile-card"
            type="button"
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={isProfileOpen}
          >
            {profile.avatarUrl ? (
              <img className="avatar-image" src={profile.avatarUrl} alt="User avatar" />
            ) : (
              <span className="avatar" aria-hidden="true">
                {profileInitials || 'U'}
              </span>
            )}
            <span className="profile-text">
              <strong>{profile.name}</strong>
            </span>
          </button>
          {isProfileOpen && (
            <div className="profile-menu" role="menu">
              <div className="profile-menu-header">
                {profile.avatarUrl ? (
                  <img className="avatar-large" src={profile.avatarUrl} alt="User avatar" />
                ) : (
                  <div className="avatar-large fallback" aria-hidden="true">
                    {profileInitials || 'U'}
                  </div>
                )}
                <div>
                  <strong>{profile.name}</strong>
                  <span>View profile</span>
                </div>
              </div>
              <div className="menu-divider" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsProfileOpen(false);
                  openPanel('settings');
                }}
              >
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsProfileOpen(false);
                  openPanel('profile');
                }}
              >
                Edit profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsProfileOpen(false);
                  openPanel('currency');
                }}
              >
                Currency
              </button>
              {onSignOut && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignOut();
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="hero-strip">
        <div>
          <p className="eyebrow">Personal Finance</p>
          <h2>Good afternoon, {profile.name}</h2>
          <p className="subtitle">Your money snapshot, refreshed in real time.</p>
          {lastUpdated && (
            <p className="timestamp">Last updated {lastUpdated.toLocaleTimeString(locale)}</p>
          )}
        </div>
        <div className="hero-actions">
          <button
            className="ghost-button"
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={loading || refreshing}
            aria-busy={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="ghost-button danger-text" type="button" onClick={handleResetAllBalances}>
            Reset totals
          </button>
        </div>
      </section>

      {toast && (
        <div className={`toast ${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {loading && (
        <div className="status-card" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>Loading dashboard data...</p>
        </div>
      )}

      {!loading && error && (
        <div className="status-card error" role="alert">
          <p>{error}</p>
          <button className="ghost-button" type="button" onClick={() => loadDashboard(true)}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && activePanel === 'home' && (
        <section className="wallet-content">
          <div className="wallet-left">
            <section className="balance-strip">
              <article className="balance-card">
                <p>Total Balance</p>
                <h2>{currencyFormatter.format(balance)}</h2>
                <span>{balance >= 0 ? 'On track' : 'Needs review'}</span>
              </article>
              <article className="mini-card">
                <p>Income</p>
                <strong>{currencyFormatter.format(data.totalIncome)}</strong>
              </article>
              <article className="mini-card">
                <p>Expenses</p>
                <strong>{currencyFormatter.format(data.totalExpenses)}</strong>
              </article>
            </section>

            <section className="trip-strip">
              <div className="trip-header">
                <div>
                  <p className="eyebrow">Trips</p>
                  <h3>Plan your travel budgets</h3>
                  <p className="subtitle">Track upcoming trips and keep costs organized.</p>
                </div>
                <button type="button" className="primary-button" onClick={() => openPanel('trip')}>
                  Add trip
                </button>
              </div>
              <div className="trip-list" aria-live="polite">
                {tripsLoading ? (
                  <div className="empty-state">Loading trips...</div>
                ) : trips.length === 0 ? (
                  <div className="empty-state">No trips yet. Add one to get started.</div>
                ) : (
                  trips.slice(0, 3).map((trip) => (
                    <div key={trip._id || trip.id} className="trip-item">
                      <div>
                        <p>{trip.name}</p>
                        <span>{new Date(trip.date).toLocaleDateString(locale)}</span>
                      </div>
                      <div className="trip-metrics">
                        <span>
                          {Number.isFinite(Number(trip.budget))
                            ? `Budget ${currencyFormatter.format(Number(trip.budget))}`
                            : 'No budget set'}
                        </span>
                        <span>Spent {currencyFormatter.format(getTripSpent(trip))}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <aside className="wallet-right">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>CSV Import / Export</h3>
                  <p>Move data in and out of the tracker quickly.</p>
                </div>
              </div>
              <div className="csv-actions">
                <button className="ghost-button" type="button" onClick={handleExportCsv}>
                  Export CSV
                </button>
                <label className="file-upload">
                  <input type="file" accept=".csv" onChange={handleImportCsv} />
                  {importing ? 'Importing...' : 'Import CSV'}
                </label>
              </div>
              {actionError && <p className="form-message error">{actionError}</p>}
              {actionMessage && <p className="form-message">{actionMessage}</p>}
            </section>
          </aside>
        </section>
      )}

      {!loading && !error && activePanel === 'analytics' && (
        <section className="analytics-page">
          <section className="insight-row">
            <div className="insight-tile">
              <p>Savings rate</p>
              <strong>{savingsRate.toFixed(1)}%</strong>
            </div>
            <div className="insight-tile">
              <p>Expense ratio</p>
              <strong>
                {data.totalIncome > 0
                  ? `${((data.totalExpenses / data.totalIncome) * 100).toFixed(1)}%`
                  : '0.0%'}
              </strong>
            </div>
            <div className="insight-tile">
              <p>Status</p>
              <strong>{balance >= 0 ? 'Healthy' : 'Watchlist'}</strong>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Spending Alerts</h3>
                <p>Highlights for unusual activity.</p>
              </div>
            </div>
            <div className="anomaly-grid">
              <div>
                <strong>Category spikes</strong>
                {anomalies.categorySpikes.length === 0 ? (
                  <div className="empty-state">No spikes detected.</div>
                ) : (
                  anomalies.categorySpikes.map((item) => (
                    <div key={item.category} className="anomaly-item">
                      <span>{item.category}</span>
                      <span>
                        {currencyFormatter.format(item.current)} (avg{' '}
                        {currencyFormatter.format(item.previousAverage)})
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div>
                <strong>Large transactions</strong>
                {anomalies.largeTransactions.length === 0 ? (
                  <div className="empty-state">No large transactions.</div>
                ) : (
                  anomalies.largeTransactions.map((item) => (
                    <div key={item._id} className="anomaly-item">
                      <span>{item.category}</span>
                      <span>{currencyFormatter.format(item.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Income vs Expenses</h3>
                <p>Monthly and weekly performance tracking.</p>
              </div>
              <div className="segmented">
                <button
                  type="button"
                  className={chartRange === 'monthly' ? 'active' : ''}
                  onClick={() => setChartRange('monthly')}
                  aria-pressed={chartRange === 'monthly'}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={chartRange === 'weekly' ? 'active' : ''}
                  onClick={() => setChartRange('weekly')}
                  aria-pressed={chartRange === 'weekly'}
                >
                  Weekly
                </button>
              </div>
            </div>
            <div className="chart-container">
              {chartData.length === 0 ? (
                <div className="empty-state">No chart data yet. Add transactions to see trends.</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey={chartRange === 'weekly' ? 'week' : 'month'} />
                    <YAxis tickFormatter={(value) => currencyFormatter.format(value)} />
                    <Tooltip formatter={(value) => currencyFormatter.format(value)} />
                    <Legend />
                    <Bar dataKey="income" fill="#2da676" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="expenses" fill="#f37550" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Expense Categories</h3>
                <p>Where your spending is concentrated.</p>
              </div>
            </div>
            <div className="chart-container">
              {categorySeries.length === 0 ? (
                <div className="empty-state">No expenses recorded yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={categorySeries}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      {categorySeries.map((entry, index) => (
                        <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => currencyFormatter.format(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {categorySeries.length > 0 && (
              <div className="legend-list">
                {categorySeries.slice(0, 4).map((item, index) => (
                  <div key={item.category} className="legend-item">
                    <span
                      className="legend-dot"
                      style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <span>{item.category}</span>
                    <strong>{currencyFormatter.format(item.total)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          {settings.showForecast && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>Cashflow Forecast</h3>
                  <p>Projected balance for upcoming months.</p>
                </div>
              </div>
              <div className="forecast-summary">
                <div>
                  <p>Base Balance</p>
                  <h4>{currencyFormatter.format(forecast.baseBalance)}</h4>
                </div>
                <div>
                  <p>Avg. Monthly Net</p>
                  <h4>{currencyFormatter.format(forecast.averageNet)}</h4>
                </div>
              </div>
              <div className="chart-container">
                {forecast.series.length === 0 ? (
                  <div className="empty-state">
                    Forecast will appear once you have transaction history.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={forecast.series} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis tickFormatter={(value) => currencyFormatter.format(value)} />
                      <Tooltip formatter={(value) => currencyFormatter.format(value)} />
                      <Line
                        type="monotone"
                        dataKey="projectedBalance"
                        stroke="#4f79ff"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-header">
              <div>
                <h3>Budgets</h3>
                <p>Track spending against monthly or weekly targets.</p>
              </div>
            </div>
            <form className="transaction-form" onSubmit={handleAddBudget}>
              <div className="field">
                <label htmlFor="budget-name">Name</label>
                <input
                  id="budget-name"
                  type="text"
                  value={budgetDraft.name}
                  onChange={(event) => handleBudgetChange('name', event.target.value)}
                  placeholder="Groceries"
                />
              </div>
              <div className="field">
                <label htmlFor="budget-amount">Amount</label>
                <input
                  id="budget-amount"
                  type="number"
                  step="0.01"
                  value={budgetDraft.amount}
                  onChange={(event) => handleBudgetChange('amount', event.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label htmlFor="budget-period">Period</label>
                <select
                  id="budget-period"
                  value={budgetDraft.period}
                  onChange={(event) => handleBudgetChange('period', event.target.value)}
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="budget-category">Category</label>
                <select
                  id="budget-category"
                  value={budgetDraft.category}
                  onChange={(event) => handleBudgetChange('category', event.target.value)}
                >
                  <option value="All">All</option>
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <button className="primary-button" type="submit">
                Save budget
              </button>
              {budgetError && <p className="form-message error">{budgetError}</p>}
            </form>
            <div className="budget-list">
              {budgetSummary.length === 0 ? (
                <div className="empty-state">No budgets yet.</div>
              ) : (
                budgetSummary.map((item) => (
                  <div key={item.id} className="budget-item">
                    <div>
                      <p>{item.name}</p>
                      <span>
                        {item.category} · {item.period}
                      </span>
                    </div>
                    <strong>
                      {currencyFormatter.format(item.spent)} / {currencyFormatter.format(item.amount)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {!loading && !error && activePanel === 'history' && (
        <section className="analytics-page">
          <section ref={historySectionRef} id="recent-activity">
            <div className="panel-header">
              <div>
                <h3>Recent Activity</h3>
                <p>Latest transactions synced from the backend.</p>
              </div>
            </div>
            <div className="filters">
              <input
                type="search"
                placeholder="Search category or note"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search transactions"
              />
              <input
                type="text"
                placeholder="Filter by tag"
                value={filterTag}
                onChange={(event) => setFilterTag(event.target.value)}
                aria-label="Filter by tag"
              />
              <select
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="transaction-list" aria-live="polite">
              {filteredTransactions.length === 0 ? (
                <div className="empty-state">No transactions match your filters.</div>
              ) : (
                filteredTransactions.map((item) => (
                  <div
                    key={item._id}
                    className="transaction-item transaction-item-button"
                    onClick={() => openTransactionDetails(item, 'history')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openTransactionDetails(item, 'history');
                      }
                    }}
                  >
                    <div>
                      <p>{item.category}</p>
                      <span>{new Date(item.date).toLocaleDateString(locale)}</span>
                      {(item.tags || []).length > 0 && (
                        <span className="transaction-tags">#{item.tags.join(' #')}</span>
                      )}
                    </div>
                    <div className="transaction-item-actions">
                      <strong className={item.type === 'income' ? 'positive' : 'negative'}>
                        {currencyFormatter.format(item.amount)}
                      </strong>
                      <button
                        type="button"
                        className="icon-button icon-only icon-danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteTransaction(item._id, 'history');
                        }}
                        aria-label="Delete transaction"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                            fill="currentColor"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}

      {!loading && !error && activePanel === 'trips' && (
        <section className="analytics-page">
          <section className="trip-panel">
            <div className="trip-panel-actions">
              <button type="button" className="primary-button" onClick={() => openPanel('trip')}>
                Add trip
              </button>
            </div>
            <div className="trip-panel-grid">
              <div className="trip-panel-list" aria-live="polite">
                {tripsLoading ? (
                  <div className="empty-state">Loading trips...</div>
                ) : trips.length === 0 ? (
                  <div className="empty-state">No trips yet. Add one to get started.</div>
                ) : (
                  trips.map((trip) => {
                    const tripId = trip._id || trip.id;
                    return (
                      <button
                        key={tripId}
                        type="button"
                        className={`trip-list-item ${selectedTripId === tripId ? 'active' : ''}`}
                        onClick={() => setSelectedTripId(tripId)}
                      >
                        <div>
                          <p>{trip.name}</p>
                          <span>{new Date(trip.date).toLocaleDateString(locale)}</span>
                        </div>
                        <div className="trip-metrics">
                          <span>Spent {currencyFormatter.format(getTripSpent(trip))}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="trip-panel-detail">
                {!selectedTrip ? (
                  <div className="empty-state">Select a trip to view transactions.</div>
                ) : (
                  <>
                    <div className="trip-detail-header">
                      <div>
                        <h4>{selectedTrip.name}</h4>
                        <span>{new Date(selectedTrip.date).toLocaleDateString(locale)}</span>
                      </div>
                      <div className="trip-detail-metrics">
                        <div>
                          <label>Budget</label>
                          <strong>
                            {Number.isFinite(Number(selectedTrip.budget))
                              ? currencyFormatter.format(Number(selectedTrip.budget))
                              : 'No budget'}
                          </strong>
                        </div>
                        <div>
                          <label>Income</label>
                          <strong>{currencyFormatter.format(tripTransactionSummary.income)}</strong>
                        </div>
                        <div>
                          <label>Expenses</label>
                          <strong>{currencyFormatter.format(tripTransactionSummary.expenses)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="trip-members">
                      <div className="trip-members-header">
                        <strong>Members</strong>
                        <div className="trip-invite">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={handleOpenShareModal}
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={handleDeleteTrip}
                            style={{ color: '#e74c3c' }}
                          >
                            Delete Trip
                          </button>
                        </div>
                      </div>
                      {shareModalOpen && (
                        <div className="share-modal">
                          <div className="share-modal-content">
                            <div className="share-modal-header">
                              <span>Share Trip</span>
                              <button
                                type="button"
                                className="share-modal-close"
                                onClick={() => setShareModalOpen(false)}
                              >
                                ✕
                              </button>
                            </div>
                            <div className="share-options">
                              <button
                                type="button"
                                className="share-option"
                                onClick={handleCopyInviteLink}
                              >
                                <span className="share-option-icon">CL</span>
                                <div>
                                  <strong>Copy link</strong>
                                  <p>Share the trip link</p>
                                </div>
                              </button>
                              <button
                                type="button"
                                className="share-option"
                                onClick={handleWhatsAppShare}
                              >
                                <span className="share-option-icon">WA</span>
                                <div>
                                  <strong>WhatsApp</strong>
                                  <p>Share via WhatsApp</p>
                                </div>
                              </button>
                              <button type="button" className="share-option" onClick={handleEmailInvite}>
                                <span className="share-option-icon">EM</span>
                                <div>
                                  <strong>Email invite</strong>
                                  <p>Send invitation by email</p>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {tripInviteError && <p className="form-message error">{tripInviteError}</p>}
                      <div className="trip-members-list">
                        {(selectedTrip.members || []).map((member, index) => (
                          <div key={member._id || `${member.email}-${index}`} className="trip-member-item">
                            <span>{getTripMemberLabel(member)}</span>
                            <div className="trip-member-actions">
                              <span className="trip-member-role">
                                {member.role || 'member'} · {member.status}
                              </span>
                              {isTripOwner && member.role !== 'owner' && (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() =>
                                    handleUpdateMemberRole(
                                      member._id,
                                      member.role === 'cohost' ? 'member' : 'cohost'
                                    )
                                  }
                                >
                                  {member.role === 'cohost' ? 'Remove co-host' : 'Make co-host'}
                                </button>
                              )}
                              {canManageMembers && member.role !== 'owner' && (
                                <button
                                  type="button"
                                  className="icon-button icon-only icon-danger"
                                  onClick={() => handleRemoveMember(member._id)}
                                  aria-label="Remove member"
                                >
                                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                                    <path
                                      d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <form className="transaction-form" onSubmit={handleAddTripTransaction}>
                      <div className="field">
                        <label htmlFor="trip-type">Type</label>
                        <select
                          id="trip-type"
                          value={tripTransactionForm.type}
                          onChange={(event) =>
                            handleTripTransactionChange('type', event.target.value)
                          }
                        >
                          <option value="income">Income</option>
                          <option value="expense">Expense</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="trip-amount">Amount</label>
                        <input
                          id="trip-amount"
                          type="number"
                          step="0.01"
                          value={tripTransactionForm.amount}
                          onChange={(event) =>
                            handleTripTransactionChange('amount', event.target.value)
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="trip-paid-by">Paid by</label>
                        <select
                          id="trip-paid-by"
                          value={tripTransactionForm.paidBy}
                          onChange={(event) =>
                            handleTripTransactionChange('paidBy', event.target.value)
                          }
                        >
                          <option value="">Select payer</option>
                          {activeTripMembers.map((member) => {
                            const memberKey = getTripMemberKey(member);
                            return (
                              <option key={memberKey} value={member.userId || member.email || memberKey}>
                                {getTripMemberLabel(member)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="trip-category">Category</label>
                        <select
                          id="trip-category"
                          value={tripTransactionForm.category}
                          onChange={(event) =>
                            handleTripTransactionChange('category', event.target.value)
                          }
                        >
                          <option value="">Select category</option>
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="trip-date">Date</label>
                        <input
                          id="trip-date"
                          type="date"
                          value={tripTransactionForm.date}
                          onChange={(event) =>
                            handleTripTransactionChange('date', event.target.value)
                          }
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="trip-note">Note</label>
                        <input
                          id="trip-note"
                          type="text"
                          value={tripTransactionForm.note}
                          onChange={(event) =>
                            handleTripTransactionChange('note', event.target.value)
                          }
                          placeholder="Optional note"
                        />
                      </div>
                      <div className="field full">
                        <label htmlFor="trip-tags">Tags</label>
                        <input
                          id="trip-tags"
                          type="text"
                          value={tripTransactionForm.tags}
                          onChange={(event) =>
                            handleTripTransactionChange('tags', event.target.value)
                          }
                          placeholder="e.g. hotel, taxi"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="trip-split">Split</label>
                        <select
                          id="trip-split"
                          value={tripTransactionForm.splitType}
                          onChange={(event) =>
                            handleTripTransactionChange('splitType', event.target.value)
                          }
                        >
                          <option value="none">No split</option>
                          <option value="equal">Split equally</option>
                          <option value="custom">Custom split</option>
                        </select>
                      </div>
                      {tripTransactionForm.splitType !== 'none' && (
                        <div className="trip-split-participants">
                          <label>Split participants</label>
                          <div className="member-chip-grid">
                            {activeTripMembers.map((member) => {
                              const memberKey = getTripMemberKey(member);
                              const isSelected = tripTransactionForm.selectedMemberIds.includes(memberKey);
                              return (
                                <button
                                  key={memberKey}
                                  type="button"
                                  className={`member-chip ${isSelected ? 'selected' : ''}`}
                                  onClick={() => toggleTripMemberSelection(memberKey)}
                                >
                                  <span className="member-chip-check">{isSelected ? 'Selected' : 'Add'}</span>
                                  <span>{getTripMemberLabel(member)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {tripTransactionForm.splitType === 'custom' && (
                        <div className="split-grid">
                          {selectedSplitMembers.map((member) => {
                            const key = getTripMemberKey(member);
                            return (
                              <div key={key} className="field">
                                <label>{getTripMemberLabel(member)}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={tripTransactionForm.splitMembers[key] || ''}
                                  onChange={(event) =>
                                    handleSplitAmountChange(key, event.target.value)
                                  }
                                  placeholder="0.00"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <button className="primary-button" type="submit">
                        Save trip transaction
                      </button>
                    </form>

                    <div className="trip-settlement">
                      <strong>Settle up</strong>
                      {tripSettlement.length === 0 ? (
                        <div className="empty-state">No settlement data yet.</div>
                      ) : (
                        tripSettlement.map((entry, index) => (
                          <div key={`${entry.member.email || index}`} className="settlement-row">
                            <span className="settlement-name">{getTripMemberLabel(entry.member)}</span>
                            <span>
                              Paid {currencyFormatter.format(entry.paid)}
                            </span>
                            <span>
                              Share {currencyFormatter.format(entry.share)}
                            </span>
                            <strong className={entry.balance >= 0 ? 'positive' : 'negative'}>
                              {entry.balance >= 0 ? 'Gets' : 'Owes'}{' '}
                              {currencyFormatter.format(Math.abs(entry.balance))}
                            </strong>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="trip-transactions" aria-live="polite">
                      {tripTransactionsLoading ? (
                        <div className="empty-state">Loading transactions...</div>
                      ) : tripTransactions.length === 0 ? (
                        <div className="empty-state">No transactions for this trip.</div>
                      ) : (
                        tripTransactions.map((item) => (
                          <div
                            key={item._id}
                            className="trip-transaction-card"
                            onClick={() => openTransactionDetails(item, 'trip')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                openTransactionDetails(item, 'trip');
                              }
                            }}
                          >
                            <div className="trip-transaction-main">
                              <div>
                                <p>{item.category}</p>
                                <span>
                                  Paid by {resolveTripMemberName(item.paidBy || item.userId)} ·{' '}
                                  {new Date(item.date).toLocaleDateString(locale)}
                                </span>
                                {(item.tags || []).length > 0 && (
                                  <span className="transaction-tags">#{item.tags.join(' #')}</span>
                                )}
                              </div>
                              <div className="transaction-item-actions">
                                <strong className={item.type === 'income' ? 'positive' : 'negative'}>
                                  {currencyFormatter.format(item.amount)}
                                </strong>
                                {(String(item.userId || '') === String(user?.id || '') || canManageMembers) && (
                                  <button
                                    type="button"
                                    className="icon-button icon-only icon-danger"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleDeleteTransaction(item._id, 'trip');
                                    }}
                                    aria-label="Delete transaction"
                                  >
                                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                                      <path
                                        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                                        fill="currentColor"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="trip-transaction-meta">
                              <span>{item.type === 'income' ? 'Income' : 'Expense'}</span>
                              {item.splitType !== 'none' && (
                                <span>
                                  Split with{' '}
                                  {(item.splitMembers || [])
                                    .map((member) => member.name || member.email || member.userId)
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        </section>
      )}

      {isModalPanel && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-header">
              <div>
                <h3>
                  {activePanel === 'add' && 'Add Transaction'}
                  {activePanel === 'trip' && 'Add Trip'}
                  {activePanel === 'settings' && 'Settings'}
                  {activePanel === 'profile' && 'Edit Profile'}
                  {activePanel === 'currency' && 'Currency'}
                </h3>
                <p>
                  {activePanel === 'add' && 'Keep your dashboard up to date in real time.'}
                  {activePanel === 'trip' && 'Add trip name and date to plan ahead.'}
                  {activePanel === 'settings' && 'Personalize your finance experience.'}
                  {activePanel === 'profile' && 'Update your name and avatar.'}
                  {activePanel === 'currency' && 'Choose your preferred currency.'}
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={closePanel}>
                Close
              </button>
            </div>

            {activePanel === 'add' && (
              <section ref={addSectionRef} id="add-transaction">
                <form className="transaction-form" onSubmit={handleAddTransaction}>
                  <div className="field">
                    <label htmlFor="type">Type</label>
                    <select
                      id="type"
                      value={formState.type}
                      onChange={(event) => handleFormChange('type', event.target.value)}
                      aria-label="Transaction type"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="amount">Amount</label>
                    <input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formState.amount}
                      onChange={(event) => handleFormChange('amount', event.target.value)}
                      placeholder="0.00"
                      aria-label="Transaction amount"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="category">Category</label>
                    <select
                      id="category"
                      value={formState.category}
                      onChange={(event) => handleFormChange('category', event.target.value)}
                      aria-label="Transaction category"
                    >
                      <option value="">Select category</option>
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="date">Date</label>
                    <input
                      id="date"
                      type="date"
                      value={formState.date}
                      onChange={(event) => handleFormChange('date', event.target.value)}
                      aria-label="Transaction date"
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor="note">Note</label>
                    <input
                      id="note"
                      type="text"
                      value={formState.note}
                      onChange={(event) => handleFormChange('note', event.target.value)}
                      placeholder="Optional note"
                      aria-label="Transaction note"
                    />
                  </div>
                  <div className="field full">
                    <label htmlFor="tags">Tags</label>
                    <input
                      id="tags"
                      type="text"
                      value={formState.tags}
                      onChange={(event) => handleFormChange('tags', event.target.value)}
                      placeholder="e.g. groceries, family"
                      aria-label="Transaction tags"
                    />
                  </div>
                  <div className="field full">
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={formState.recurring}
                        onChange={(event) => handleFormChange('recurring', event.target.checked)}
                      />
                      Make this recurring
                    </label>
                  </div>
                  {formState.recurring && (
                    <>
                      <div className="field">
                        <label htmlFor="recurring-frequency">Frequency</label>
                        <select
                          id="recurring-frequency"
                          value={formState.frequency}
                          onChange={(event) => handleFormChange('frequency', event.target.value)}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="recurring-next">Next run</label>
                        <input
                          id="recurring-next"
                          type="date"
                          value={formState.nextRun}
                          onChange={(event) => handleFormChange('nextRun', event.target.value)}
                        />
                      </div>
                    </>
                  )}
                  <div className="quick-actions" role="group" aria-label="Quick add shortcuts">
                    <button
                      type="button"
                      className="chip"
                      onClick={() => applyQuickAdd({ type: 'income', category: 'Salary', amount: '1200' })}
                    >
                      + Salary
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => applyQuickAdd({ type: 'expense', category: 'Food', amount: '25' })}
                    >
                      + Food
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => applyQuickAdd({ type: 'expense', category: 'Transport', amount: '12' })}
                    >
                      + Transport
                    </button>
                  </div>
                  <button className="primary-button" type="submit">
                    Save Transaction
                  </button>
                  {actionError && <p className="form-message error">{actionError}</p>}
                  {actionMessage && <p className="form-message">{actionMessage}</p>}
                </form>
              </section>
            )}

            {activePanel === 'trip' && (
              <section className="trip-form">
                <form className="transaction-form" onSubmit={handleAddTrip}>
                  <div className="field">
                    <label htmlFor="trip-name">Trip name</label>
                    <input
                      id="trip-name"
                      type="text"
                      value={tripDraft.name}
                      onChange={(event) => handleTripDraftChange('name', event.target.value)}
                      placeholder="Goa weekend"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="trip-date">Trip date</label>
                    <input
                      id="trip-date"
                      type="date"
                      value={tripDraft.date}
                      onChange={(event) => handleTripDraftChange('date', event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="trip-budget">Budget (optional)</label>
                    <input
                      id="trip-budget"
                      type="number"
                      step="0.01"
                      value={tripDraft.budget}
                      onChange={(event) => handleTripDraftChange('budget', event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <button className="primary-button" type="submit">
                    Save trip
                  </button>
                  {tripError && <p className="form-message error">{tripError}</p>}
                </form>
              </section>
            )}
            {activePanel === 'settings' && (
              <section className="settings-grid">
                <div className="field">
                  <label htmlFor="settings-locale">Locale</label>
                  <select
                    id="settings-locale"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                  >
                    {LOCALE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.weeklySummary}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          weeklySummary: event.target.checked,
                        }))
                      }
                    />
                    Weekly summary notifications
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.budgetAlerts}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          budgetAlerts: event.target.checked,
                        }))
                      }
                    />
                    Budget alerts
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.showForecast}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          showForecast: event.target.checked,
                        }))
                      }
                    />
                    Show cashflow forecast
                  </label>
                </div>
              </section>
            )}
            {activePanel === 'profile' && (
              <section className="profile-editor">
                <div className="avatar-edit">
                  {profileDraft.avatarUrl ? (
                    <img className="avatar-preview" src={profileDraft.avatarUrl} alt="Profile" />
                  ) : (
                    <div className="avatar-preview">
                      {profileInitials || 'U'}
                    </div>
                  )}
                  <div className="avatar-actions">
                    <label className="ghost-button">
                      Upload image
                      <input type="file" accept="image/*" onChange={handleAvatarChange} />
                    </label>
                    {profileDraft.avatarUrl && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => handleProfileDraftChange('avatarUrl', '')}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="profile-name">Full name</label>
                  <input
                    id="profile-name"
                    type="text"
                    value={profileDraft.name}
                    onChange={(event) => handleProfileDraftChange('name', event.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="profile-actions">
                  <button type="button" className="ghost-button" onClick={resetProfileDraft}>
                    Reset
                  </button>
                  <button type="button" className="primary-button" onClick={saveProfile}>
                    Save profile
                  </button>
                </div>
              </section>
            )}
            {activePanel === 'currency' && (
              <section className="currency-grid">
                {['USD', 'EUR', 'GBP', 'INR', 'BDT', 'JPY', 'AUD'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`currency-tile ${currency === code ? 'active' : ''}`}
                    onClick={() => setCurrency(code)}
                  >
                    {code}
                  </button>
                ))}
              </section>
            )}
          </div>
        </div>
      )}

      {invitePopupOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-header">
              <div>
                <h3>Trip Invitation</h3>
                <p>You have been invited to join a shared trip. Accept to add it to your Trips.</p>
              </div>
            </div>
            <div className="profile-actions">
              <button type="button" className="ghost-button" onClick={handleDeclineTripInvite}>
                Decline
              </button>
              <button type="button" className="primary-button" onClick={handleAcceptTripInvite}>
                Accept Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {transactionDetailOpen && selectedTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-sheet">
            <div className="modal-header">
              <div>
                <h3>Transaction Details</h3>
                <p>Full information for this transaction.</p>
              </div>
              <button type="button" className="ghost-button" onClick={closeTransactionDetails}>
                Close
              </button>
            </div>
            <div className="transaction-detail-grid">
              <div><strong>Category:</strong> {selectedTransaction.category}</div>
              <div>
                <strong>Type:</strong> {selectedTransaction.type === 'income' ? 'Income' : 'Expense'}
              </div>
              <div>
                <strong>Amount:</strong> {currencyFormatter.format(Number(selectedTransaction.amount || 0))}
              </div>
              <div>
                <strong>Date:</strong> {new Date(selectedTransaction.date).toLocaleDateString(locale)}
              </div>
              <div>
                <strong>Paid by:</strong> {resolveTripMemberName(selectedTransaction.paidBy || selectedTransaction.userId)}
              </div>
              <div>
                <strong>Tags:</strong>{' '}
                {(selectedTransaction.tags || []).length > 0
                  ? selectedTransaction.tags.join(', ')
                  : 'No tags'}
              </div>
              <div className="full-row">
                <strong>Note:</strong> {selectedTransaction.note || 'No note'}
              </div>
              <div>
                <strong>Split:</strong>{' '}
                {selectedTransaction.splitType && selectedTransaction.splitType !== 'none'
                  ? selectedTransaction.splitType
                  : 'No split'}
              </div>
              {selectedTransaction.splitType && selectedTransaction.splitType !== 'none' && (
                <div className="full-row">
                  <strong>Split Members:</strong>{' '}
                  {(selectedTransaction.splitMembers || []).length > 0
                    ? selectedTransaction.splitMembers
                        .map((member) => member.name || member.email || member.userId)
                        .join(', ')
                    : 'None'}
                </div>
              )}
            </div>
            <div className="profile-actions">
              <button
                type="button"
                className="ghost-button danger-text"
                onClick={() => handleDeleteTransaction(selectedTransaction._id, selectedTransaction.source)}
              >
                Delete transaction
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav" role="navigation" aria-label="Primary">
        <button
          type="button"
          className={activePanel === 'home' ? 'active' : ''}
          onClick={() => openPanel('home', topRef)}
        >
          Home
        </button>
        <button
          type="button"
          className={activePanel === 'trips' ? 'active' : ''}
          onClick={() => openPanel('trips')}
        >
          Trips
        </button>
        <button
          type="button"
          className="nav-plus"
          onClick={() => openPanel('add', addSectionRef)}
          aria-label="Add transaction"
        >
          +
        </button>
        <button
          type="button"
          className={activePanel === 'history' ? 'active' : ''}
          onClick={() => openPanel('history', historySectionRef)}
        >
          History
        </button>
        <button
          type="button"
          className={activePanel === 'analytics' ? 'active' : ''}
          onClick={() => openPanel('analytics', topRef)}
        >
          Analytics
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;