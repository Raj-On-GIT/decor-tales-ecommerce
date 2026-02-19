const API_BASE = 'http://127.0.0.1:8000';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Check if we're in a browser environment
 * Prevents errors during SSR
 */

const isBrowser = typeof window !== 'undefined';

// ============================================================================
// API FUNCTIONS (signup, login, refreshToken API calls)
// ============================================================================

export async function signup(userData) {
  const response = await fetch(`${API_BASE}/api/auth/signup/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(userData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw error;
  }
  
  return response.json();
}

export async function login(credentials) {
  const response = await fetch(`${API_BASE}/api/auth/login/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(credentials)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw error;
  }
  
  return response.json();
}

// ============================================================================
// TOKEN MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Save access and refresh tokens to localStorage
 * 
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
export function setTokens(accessToken, refreshToken) {
  if (!isBrowser) return;
  
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

/**
 * Get access token from localStorage
 * 
 * @returns {string|null} Access token or null if not found
 */
export function getAccessToken() {
  if (!isBrowser) return null;
  
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}

/**
 * Get refresh token from localStorage
 * 
 * @returns {string|null} Refresh token or null if not found
 */
export function getRefreshToken() {
  if (!isBrowser) return null;
  
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
}

/**
 * Clear all tokens from localStorage
 * Call this on logout
 */
export function clearTokens() {
  if (!isBrowser) return;
  
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

/**
 * Check if user has valid tokens
 * Note: This only checks if tokens exist, not if they're expired
 * 
 * @returns {boolean} True if tokens exist
 */
export function hasTokens() {
  return !!(getAccessToken() && getRefreshToken());
}

// ============================================================================
// JWT DECODING FUNCTIONS
// ============================================================================

/**
 * Decode JWT token payload (client-side only)
 * 
 * WARNING: This does NOT verify the token signature.
 * Only use for reading payload data, not for security decisions.
 * Server must always verify tokens.
 * 
 * @param {string} token - JWT token to decode
 * @returns {object|null} Decoded payload or null if invalid
 */
function decodeJWT(token) {
  if (!token) return null;
  
  try {
    // Split token into parts
    const parts = token.split('.');
    
    // JWT must have 3 parts
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    // Decode the payload (middle part)
    const payload = parts[1];
    
    // Base64 decode
    const decoded = atob(payload);
    
    // Parse JSON
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Get current user from access token
 * 
 * Extracts user information from JWT payload.
 * Returns null if token is invalid or doesn't exist.
 * 
 * @returns {object|null} User object with id and other claims
 */
export function getCurrentUser() {
  const token = getAccessToken();
  if (!token) return null;
  
  const payload = decodeJWT(token);
  if (!payload) return null;
  
  // Check if token is expired
  if (isTokenExpired(payload)) {
    console.warn('Access token is expired');
    return null;
  }
  
  return payload;
}

/**
 * Check if JWT token is expired
 * 
 * @param {object} payload - Decoded JWT payload
 * @returns {boolean} True if token is expired
 */
export function isTokenExpired(payload) {
  if (!payload || !payload.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Date.now() / 1000;
  
  return payload.exp < currentTime;
}

/**
 * Check if access token needs refresh soon
 * Returns true if token expires in less than 5 minutes
 * 
 * @returns {boolean} True if token should be refreshed
 */
export function shouldRefreshToken() {
  const user = getCurrentUser();
  if (!user || !user.exp) return false;
  
  const currentTime = Date.now() / 1000;
  const timeUntilExpiry = user.exp - currentTime;
  
  // Refresh if less than 5 minutes remaining
  const REFRESH_THRESHOLD = 5 * 60; // 5 minutes in seconds
  
  return timeUntilExpiry < REFRESH_THRESHOLD;
}

// ============================================================================
// TOKEN REFRESH FUNCTION
// ============================================================================

/**
 * Refresh access token using refresh token
 * 
 * Calls the backend /api/auth/token/refresh/ endpoint
 * Saves new tokens if successful
 * 
 * @returns {boolean} True if refresh successful, false otherwise
 */
export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    console.error('No refresh token available');
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh: refreshToken,
      }),
    });
    
    if (!response.ok) {
      console.error('Token refresh failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    
    // Save new tokens (rotation enabled, so both are new)
    setTokens(data.access, data.refresh);
    
    return true;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
}

// ============================================================================
// AUTHENTICATED FETCH WRAPPER
// ============================================================================

/**
 * Fetch with automatic JWT authentication
 * 
 * Adds Authorization header automatically
 * Handles token refresh on 401 errors
 * Retries request after refresh
 * 
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithAuth(url, options = {}) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('No access token available. Please login.');
  }
  
  // Add Authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  
  // Make request
  let response = await fetch(url, {
    ...options,
    headers,
  });
  
  // If 401 Unauthorized, try to refresh token
  if (response.status === 401) {
    console.log('Access token expired, attempting refresh...');
    
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      // Retry with new token
      const newToken = getAccessToken();
      headers.Authorization = `Bearer ${newToken}`;
      
      response = await fetch(url, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed, user needs to login
      throw new Error('Session expired. Please login again.');
    }
  }
  
  return response;
}

