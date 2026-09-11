import { useCallback, useState } from "react";
import { setToken, useAuthToken } from "@/lib/auth";

interface LoginResponse {
  token: string;
}

export function useAuth() {
  const token = useAuthToken();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  const login = useCallback(
    async (password: string) => {
      setIsLoggingIn(true);
      setError(null);
      try {
        const response = await fetch(`${baseUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        if (!response.ok) {
          throw new Error(response.status === 401 ? "Wrong password." : "Login failed.");
        }

        const data: LoginResponse = await response.json();
        setToken(data.token);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        return false;
      } finally {
        setIsLoggingIn(false);
      }
    },
    [baseUrl]
  );

  const logout = useCallback(() => setToken(null), []);

  return { token, isLoggedIn: !!token, isLoggingIn, error, login, logout };
}
