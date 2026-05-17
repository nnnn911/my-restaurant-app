import { initNavbar, updateCartBadge } from '../ui/navbar.js';
import { renderFooter } from '../ui/footer.js';
import { renderHistoryPage } from '../features/customer/history.js';
import { hydrateOnlineData } from '../data/store.js';

const init = async () => {
  await hydrateOnlineData();
  initNavbar();

  const params = new URLSearchParams(window.location.search);
  const highlightId = params.get("highlight") || null;

  renderHistoryPage({ highlightId });
  renderFooter();

  updateCartBadge();
  window.addEventListener("user:loggedin", () => {
    updateCartBadge();
    renderHistoryPage({ highlightId });
  });
};

document.addEventListener("DOMContentLoaded", init);
