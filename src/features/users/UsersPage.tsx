import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  KeyRound,
  CreditCard,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Radio,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { UserFormModal } from './UserFormModal';
import { PinModal } from './PinModal';
import { LearnCardModal } from './LearnCardModal';
import { Button } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Switch';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { User } from '../../types';

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

type UserFilterTab = 'all' | 'active' | 'has_card' | 'disabled';

export const UsersPage: React.FC = () => {
  const {
    users,
    isLoading,
    existingPasswords,
    pendingUserId,
    isSubmittingModal,
    learnCardState,
    addUser,
    editUserName,
    changeUserPin,
    toggleUserStatus,
    deleteUser,
    startLearnCard,
    cancelLearnCard,
  } = useUsers();

  const { connectionState, isClientConnected, hasUnsyncedChanges } = useSystemStatus();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<UserFilterTab>('all');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});
  const [userModalState, setUserModalState] = useState<{
    open: boolean;
    mode: 'add' | 'editName';
    user: User | null;
  }>({ open: false, mode: 'add', user: null });

  const [pinModalUser, setPinModalUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  const toggleRevealPin = (userId: string) => {
    setRevealedPins((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const openAddModal = () => {
    setUserModalState({ open: true, mode: 'add', user: null });
  };

  const openEditNameModal = (user: User) => {
    setUserModalState({ open: true, mode: 'editName', user });
  };

  const clientOfflineTooltip = !isClientConnected
    ? 'Điện thoại/trình duyệt đang mất kết nối Internet.'
    : undefined;

  const getEditDisabledTooltip = (user: User): string | undefined => {
    if (!isClientConnected) {
      return 'Điện thoại/trình duyệt đang mất kết nối Internet.';
    }
    if (user.status === 'disabled') {
      return 'Mở khóa thành viên trước khi chỉnh sửa.';
    }
    return undefined;
  };

  const getCardDisabledTooltip = (user: User): string | undefined => {
    if (!isClientConnected) {
      return 'Điện thoại/trình duyệt đang mất kết nối Internet.';
    }
    if (user.status === 'disabled') {
      return 'Mở khóa thành viên trước khi cấp hoặc đổi thẻ.';
    }
    if (connectionState !== 'online') {
      return 'Ổ khóa đang mất kết nối! Không thể thêm thẻ từ vào lúc này.';
    }
    return undefined;
  };

  // KPIs
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.status !== 'disabled').length;
  const cardsCount = users.filter((u) => Boolean(u.card)).length;

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.card && user.card.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchSearch) return false;

      if (activeTab === 'active') return user.status !== 'disabled';
      if (activeTab === 'has_card') return Boolean(user.card);
      if (activeTab === 'disabled') return user.status === 'disabled';
      return true;
    });
  }, [users, searchTerm, activeTab]);

  return (
    <div className="space-y-6">
      {/* 1. 3 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* KPI 1: Tổng thành viên */}
        <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-fixed/40 text-primary border border-primary/20 shadow-sm">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Tổng thành viên
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-on-surface">
              {totalCount}
            </p>
            <p className="text-[11px] font-medium text-secondary dark:text-emerald-400 truncate">
              {activeCount} đang mở quyền truy cập
            </p>
          </div>
        </div>

        {/* KPI 2: Thẻ RFID đã gán */}
        <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed/50 text-tertiary border border-tertiary/20 shadow-sm">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Thẻ RFID đã gán
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-on-surface">
              {cardsCount} <span className="text-sm font-semibold text-outline">/ {totalCount}</span>
            </p>
            <p className="text-[11px] text-outline truncate">
              Chuẩn mã hóa MIFARE 13.56 MHz
            </p>
          </div>
        </div>

        {/* KPI 3: Trạng thái đồng bộ */}
        <div className="flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
              hasUnsyncedChanges
                ? 'bg-warning-container/40 text-warning border-warning/30'
                : 'bg-secondary-container/30 text-secondary dark:text-emerald-400 border-secondary/20'
            }`}
          >
            {hasUnsyncedChanges ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-outline">
              Trạng thái đồng bộ
            </p>
            <p
              className={`text-base font-extrabold tracking-tight truncate ${
                hasUnsyncedChanges ? 'text-warning' : 'text-secondary dark:text-emerald-400'
              }`}
            >
              {hasUnsyncedChanges ? 'Chưa đồng bộ' : 'Đã đồng bộ'}
            </p>
            <p className="text-[11px] text-outline truncate">
              Đồng bộ tức thời qua Firebase RTDB
            </p>
          </div>
        </div>
      </div>

      {/* 2. Khung Quản lý Thành viên */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm overflow-hidden">
        {/* Top Header of Card */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 p-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-white shadow-sm shadow-blue-500/25">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-on-surface">
                Quản lý Thành viên &amp; Phân quyền
              </h1>
              <p className="text-xs text-on-surface-variant">
                Cấp mã PIN số và đăng ký thẻ từ RFID không chạm cho từng người dùng
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={!isClientConnected}
            disabledTooltip={clientOfflineTooltip}
            onClick={openAddModal}
            className="rounded-xl shadow-sm shadow-blue-500/20 font-bold"
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Thêm thành viên
          </Button>
        </div>

        {/* Search Bar & 4 Filter Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-outline-variant/20 bg-surface-container-low/40 px-5 py-3.5 sm:px-6">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên hoặc UID thẻ..."
              className="min-h-[38px] w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest pl-9 pr-3 py-1.5 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* 4 Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('active')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === 'active'
                  ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Đang mở quyền ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('has_card')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === 'has_card'
                  ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Đã gán thẻ ({cardsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('disabled')}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === 'disabled'
                  ? 'bg-primary-container text-white shadow-sm shadow-blue-500/20'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              Đang tạm khóa ({totalCount - activeCount})
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={<Users className="h-10 w-10 text-outline" />}
              title="Không tìm thấy thành viên phù hợp"
              description="Thử thay đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác."
              action={
                searchTerm || activeTab !== 'all' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setActiveTab('all');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={!isClientConnected}
                    disabledTooltip={clientOfflineTooltip}
                    onClick={openAddModal}
                    leftIcon={<UserPlus className="h-4 w-4" />}
                  >
                    Thêm thành viên đầu tiên
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile View (< 768px): Card List */}
            <div className="divide-y divide-outline-variant/20 md:hidden">
              {filteredUsers.map((user) => {
                const isDisabled = user.status === 'disabled';
                const isRowPending = pendingUserId === user.id;
                const isPinVisible = Boolean(revealedPins[user.id]);
                const editTooltip = getEditDisabledTooltip(user);
                const cardTooltip = getCardDisabledTooltip(user);
                const canEdit = isClientConnected && !isDisabled && !isRowPending;
                const canLearnCard = canEdit && connectionState === 'online';

                return (
                  <div
                    key={user.id}
                    className={`p-4 transition-all ${
                      isDisabled ? 'opacity-60 bg-surface-container-low/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm border shadow-sm ${
                            isDisabled
                              ? 'bg-surface-container-high text-outline border-outline-variant/40'
                              : 'bg-primary-fixed text-primary border-primary/20'
                          }`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-on-surface truncate">
                              {user.name}
                            </span>
                            <button
                              type="button"
                              aria-label={`Đổi tên ${user.name}`}
                              disabled={!canEdit}
                              onClick={() => openEditNameModal(user)}
                              className="p-1 text-outline hover:text-primary transition-colors disabled:opacity-40"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isDisabled
                                  ? 'bg-surface-container-high text-outline'
                                  : 'bg-secondary-container/40 text-secondary dark:text-emerald-400'
                              }`}
                            >
                              {isDisabled ? 'Đã khóa quyền' : 'Đang mở quyền'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!isDisabled}
                          onCheckedChange={() => void toggleUserStatus(user)}
                          disabled={!isClientConnected || isRowPending}
                          disabledTooltip={clientOfflineTooltip}
                          ariaLabel={`Bật hoặc tắt quyền của ${user.name}`}
                        />
                        <button
                          type="button"
                          aria-label={`Xóa thành viên ${user.name}`}
                          disabled={!isClientConnected || isRowPending}
                          onClick={() => setDeleteConfirmUser(user)}
                          className="p-1.5 text-outline hover:text-error transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Detail Box: PIN & RFID */}
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-low/60 p-3">
                      {/* PIN Box */}
                      <div className="flex flex-col justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                          Mã PIN
                        </span>
                        {user.pass ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-mono text-xs font-bold text-error">
                              {isPinVisible ? user.pass : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPin(user.id)}
                              aria-label={isPinVisible ? 'Ẩn PIN' : 'Hiện PIN'}
                              className="p-1 text-outline hover:text-on-surface"
                            >
                              {isPinVisible ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              aria-label="Đổi PIN"
                              disabled={!canEdit}
                              onClick={() => setPinModalUser(user)}
                              className="p-1 text-outline hover:text-primary disabled:opacity-40"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canEdit}
                            disabledTooltip={editTooltip}
                            onClick={() => setPinModalUser(user)}
                            className="text-[11px] py-1"
                          >
                            + Cấp PIN
                          </Button>
                        )}
                      </div>

                      {/* RFID Box */}
                      <div className="flex flex-col justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                          Thẻ RFID
                        </span>
                        {user.card ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded-full">
                              {user.card}
                            </span>
                            <button
                              type="button"
                              aria-label="Đổi thẻ"
                              disabled={!canLearnCard}
                              onClick={() => void startLearnCard(user)}
                              className="p-1 text-outline hover:text-tertiary disabled:opacity-40"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canLearnCard}
                            disabledTooltip={cardTooltip}
                            onClick={() => void startLearnCard(user)}
                            className="text-[11px] py-1"
                          >
                            + Học thẻ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View (>= 768px): Data Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 bg-surface-container-low/60 text-xs font-bold uppercase tracking-wider text-outline">
                    <th className="py-3.5 pl-6 pr-4">Thành Viên</th>
                    <th className="px-4 py-3.5 text-center">Quyền Mở Cửa</th>
                    <th className="px-4 py-3.5 text-center">Mã PIN Bảo Mật</th>
                    <th className="px-4 py-3.5 text-center">Thẻ Từ RFID</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredUsers.map((user) => {
                    const isDisabled = user.status === 'disabled';
                    const isRowPending = pendingUserId === user.id;
                    const isPinVisible = Boolean(revealedPins[user.id]);
                    const editTooltip = getEditDisabledTooltip(user);
                    const cardTooltip = getCardDisabledTooltip(user);
                    const canEdit = isClientConnected && !isDisabled && !isRowPending;
                    const canLearnCard = canEdit && connectionState === 'online';

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-surface-container-high/40 ${
                          isDisabled ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Member Identity */}
                        <td className="py-4 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-xs border shadow-sm ${
                                isDisabled
                                  ? 'bg-surface-container-high text-outline border-outline-variant/40'
                                  : 'bg-primary-fixed text-primary border-primary/20'
                              }`}
                            >
                              {getInitials(user.name)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-on-surface">
                                {user.name}
                              </span>
                              <button
                                type="button"
                                aria-label={`Đổi tên ${user.name}`}
                                disabled={!canEdit}
                                onClick={() => openEditNameModal(user)}
                                className="p-1 text-outline hover:text-primary transition-colors disabled:opacity-40 rounded"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Permission Switch */}
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={() => void toggleUserStatus(user)}
                              disabled={!isClientConnected || isRowPending}
                              disabledTooltip={clientOfflineTooltip}
                              ariaLabel={`Bật hoặc tắt quyền của ${user.name}`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                isDisabled
                                  ? 'text-outline'
                                  : 'text-secondary dark:text-emerald-400'
                              }`}
                            >
                              {isDisabled ? 'Tắt' : 'Mở'}
                            </span>
                          </div>
                        </td>

                        {/* PIN */}
                        <td className="px-4 py-4 text-center">
                          {user.pass ? (
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <span className="font-mono font-bold text-sm text-error min-w-[56px]">
                                {isPinVisible ? user.pass : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPin(user.id)}
                                aria-label={isPinVisible ? 'Ẩn mã PIN' : 'Hiện mã PIN'}
                                className="p-1 text-outline hover:text-on-surface rounded transition-colors"
                              >
                                {isPinVisible ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                aria-label="Đổi mã PIN"
                                disabled={!canEdit}
                                onClick={() => setPinModalUser(user)}
                                className="p-1 text-outline hover:text-primary rounded transition-colors disabled:opacity-40"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => setPinModalUser(user)}
                              className="rounded-xl text-xs"
                              leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                            >
                              Cấp mã
                            </Button>
                          )}
                        </td>

                        {/* RFID Card */}
                        <td className="px-4 py-4 text-center">
                          {user.card ? (
                            <div className="inline-flex items-center justify-center gap-2">
                              <span className="font-mono text-xs font-bold text-tertiary bg-tertiary-fixed/30 border border-tertiary/20 px-2.5 py-1 rounded-full">
                                {user.card}
                              </span>
                              <button
                                type="button"
                                aria-label="Đổi thẻ từ"
                                disabled={!canLearnCard}
                                onClick={() => void startLearnCard(user)}
                                className="p-1 text-outline hover:text-tertiary rounded transition-colors disabled:opacity-40"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canLearnCard}
                              disabledTooltip={cardTooltip}
                              onClick={() => void startLearnCard(user)}
                              className="rounded-xl text-xs"
                              leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                            >
                              + Học thẻ
                            </Button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 pr-6 text-right">
                          <button
                            type="button"
                            aria-label={`Xóa thành viên ${user.name}`}
                            disabled={!isClientConnected || isRowPending}
                            onClick={() => setDeleteConfirmUser(user)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-error-container/20 hover:text-error transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 3. 2 Practical Guidance Cards at Bottom */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Gán thẻ từ RFID */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-tertiary-fixed/50 text-tertiary border border-tertiary/20">
              <Radio className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-on-surface">
              Quy trình Gán thẻ từ RFID
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            Nhấn nút <strong>Học thẻ</strong> trên hàng thành viên tương ứng. Màn hình LCD 16x2 trên ổ khóa sẽ hiển thị <span className="font-mono text-primary font-bold">"CHE DO THEM THE"</span>. Quẹt thẻ MIFARE 13.56 MHz vào đầu đọc RC522. Hệ thống sẽ tự động bắt mã UID và hoàn tất trong tối đa 60 giây.
          </p>
        </div>

        {/* Card 2: Quy tắc mã PIN an toàn */}
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-fixed/40 text-primary border border-primary/20">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-on-surface">
              Quy tắc Mã PIN An Toàn
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-on-surface-variant">
            Mã PIN hợp lệ dài từ <strong>4 đến 6 chữ số</strong> và không được trùng lặp giữa các thành viên. Tuyệt đối không đặt mã <span className="font-mono text-error font-bold">999999</span> (mã dành riêng của ổ khóa để khôi phục cấu hình Wi-Fi). Tên hiển thị trên LCD tối đa 16 ký tự không dấu.
          </p>
        </div>
      </div>

      {/* Modals & Dialogs */}
      <UserFormModal
        open={userModalState.open}
        onOpenChange={(open) =>
          setUserModalState((prev) => ({ ...prev, open }))
        }
        mode={userModalState.mode}
        targetUser={userModalState.user}
        existingPasswords={existingPasswords}
        isSubmitting={isSubmittingModal}
        isClientConnected={isClientConnected}
        onSubmitAdd={addUser}
        onSubmitEditName={editUserName}
      />

      <PinModal
        open={Boolean(pinModalUser)}
        onOpenChange={(open) => {
          if (!open) setPinModalUser(null);
        }}
        targetUser={pinModalUser}
        existingPasswords={existingPasswords}
        isSubmitting={isSubmittingModal}
        isClientConnected={isClientConnected}
        onSubmitPin={changeUserPin}
      />

      <LearnCardModal state={learnCardState} onCancel={cancelLearnCard} />

      <ConfirmDialog
        open={Boolean(deleteConfirmUser)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmUser(null);
        }}
        title="Xóa thành viên vĩnh viễn?"
        description={
          deleteConfirmUser ? (
            <>
              Bạn có chắc chắn muốn xóa vĩnh viễn thành viên{' '}
              <strong className="font-bold text-on-surface">
                [{deleteConfirmUser.name}]
              </strong>{' '}
              cùng toàn bộ mã PIN và thẻ từ khỏi bộ nhớ ổ khóa?
            </>
          ) : (
            ''
          )
        }
        confirmText="Xóa vĩnh viễn"
        confirmVariant="danger"
        isLoading={Boolean(
          deleteConfirmUser && pendingUserId === deleteConfirmUser.id
        )}
        onConfirm={() => {
          if (!deleteConfirmUser) return;
          const target = deleteConfirmUser;
          setDeleteConfirmUser(null);
          void deleteUser(target);
        }}
      />
    </div>
  );
};
