import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearTokens, getTokens, saveTokens } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      navigate('/login', { replace: true });
    };

    window.addEventListener('fintrack:session-expired', handleExpiredSession);
    return () => window.removeEventListener('fintrack:session-expired', handleExpiredSession);
  }, [navigate]);

  useEffect(() => {
    const { accessToken, refreshToken } = getTokens();
    if (!accessToken && !refreshToken) {
      setIsRestoring(false);
      return;
    }

    apiRequest('/auth/me')
      .then((response) => setUser(response.user))
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsRestoring(false));
  }, []);

  async function authenticate(path, credentials) {
    const response = await apiRequest(path, {
      method: 'POST',
      body: credentials,
      auth: false,
    });
    saveTokens(response);
    setUser(response.user);
    return response.user;
  }

  async function login(credentials) {
    return authenticate('/auth/login', credentials);
  }

  async function register(credentials) {
    return authenticate('/auth/register', credentials);
  }

  function logout() {
    clearTokens();
    setUser(null);
    navigate('/login', { replace: true });
  }

  const value = {
    user,
    isRestoring,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
