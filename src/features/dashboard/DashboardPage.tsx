import React from 'react';
import { LockStatusHero } from './LockStatusHero';
import { QuickStats } from './QuickStats';
import { RecentActivity } from './RecentActivity';
import { useLogs } from '../../hooks/useLogs';

export const DashboardPage: React.FC = () => {
  const { todayStats } = useLogs();

  return (
    <div className="space-y-6">
      <QuickStats
        doorOpensOnline={todayStats.doorOpensOnline}
        doorOpensOffline={todayStats.doorOpensOffline}
        alertsOnline={todayStats.alertsOnline}
        alertsOffline={todayStats.alertsOffline}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <LockStatusHero />
        </div>
        <div className="lg:col-span-6">
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};
