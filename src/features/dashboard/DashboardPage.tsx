import React from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { LockStatusHero } from './LockStatusHero';
import { QuickStats } from './QuickStats';
import { RecentActivity } from './RecentActivity';
import { useLogs } from '../../hooks/useLogs';
import { useUsers } from '../../hooks/useUsers';

export const DashboardPage: React.FC = () => {
  const { todayStats } = useLogs();
  const { users } = useUsers();

  const activeUsersCount = users.filter((u) => u.status !== 'disabled').length;

  return (
    <div className="space-y-6">
      <QuickStats
        doorOpensOnline={todayStats.doorOpensOnline}
        doorOpensOffline={todayStats.doorOpensOffline}
        alertsOnline={todayStats.alertsOnline}
        alertsOffline={todayStats.alertsOffline}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Hero Lock Controller (5 cols on Desktop) */}
        <div className="lg:col-span-5 animate-stagger-2">
          <LockStatusHero />
        </div>

        {/* Right Column: Recent Activity & Quick Navigation (7 cols on Desktop) */}
        <div className="lg:col-span-7 space-y-6 animate-stagger-3">
          <RecentActivity />

          {/* Member Quick Access Card */}
          <div className="card-glass card-glass-interactive flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary border border-primary/20 shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-on-surface">
                  Thành viên đang mở quyền
                </h3>
                <p className="text-xs text-on-surface-variant truncate">
                  {activeUsersCount} người dùng có quyền mở cửa bằng mã PIN hoặc thẻ RFID
                </p>
              </div>
            </div>

            <Link
              to="/users"
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-surface-container-high px-4 py-2 text-xs font-bold text-on-surface hover:bg-primary-container hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
            >
              <span>Quản lý</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
