import { initShipperPage } from '../features/shipper/app.js';
import { hydrateOnlineData } from '../data/store.js';

document.addEventListener('DOMContentLoaded', async () => {
  await hydrateOnlineData();
  initShipperPage();
});
