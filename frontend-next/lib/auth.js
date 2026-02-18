const API_BASE = 'http://127.0.0.1:8000';

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

export async function refreshToken(refreshToken) {
  const response = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({refresh: refreshToken})
  });
  
  if (!response.ok) {
    // Refresh failed, need to login again
    return null;
  }
  
  return response.json();
}

export function getAccessToken() {
  return localStorage.getItem('access_token');
}

export function setTokens(access, refresh) {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}
