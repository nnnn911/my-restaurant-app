/**
 * app.js - Main entry point
 */
import {
  initNavbar,
  updateCartBadge,
} from '../ui/navbar.js';
import { initMenu, filterMenu, setMenuCategory } from '../features/customer/menu.js';
import { renderFooter } from '../ui/footer.js';
import { scrollToIdWithOffset } from '../ui/scroll.js';
import { hydrateOnlineData } from '../data/store.js';

const init = async () => {
  await hydrateOnlineData();
  // Init navbar first (it prepends to body)
  initNavbar();

  // Render page sections
  renderHero();
  renderMenuSection();
  renderFooter({ onCategorySelect: filterMenu });

  // Init menu items
  initMenu();

  // Apply category from URL (?cat=ga) if present
  const params = new URLSearchParams(window.location.search);
  const cat = params.get("cat");
  if (cat) setMenuCategory(cat);

  updateCartBadge();

  // Listen for login event to refresh cart badge
  window.addEventListener("user:loggedin", () => updateCartBadge());

  // If opened with #menu, scroll to menu
  if (window.location.hash === "#menu") {
    setTimeout(() => scrollToIdWithOffset("menu-section", { behavior: "smooth" }), 50);
  }
};

/* ============================================
   HERO
============================================ */
const renderHero = () => {
  const hero = document.createElement("section");
  hero.id = "hero";
  hero.className = "hero";
  hero.setAttribute("aria-label", "Trang chủ Quán Ăn Đồng Quê");
  hero.innerHTML = `
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-decor" aria-hidden="true">
      <div class="hero-decor-circle"></div>
      <div class="hero-decor-circle"></div>
    </div>
    <div class="container">
      <div class="hero-content">
        <h1 class="hero-title">
          Quán Gà & Vịt
          <span>Đồng Quê</span>
        </h1>
        <p class="hero-subtitle">
          Thưởng thức những món ăn đặc sắc từ gà, vịt ta nuôi thả vườn — tươi ngon, đậm đà hương vị quê nhà. Đặt hàng ngay, giao tận nơi!
        </p>
        <div class="hero-actions">
          <button class="btn btn-accent btn-xl" id="btn-order-now" aria-label="Đặt món ngay">
            Đặt món ngay
          </button>
          <a class="btn btn-outline btn-xl" id="btn-preorder" href="preorder.html" style="color:white;border-color:rgba(255,255,255,0.4)" aria-label="Đặt gà trước">
            Đặt gà trước
          </a>
        </div>
      </div>
    </div>`;

  document.querySelector(".page-content").appendChild(hero);

  document
    .getElementById("btn-order-now")
    .addEventListener("click", () => scrollToIdWithOffset("menu-section", { behavior: "smooth" }));
};

/* ============================================
   MENU SECTION (container only - initMenu fills it)
============================================ */
const renderMenuSection = () => {
  const section = document.createElement("section");
  section.id = "menu-section";
  section.className = "menu-section";
  section.setAttribute("aria-label", "Thực đơn");
  document.querySelector(".page-content").appendChild(section);
};


// Boot
document.addEventListener("DOMContentLoaded", init);
