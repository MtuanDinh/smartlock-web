import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
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
    <div className="relative min-h-screen flex flex-col justify-between bg-surface px-4 py-6 sm:px-6 text-on-surface overflow-x-clip">
      {/* Top Ambient Glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 overflow-hidden opacity-40 dark:opacity-75"
        aria-hidden="true"
      >
        <div className="mx-auto h-full max-w-7xl bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(37,99,235,0.22),transparent)]" />
      </div>

      {/* Top Bar with Theme Toggle */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-white shadow-sm shadow-blue-500/30">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="font-extrabold tracking-tight text-sm text-on-surface">
            SMART LOCK <span className="text-[10px] font-semibold text-outline">IoT</span>
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Dual Card */}
      <div className="relative z-10 mx-auto w-full max-w-[1020px] my-auto py-6 animate-page-enter">
        <div className="card-glass grid grid-cols-1 lg:grid-cols-12 rounded-2xl shadow-2xl overflow-hidden">
          {/* Left Column: IoT Security Brand Visual (Static, honest - Hidden on Mobile) */}
          <div className="hidden lg:flex lg:col-span-5 bg-surface-container-low/70 dark:bg-surface-container/50 p-6 sm:p-8 flex-col justify-between border-r border-outline-variant/30">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-fixed/40 px-3 py-1 text-xs font-bold text-primary dark:text-primary mb-6">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Bảo mật Truy cập IoT</span>
              </div>

              <h2 className="text-2xl font-extrabold tracking-tight text-on-surface">
                Hệ Thống Quản Trị Khóa Thông Minh
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                Giám sát nhịp tim phần cứng, điều khiển mở khóa từ xa và đồng bộ dữ liệu thời gian thực.
              </p>

              {/* Decorative Lock Ring Visual */}
              <div className="my-8 relative flex items-center justify-center">
                <div
                  className="absolute h-40 w-40 rounded-full bg-primary/20 animate-lock-aura pointer-events-none blur-xl"
                  aria-hidden="true"
                />
                <div
                  className="absolute h-40 w-40 rounded-full border-2 border-primary/35 bg-primary/5 animate-lock-sonar pointer-events-none"
                  aria-hidden="true"
                />
                <div
                  className="absolute h-40 w-40 rounded-full border border-primary/30 bg-primary/5 animate-lock-sonar-delayed pointer-events-none"
                  aria-hidden="true"
                />
                <div className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 shadow-xl shadow-blue-500/15 animate-lock-breathe">
                  <div className="flex h-30 w-30 h-[116px] w-[116px] items-center justify-center rounded-full bg-white/85 dark:bg-slate-900/85 border border-white/90 dark:border-white/10 shadow-md backdrop-blur-md animate-lock-breathe-middle">
                    <div className="flex h-22 w-22 h-[88px] w-[88px] flex-col items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 via-primary to-sky-400 text-white shadow-lg shadow-blue-500/30 ring-1 ring-white/30 transition-transform duration-500 hover:scale-105 animate-lock-breathe-core">
                      <Lock className="h-8 w-8 text-white drop-shadow-sm" />
                      <span className="mt-1 text-[9px] font-extrabold uppercase tracking-normal leading-none text-white/95">
                        Bảo mật
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Real Hardware Bullets */}
              <ul className="space-y-3 text-xs text-on-surface-variant">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    ✓
                  </span>
                  <span>Điều khiển đóng mở từ xa qua Firebase Realtime Database.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    ✓
                  </span>
                  <span>Mở khóa bảo mật bằng mã PIN, thẻ RFID MIFARE hoặc nút bấm cứng.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                    ✓
                  </span>
                  <span>Nhật ký ghi trực tiếp tại chỗ khi mất Wi-Fi và tự động đồng bộ khi có mạng.</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-outline-variant/30 text-[11px] text-outline flex items-center justify-between">
              <span>Wemos D1 Mini + Arduino Uno</span>
              <span className="font-mono">v3.0 IoT</span>
            </div>
          </div>

          {/* Right Column: Authentication Form */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-on-surface">
                ĐĂNG NHẬP HỆ THỐNG
              </h1>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                Vui lòng nhập tài khoản quản trị viên được phân quyền để truy cập
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  Email quản trị
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
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
                    placeholder="admin@smartlock.local"
                    className="min-h-[46px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-low pl-10 pr-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  Mật khẩu bảo mật
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
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
                    className="min-h-[46px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-low pl-10 pr-12 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-outline hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors"
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
                  className="flex items-start gap-2.5 rounded-xl border border-error/40 bg-error-container/20 p-3 text-xs font-medium text-error dark:text-red-300"
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
                  className="h-12 font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  ĐĂNG NHẬP VÀO HỆ THỐNG
                </Button>
              </div>

              <div className="text-center text-[11px] text-outline pt-2">
                Mã hóa đường truyền an toàn TLS · Xác thực qua Firebase Auth
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-outline py-2">
        © Smart Lock IoT · Nền tảng Giám sát & Quản trị Truy cập
      </footer>
    </div>
  );
};
