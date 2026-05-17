import { initNavbar, updateCartBadge } from '../ui/navbar.js';
import { renderFooter } from '../ui/footer.js';
import { renderRewardsPage } from '../features/customer/rewards.js';
import { hydrateOnlineData } from '../data/store.js';

const init = async () => {
  await hydrateOnlineData();
  initNavbar();
  renderRewardsPage();
  renderFooter();

  updateCartBadge();
  window.addEventListener("user:loggedin", () => {
    updateCartBadge();
    renderRewardsPage();
  });
};

document.addEventListener("DOMContentLoaded", init);
