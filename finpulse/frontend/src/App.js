import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Dashboard from './Dashboard';
import './App.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000';

const App = () => {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  const isGoogleClientConfigured =
    googleClientId && googleClientId.includes('.apps.googleusercontent.com');
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState('');

  const handleGoogleSignIn = useCallback(async (credentialResponse) => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/google`, {
        idToken: credentialResponse.credential,
      });
      setToken(response.data.token);
      setUser(response.data.user);
      setAuthForm({ name: '', email: '', password: '' });
    } catch (error) {
      const message = error?.response?.data?.message || 'Google sign-in failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const initGoogleAuth = useCallback(() => {
    if (!window.google || !window.google.accounts?.id || !isGoogleClientConfigured) {
      return false;
    }
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleSignIn,
    });
    return true;
  }, [googleClientId, handleGoogleSignIn, isGoogleClientConfigured]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('pf-token');
    if (storedToken) {
      setToken(storedToken);
    }

    const extractInviteToken = () => {
      const params = new URLSearchParams(window.location.search);
      const queryToken = params.get('inviteToken');
      if (queryToken) {
        return queryToken;
      }

      const path = window.location.pathname || '';
      if (path.startsWith('/invite/')) {
        return decodeURIComponent(path.slice('/invite/'.length));
      }
      if (path.startsWith('/inviteToken=')) {
        return decodeURIComponent(path.slice('/inviteToken='.length));
      }
      return '';
    };

    const params = new URLSearchParams(window.location.search);
    const inviteTokenFromUrl = extractInviteToken();
    const storedInviteToken = window.localStorage.getItem('pf-pending-invite') || '';
    if (inviteTokenFromUrl) {
      setPendingInviteToken(inviteTokenFromUrl);
      window.localStorage.setItem('pf-pending-invite', inviteTokenFromUrl);
      params.delete('inviteToken');
      const nextUrl = `${window.location.origin}/`;
      window.history.replaceState({}, '', nextUrl);
    } else if (storedInviteToken) {
      setPendingInviteToken(storedInviteToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      window.localStorage.setItem('pf-token', token);
      axios
        .get(`${API_BASE}/api/auth/me`)
        .then((response) => {
          setUser(response.data.user);
        })
        .catch(() => {
          setUser(null);
          setToken('');
        });
    } else {
      delete axios.defaults.headers.common.Authorization;
      window.localStorage.removeItem('pf-token');
      setUser(null);
    }
  }, [token]);

  const handleAuthChange = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const requestOtp = async () => {
    if (!authForm.email) {
      setAuthError('Email is required.');
      return;
    }
    setAuthError('');
    setOtpLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/request-otp`, {
        email: authForm.email,
      });
      setOtpSent(true);
      if (response.data.otp) {
        setOtpCode(response.data.otp);
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to send OTP.';
      setAuthError(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!authForm.email || !otpCode) {
      setAuthError('Email and code are required.');
      return;
    }
    setAuthError('');
    setAuthLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/api/auth/verify-otp`, {
        email: authForm.email,
        code: otpCode,
        name: authForm.name,
      });
      setToken(response.data.token);
      setUser(response.data.user);
      setOtpCode('');
      setOtpSent(false);
    } catch (error) {
      const message = error?.response?.data?.message || 'OTP verification failed.';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const submitAuth = async (event) => {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const payload = {
        email: authForm.email,
        password: authForm.password,
      };
      if (authMode === 'register') {
        payload.name = authForm.name;
      }
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const response = await axios.post(`${API_BASE}${endpoint}`, payload);
      if (authMode === 'register') {
        setAuthMode('otp');
        setAuthError('');
      } else {
        setToken(response.data.token);
        setUser(response.data.user);
        setAuthForm({ name: '', email: '', password: '' });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        (error?.message === 'Network Error'
          ? 'Backend not reachable. Check server status.'
          : 'Authentication failed.');
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (authMode === 'otp' || !isGoogleClientConfigured) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const renderGoogleButton = () => {
      if (cancelled || !initGoogleAuth()) {
        return false;
      }
      const container = document.getElementById('google-login-button');
      if (!container) {
        return false;
      }
      container.innerHTML = '';
      window.google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: 320,
      });
      return true;
    };

    if (renderGoogleButton()) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      attempts += 1;
      const rendered = renderGoogleButton();
      if (rendered || attempts >= 20) {
        window.clearInterval(intervalId);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authMode, googleClientId, isGoogleClientConfigured, initGoogleAuth]);

  const handleSignOut = () => {
    setToken('');
  };

  const handleInviteTokenConsumed = () => {
    setPendingInviteToken('');
    window.localStorage.removeItem('pf-pending-invite');
  };

  if (!token || !user) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h1>FinPulse</h1>
          <p>
            {authMode === 'register'
              ? 'Create your account'
              : authMode === 'otp'
                ? 'Use OTP to sign in'
                : 'Welcome back'}
          </p>
          <form
            onSubmit={authMode === 'otp' ? verifyOtp : submitAuth}
            className="auth-form"
          >
            {authMode === 'register' && (
              <div className="field">
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  value={authForm.name}
                  onChange={(event) => handleAuthChange('name', event.target.value)}
                  placeholder="Your name"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={authForm.email}
                onChange={(event) => handleAuthChange('email', event.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {authMode !== 'otp' ? (
              <div className="field">
                <label htmlFor="auth-password">Password</label>
                <div className="password-field">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={authForm.password}
                    onChange={(event) => handleAuthChange('password', event.target.value)}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="auth-otp">OTP code</label>
                <input
                  id="auth-otp"
                  type="text"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder="6-digit code"
                />
              </div>
            )}
            {authError && <p className="form-message error">{authError}</p>}
            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading
                ? 'Please wait...'
                : authMode === 'register'
                  ? 'Create account'
                  : authMode === 'otp'
                    ? 'Verify OTP'
                    : 'Sign in'}
            </button>
          </form>
          {authMode === 'otp' ? (
            <button
              type="button"
              className="ghost-button"
              onClick={requestOtp}
              disabled={otpLoading}
            >
              {otpLoading ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
            </button>
          ) : null}
          <div className="auth-actions">
            {authMode !== 'otp' && (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}
                >
                  {authMode === 'login' ? 'Need an account? Register' : 'Have an account? Sign in'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAuthMode('otp')}
                >
                  Use OTP
                </button>
              </>
            )}
            {authMode === 'otp' && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAuthMode('login')}
              >
                Back to password login
              </button>
            )}
          </div>
          {authMode !== 'otp' && (
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>Or</p>
              {isGoogleClientConfigured ? (
                <div
                  id="google-login-button"
                  style={{ display: 'flex', justifyContent: 'center' }}
                ></div>
              ) : (
                <p className="form-message error">
                  Google sign-in not configured. Set REACT_APP_GOOGLE_CLIENT_ID.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <Dashboard
        user={user}
        onSignOut={handleSignOut}
        pendingInviteToken={pendingInviteToken}
        onInviteTokenConsumed={handleInviteTokenConsumed}
      />
    </div>
  );
};

export default App;