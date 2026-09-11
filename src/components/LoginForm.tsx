import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login, isLoggingIn, error } = useAuth();
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    const success = await login(password);
    if (success) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3">
      <Input
        type="password"
        autoFocus
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={isLoggingIn || !password} className="w-full">
        {isLoggingIn ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}

export default LoginForm;
