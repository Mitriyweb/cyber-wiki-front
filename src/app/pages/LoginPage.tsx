/**
 * Login Page
 *
 * Standalone login page rendered outside the main app layout.
 * Uses real backend authentication via AccountsApiService.
 * Based on cyber-wiki-front-old LoginPage pattern.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { eventBus } from '@cyberfabric/react';
import { loginAction } from '@/app/actions/bootstrapActions';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const onSuccess = () => {
      setIsLoading(false);
    };

    const onError = ({ error }: { error: string }) => {
      setIsLoading(false);
      setServerError(error);
    };

    const subSuccess = eventBus.on('app/auth/login/success', onSuccess);
    const subError = eventBus.on('app/auth/login/error', onError);

    return () => {
      subSuccess.unsubscribe();
      subError.unsubscribe();
    };
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setServerError('');

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername) {
      setValidationError('Username is required');
      return;
    }
    if (!trimmedPassword) {
      setValidationError('Password is required');
      return;
    }

    setIsLoading(true);
    loginAction({ username: trimmedUsername, password: trimmedPassword });
  };

  const displayError = validationError || serverError;

  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-4">
        <div className="bg-card border border-border rounded-lg shadow-lg p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4 bg-primary">
              <span className="text-2xl font-bold text-white">CW</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              <span className="text-primary">Cyber</span>
              <span>Wiki</span>
            </h1>
            <p className="text-muted-foreground mt-2">Sign in to your account</p>
          </div>

          {/* Error Alert */}
          {displayError && (
            <div className="mb-4 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-destructive text-sm">
              {displayError}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2.5 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-md font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/90"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Default credentials: admin / admin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
