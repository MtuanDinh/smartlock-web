import React, { useState } from 'react';
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
} from 'lucide-react';
import { useUsers } from '../../hooks/useUsers';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { UserFormModal } from './UserFormModal';
import { PinModal } from './PinModal';
import { LearnCardModal } from './LearnCardModal';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
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

  const { connectionState, isClientConnected } = useSystemStatus();

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

  return (
    <div className="space-y-6">
      <Card noPadding className="overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 border border-blue-500/30">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-text-primary">
                Quản lý Thành viên
              </h1>
              <p className="text-xs text-text-secondary">
                Tổng cộng {users.length} thành viên đã đăng ký
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={!isClientConnected}
            disabledTooltip={clientOfflineTooltip}
            onClick={openAddModal}
            leftIcon={<UserPlus className="h-4 w-4" />}
          >
            Thêm mới
          </Button>
        </div>

        {/* Nội dung danh sách */}
        {isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-20 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Chưa có thành viên nào"
            description="Hãy thêm thành viên đầu tiên để cấp mã PIN mở cửa hoặc gán thẻ từ RFID."
            action={
              <Button
                variant="primary"
                disabled={!isClientConnected}
                disabledTooltip={clientOfflineTooltip}
                onClick={openAddModal}
                leftIcon={<UserPlus className="h-4 w-4" />}
              >
                Thêm thành viên
              </Button>
            }
          />
        ) : (
          <>
            {/* Giao diện Mobile (< 768px): Card List */}
            <div className="divide-y divide-border-subtle md:hidden">
              {users.map((user) => {
                const isDisabled = user.status === 'disabled';
                const isRowPending = pendingUserId === user.id;
                const isPinVisible = Boolean(revealedPins[user.id]);
                const editTooltip = getEditDisabledTooltip(user);
                const cardTooltip = getCardDisabledTooltip(user);
                const canEdit = isClientConnected && !isDisabled && !isRowPending;
                const canLearnCard =
                  canEdit && connectionState === 'online';

                return (
                  <div
                    key={user.id}
                    className={`p-4 transition-opacity duration-200 ${
                      isDisabled ? 'opacity-60 bg-bg-primary/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-sm border ${
                            isDisabled
                              ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                              : 'bg-blue-600/15 text-blue-500 border-blue-500/30'
                          }`}
                        >
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-base text-text-primary truncate">
                              {user.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Đổi tên ${user.name}`}
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => openEditNameModal(user)}
                              className="!min-h-[32px] !px-2"
                            >
                              <Pencil className="h-3.5 w-3.5 text-cyan-500" />
                            </Button>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge
                              variant={isDisabled ? 'muted' : 'success'}
                            >
                              {isDisabled ? 'Đã khóa' : 'Đang mở'}
                            </Badge>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Xóa thành viên ${user.name}`}
                          disabled={!isClientConnected || isRowPending}
                          disabledTooltip={clientOfflineTooltip}
                          onClick={() => setDeleteConfirmUser(user)}
                          className="text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Hàng thông tin PIN & Thẻ từ trên Mobile */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2.5 rounded-xl bg-bg-primary/60 p-3 border border-border-subtle">
                      {/* Cột PIN */}
                      <div className="flex flex-col justify-between gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                          Mã PIN
                        </span>
                        {user.pass ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-bold text-rose-500">
                              {isPinVisible ? user.pass : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPin(user.id)}
                              aria-label={
                                isPinVisible
                                  ? `Ẩn mã PIN của ${user.name}`
                                  : `Hiện mã PIN của ${user.name}`
                              }
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                            >
                              {isPinVisible ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Đổi mã PIN của ${user.name}`}
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => setPinModalUser(user)}
                              className="!min-h-[30px] !px-2"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => setPinModalUser(user)}
                              leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                            >
                              Cấp mã
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Cột Thẻ từ */}
                      <div className="flex flex-col justify-between gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                          Thẻ Từ RFID
                        </span>
                        {user.card ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="primary">Đã cấp thẻ</Badge>
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={`Đổi thẻ từ cho ${user.name}`}
                              disabled={!canLearnCard}
                              disabledTooltip={cardTooltip}
                              onClick={() => void startLearnCard(user)}
                              className="!min-h-[30px] !px-2"
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canLearnCard}
                              disabledTooltip={cardTooltip}
                              onClick={() => void startLearnCard(user)}
                              leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                            >
                              + Thẻ mới
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Giao diện Desktop (>= 768px): Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle bg-bg-primary/50 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    <th className="py-3.5 pl-6 pr-4">Thành Viên</th>
                    <th className="px-4 py-3.5 text-center">Quyền</th>
                    <th className="px-4 py-3.5 text-center">Mã PIN</th>
                    <th className="px-4 py-3.5 text-center">Thẻ Từ</th>
                    <th className="py-3.5 pl-4 pr-6 text-right">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {users.map((user) => {
                    const isDisabled = user.status === 'disabled';
                    const isRowPending = pendingUserId === user.id;
                    const isPinVisible = Boolean(revealedPins[user.id]);
                    const editTooltip = getEditDisabledTooltip(user);
                    const cardTooltip = getCardDisabledTooltip(user);
                    const canEdit =
                      isClientConnected && !isDisabled && !isRowPending;
                    const canLearnCard =
                      canEdit && connectionState === 'online';

                    return (
                      <tr
                        key={user.id}
                        className={`transition-colors hover:bg-bg-elevated/40 ${
                          isDisabled ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Thành viên */}
                        <td className="py-4 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-xs border ${
                                isDisabled
                                  ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                  : 'bg-blue-600/15 text-blue-500 border-blue-500/30'
                              }`}
                            >
                              {getInitials(user.name)}
                            </div>
                            <span className="font-bold text-text-primary">
                              {user.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Đổi tên ${user.name}`}
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => openEditNameModal(user)}
                              className="!min-h-[34px] !px-2"
                            >
                              <Pencil className="h-4 w-4 text-cyan-500" />
                            </Button>
                          </div>
                        </td>

                        {/* Quyền */}
                        <td className="px-4 py-4 text-center">
                          <div className="inline-flex items-center gap-2">
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={() => void toggleUserStatus(user)}
                              disabled={!isClientConnected || isRowPending}
                              disabledTooltip={clientOfflineTooltip}
                              ariaLabel={`Bật hoặc tắt quyền của ${user.name}`}
                            />
                            <Badge variant={isDisabled ? 'muted' : 'success'}>
                              {isDisabled ? 'Khóa' : 'Mở'}
                            </Badge>
                          </div>
                        </td>

                        {/* Mã PIN */}
                        <td className="px-4 py-4 text-center">
                          {user.pass ? (
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <span className="font-mono font-bold text-rose-500 min-w-[56px]">
                                {isPinVisible ? user.pass : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealPin(user.id)}
                                aria-label={
                                  isPinVisible
                                    ? `Ẩn mã PIN của ${user.name}`
                                    : `Hiện mã PIN của ${user.name}`
                                }
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                              >
                                {isPinVisible ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={`Cập nhật mã PIN của ${user.name}`}
                                disabled={!canEdit}
                                disabledTooltip={editTooltip}
                                onClick={() => setPinModalUser(user)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canEdit}
                              disabledTooltip={editTooltip}
                              onClick={() => setPinModalUser(user)}
                              leftIcon={<KeyRound className="h-3.5 w-3.5" />}
                            >
                              Cấp mã
                            </Button>
                          )}
                        </td>

                        {/* Thẻ Từ */}
                        <td className="px-4 py-4 text-center">
                          {user.card ? (
                            <div className="inline-flex items-center justify-center gap-2">
                              <Badge variant="primary">Đã cấp thẻ</Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={`Đổi thẻ từ cho ${user.name}`}
                                disabled={!canLearnCard}
                                disabledTooltip={cardTooltip}
                                onClick={() => void startLearnCard(user)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canLearnCard}
                              disabledTooltip={cardTooltip}
                              onClick={() => void startLearnCard(user)}
                              leftIcon={<CreditCard className="h-3.5 w-3.5" />}
                            >
                              + Thẻ mới
                            </Button>
                          )}
                        </td>

                        {/* Xóa */}
                        <td className="py-4 pl-4 pr-6 text-right">
                          <Button
                            variant="danger-outline"
                            size="sm"
                            aria-label={`Xóa thành viên ${user.name}`}
                            disabled={!isClientConnected || isRowPending}
                            disabledTooltip={clientOfflineTooltip}
                            onClick={() => setDeleteConfirmUser(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Modal Thêm / Đổi tên */}
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

      {/* Modal Đổi PIN */}
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

      {/* Modal Chế độ Học thẻ */}
      <LearnCardModal state={learnCardState} onCancel={cancelLearnCard} />

      {/* Dialog Xác nhận Xóa thành viên */}
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
              <strong className="font-bold text-text-primary">
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
