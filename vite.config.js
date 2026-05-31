import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(fileURLToPath(import.meta.url));

const copyRuntimeAssets = () => ({
  name: 'copy-runtime-assets',
  closeBundle() {
    const source = resolve(rootDir, 'assets');
    const target = resolve(rootDir, 'dist/assets');
    if (!existsSync(source)) return;
    cpSync(source, target, { recursive: true });
  }
});

export default defineConfig({
  appType: 'mpa',
  plugins: [copyRuntimeAssets()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        about: 'about.html',
        checkout: 'checkout.html',
        history: 'history.html',
        preorder: 'preorder.html',
        rewards: 'rewards.html',
        admin: 'admin.html',
        adminOrder: 'admin-order.html',
        adminPosOrders: 'admin-pos-orders.html',
        adminPreorder: 'admin-preorder.html',
        owner: 'owner.html',
        ownerMenu: 'owner-menu.html',
        ownerReports: 'owner-reports.html',
        ownerCustomers: 'owner-customers.html',
        ownerStaff: 'owner-staff.html',
        ownerCosts: 'owner-costs.html',
        ownerVouchers: 'owner-vouchers.html',
        shipper: 'shipper.html'
      }
    }
  }
});
