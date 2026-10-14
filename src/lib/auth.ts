import { useSyncExternalStore } from "react";

const TOKEN_KEY = "pg_token";

let token: string | null = localStorage.getItem(TOKEN_KEY);
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getToken() {
  return token;
}

export function setToken(next: string | null) {
  token = next;
  if (next) {
    localStorage.setItem(TOKEN_KEY, next);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  emit();
}

export function useAuthToken() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => token
  );
}

// Reads the "role" claim from the JWT payload. Only used to decide what UI to show;
// the API checks the role itself.
export function isAdminToken(value: string | null) {
  if (!value) return false;
  try {
    const payload = JSON.parse(atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const roles: unknown = payload.role;
    return roles === "admin" || (Array.isArray(roles) && roles.includes("admin"));
  } catch {
    return false;
  }
}

export async function authFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    setToken(null);
  }

  return response;
}
