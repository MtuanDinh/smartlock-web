import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ThemeToggle } from '../../components/layout/ThemeToggle';

export const LoginPage: React.FC = () => {
  const { user, authReady, isSubmitting, loginError, clearLoginError, signIn } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (authReady && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email, password);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-bg-primary px-4 py-6 text-text-primary">
      <div className="mx-auto flex w-full max-w-5xl justify-end">
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md my-auto py-8">
        <Card className="p-6 sm:p-8 shadow-xl border-border-strong">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-500 border border-blue-500/30 shadow-inner">
              <ShieldCheck className="h-9 w-9" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-text-primary">
              ĐĂNG NHẬP HỆ THỐNG
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              Bảng điều khiển quản trị ổ khóa thông minh Smart Lock IoT
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary"
              >
                Email quản trị
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (loginError) clearLoginError();
                  }}
                  placeholder="admin@example.com"
                  className="min-h-[46px] w-full rounded-xl border border-border-strong bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-secondary"
              >
                Mật khẩu bảo mật
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) clearLoginError();
                  }}
                  placeholder="••••••••"
                  className="min-h-[46px] w-full rounded-xl border border-border-strong bg-bg-elevated pl-10 pr-12 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs font-medium text-rose-600 dark:text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
              >
                Vào Hệ Thống
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <footer className="text-center text-xs text-text-muted">
        Smart Lock IoT Dashboard &bull; Kết nối bảo mật qua Firebase RTDB
      </footer>
    </div>
  );
};
