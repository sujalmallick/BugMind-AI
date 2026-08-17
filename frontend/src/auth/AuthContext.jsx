import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  login as loginService,
  register as registerService,
  getCurrentUser,
  logout as logoutService,
  getToken,
} from "./authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    const token = getToken();

    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const currentUser =
        await getCurrentUser();

      setUser(currentUser);
    } catch (error) {
      logoutService();
      setUser(null);
    }

    setLoading(false);
  }

  async function login(
    email,
    password
  ) {
    await loginService(
      email,
      password
    );

    const currentUser =
      await getCurrentUser();

    setUser(currentUser);
  }

  async function register(data) {
    await registerService(data);

    await login(
      data.email,
      data.password
    );
  }

  function logout() {
    logoutService();
    setUser(null);
  }

  async function refreshUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      // silently fail — user stays as-is
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        authenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}