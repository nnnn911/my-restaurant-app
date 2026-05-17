import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
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
        adminPreorder: 'admin-preorder.html',
        owner: 'owner.html',
        ownerMenu: 'owner-menu.html',
        ownerReports: 'owner-reports.html',
        ownerCustomers: 'owner-customers.html',
        ownerVouchers: 'owner-vouchers.html',
        shipper: 'shipper.html'
      }
    }
  }
});
