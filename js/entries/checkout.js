import { initNavbar, updateCartBadge } from '../ui/navbar.js';
import { renderFooter } from '../ui/footer.js';
import { renderCheckoutPage } from '../features/customer/checkout.js';
import { hydrateOnlineData } from '../data/store.js';

const init = async () => {
  await hydrateOnlineData();
  initNavbar();
  renderCheckoutPage();
  renderFooter();

  updateCartBadge();
  window.addEventListener("user:loggedin", () => {
    updateCartBadge();
    renderCheckoutPage();
  });
};

document.addEventListener("DOMContentLoaded", init);
