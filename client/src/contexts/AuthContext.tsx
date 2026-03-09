import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  fullName: string;
  plan?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signOut: () => void;
  setAuth: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  signOut: () => { },
  setAuth: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check for existing token and validate it
  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    if (savedToken) {
      setToken(savedToken);
      // Validate token by fetching user info
      api
        .get<{ user: User }>("/api/auth/me")
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          // Token is invalid/expired — clear it
          localStorage.removeItem("auth_token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const setAuth = (newToken: string, newUser: User) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signOut, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
