import { getLocalMigrationSummary, migrateLocalDataToOnline } from '../../data/store.js';
import { openStaffConfirm } from '../../ui/confirm.js';
import { toast } from '../../ui/toast.js';

let migrationPromptShown = false;

export const maybePromptLocalDataMigration = async () => {
  if (migrationPromptShown) return;
  const summary = getLocalMigrationSummary();
  if (!summary.hasData || summary.migratedAt) return;
  migrationPromptShown = true;

  const parts = [
    summary.cartItems ? `${summary.cartItems} món trong giỏ` : '',
    summary.orders ? `${summary.orders} đơn hàng` : '',
    summary.reservations ? `${summary.reservations} đơn đặt trước` : '',
    summary.menuItems ? `${summary.menuItems} món menu` : '',
    summary.vouchers ? `${summary.vouchers} voucher` : '',
  ].filter(Boolean);

  const ok = await openStaffConfirm({
    title: 'Đồng bộ dữ liệu local',
    message: `Tìm thấy ${parts.join(', ')} trên máy này. Bạn muốn đưa dữ liệu này lên tài khoản online không?`,
    confirmText: 'Đồng bộ',
    cancelText: 'Để sau',
    side: 'right',
  });
  if (!ok) return;

  const result = await migrateLocalDataToOnline();
  if (!result.ok) {
    toast.error(result.msg || 'Không thể đồng bộ dữ liệu local.');
    migrationPromptShown = false;
    return;
  }
  toast.success('Đã đồng bộ dữ liệu local lên online.');
};
