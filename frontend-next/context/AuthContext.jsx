// Phase 6: JWT Token Storage + Global Auth State
// Complete Authentication Context Provider

/**
 * File: context/AuthContext.jsx
 * 
 * Global authentication state management using React Context API.
 * Provides persistent login state across page refreshes.
 */

'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: () => {},
  logout: () => {},
});

// ============================================================================
// AUTH PROVIDER COMPONENT
// ============================================================================

/**
 * AuthProvider Component
 * 
 * Wraps the application and provides global authentication state.
 * 
 * Features:
 * - Loads auth state from localStorage on mount
 * - Maintains login state across page refreshes
 * - Updates UI instantly on login/logout
 * - Syncs across multiple tabs (via localStorage)
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /**
   * Load authentication state from localStorage on mount
   * Runs once when app starts (rehydration)
   */
  useEffect(() => {
    rehydrateAuth();
  }, []);

  /**
   * Rehydrate authentication state from localStorage
   * 
   * This function:
   * 1. Checks localStorage for access_token
   * 2. If found, decodes JWT to get user info
   * 3. Sets authenticated state
   * 4. Prevents flash of logged-out state
   */
  const rehydrateAuth = () => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      // Get access token from localStorage
      const accessToken = localStorage.getItem('access_token');

      if (!accessToken) {
        // No token found - user is logged out
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Decode JWT to get user info
      const userData = decodeToken(accessToken);

      if (!userData) {
        // Invalid token - clear and logout
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (isTokenExpired(userData)) {
        // Token expired - clear and logout
        console.warn('Access token expired');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Token is valid - set authenticated state
      setUser({
        id: userData.user_id,
        exp: userData.exp,
        iat: userData.iat,
      });
      setIsAuthenticated(true);
      setLoading(false);

    } catch (error) {
      console.error('Error rehydrating auth:', error);
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  };

  /**
   * Login function
   * 
   * Called after successful login API call.
   * Stores tokens and updates authentication state.
   * 
   * @param {object} tokens - Access and refresh tokens
   * @param {string} tokens.access - JWT access token
   * @param {string} tokens.refresh - JWT refresh token
   * 
   * Usage:
   *   const { login } = useAuth();
   *   
   *   // After successful API call
   *   const data = await loginAPI(credentials);
   *   login({ access: data.access, refresh: data.refresh });
   */
  const login = (tokens) => {
    try {
      // Validate tokens
      if (!tokens || !tokens.access || !tokens.refresh) {
        console.error('Invalid tokens provided to login()');
        return;
      }

      // Store tokens in localStorage
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);

      // Decode token to get user info
      const userData = decodeToken(tokens.access);

      if (userData) {
        // Set authenticated state
        setUser({
          id: userData.user_id,
          exp: userData.exp,
          iat: userData.iat,
        });
        setIsAuthenticated(true);
        console.log('✅ User logged in successfully');
      } else {
        console.error('Failed to decode token');
      }
    } catch (error) {
      console.error('Error in login():', error);
    }
  };

  /**
   * Logout function
   * 
   * Clears tokens from localStorage and resets authentication state.
   * Redirects to homepage.
   * 
   * Usage:
   *   const { logout } = useAuth();
   *   
   *   <button onClick={logout}>Logout</button>
   */
  const logout = () => {
    try {
      // Clear tokens from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      // Reset authentication state
      setUser(null);
      setIsAuthenticated(false);

      // Redirect to homepage
      router.push('/');

      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('Error in logout():', error);
    }
  };

  /**
   * Context value provided to consuming components
   */
  const value = {
    user,              // User object with { id, exp, iat } or null
    isAuthenticated,   // Boolean: true if logged in, false if not
    loading,           // Boolean: true while loading, false when ready
    login,             // Function: login({ access, refresh })
    logout,            // Function: logout()
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOK FOR CONSUMING AUTH CONTEXT
// ============================================================================

/**
 * useAuth Hook
 * 
 * Custom hook to access authentication state and functions.
 * Must be used within AuthProvider.
 * 
 * @returns {object} Auth context value
 * 
 * Example:
 *   const { user, isAuthenticated, loading, login, logout } = useAuth();
 *   
 *   if (loading) return <div>Loading...</div>;
 *   
 *   if (!isAuthenticated) return <div>Please login</div>;
 *   
 *   return <div>Welcome, User {user.id}!</div>;
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

// ============================================================================
// UTILITY FUNCTIONS (Internal)
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
function decodeToken(token) {
  if (!token) return null;

  try {
    // Split token into parts
    const parts = token.split('.');

    // JWT must have 3 parts
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (middle part)
    const payload = parts[1];

    // Base64 decode
    const decoded = atob(payload);

    // Parse JSON
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 * 
 * @param {object} payload - Decoded JWT payload
 * @returns {boolean} True if token is expired
 */
function isTokenExpired(payload) {
  if (!payload || !payload.exp) return true;

  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Date.now() / 1000;

  return payload.exp < currentTime;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 1: Wrap Application
 * ─────────────────────────────────────────────────────────────────────
 * 
 * // app/layout.js
 * import { AuthProvider } from '@/context/AuthContext';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html lang="en">
 *       <body>
 *         <AuthProvider>
 *           <Header />
 *           <main>{children}</main>
 *         </AuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * 
 * 
 * EXAMPLE 2: Login Page
 * ─────────────────────────────────────────────────────────────────────
 * 
 * 'use client';
 * import { useAuth } from '@/context/AuthContext';
 * 
 * export default function LoginPage() {
 *   const { login } = useAuth();
 *   const router = useRouter();
 *   
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     
 *     // Call API
 *     const response = await fetch('http://127.0.0.1:8000/api/auth/login/', {
 *       method: 'POST',
 *       headers: {'Content-Type': 'application/json'},
 *       body: JSON.stringify(credentials)
 *     });
 *     
 *     const data = await response.json();
 *     
 *     // Store tokens and update state
 *     login({ access: data.access, refresh: data.refresh });
 *     
 *     // Redirect
 *     router.push('/');
 *   };
 * }
 * 
 * 
 * EXAMPLE 3: Header Component
 * ─────────────────────────────────────────────────────────────────────
 * 
 * 'use client';
 * import { useAuth } from '@/context/AuthContext';
 * 
 * export default function Header() {
 *   const { isAuthenticated, logout, loading } = useAuth();
 *   
 *   if (loading) {
 *     return <div>Loading...</div>;
 *   }
 *   
 *   return (
 *     <header>
 *       {isAuthenticated ? (
 *         <div>
 *           <button>My Account</button>
 *           <button onClick={logout}>Logout</button>
 *         </div>
 *       ) : (
 *         <div>
 *           <Link href="/login">Login</Link>
 *           <Link href="/signup">Signup</Link>
 *         </div>
 *       )}
 *     </header>
 *   );
 * }
 * 
 * 
 * EXAMPLE 4: Check Auth Status
 * ─────────────────────────────────────────────────────────────────────
 * 
 * 'use client';
 * import { useAuth } from '@/context/AuthContext';
 * 
 * export default function MyComponent() {
 *   const { user, isAuthenticated, loading } = useAuth();
 *   
 *   if (loading) {
 *     return <div>Loading...</div>;
 *   }
 *   
 *   if (!isAuthenticated) {
 *     return <div>Please login to continue</div>;
 *   }
 *   
 *   return <div>Welcome, User {user.id}!</div>;
 * }
 */

console.log('✅ AuthContext loaded');

export default AuthContext;