/**
 * footer.js - Shared footer renderer
 */

import { scrollToIdWithOffset } from "./scroll.js";
import { icon } from "./icons.js";

export const renderFooter = ({ onCategorySelect } = {}) => {
  const footer = document.createElement("footer");
  footer.className = "footer";
  footer.setAttribute("role", "contentinfo");

  const menuLinks = [
    ["ga", "Gà"],
    ["vit", "Vịt"],
    ["bun", "Bún"],
    ["mien", "Miến"],
    ["chao", "Cháo"],
    ["kho", "Món khô"],
  ];

  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="footer-brand-logo">
            <img class="footer-brand-icon" src="assets/logos/logo-white.svg" alt="" aria-hidden="true">
            <div class="navbar-logo-text">
              <span class="navbar-logo-name">Đồng Quê</span>
              <span class="navbar-logo-tagline">Quán Gà & Vịt</span>
            </div>
          </div>
          <p class="footer-brand-desc">Quán gà & vịt đặc sản với hương vị đồng quê chân thực. Chúng tôi mang đến những bữa ăn tươi ngon, đậm đà từ gà vịt ta nuôi thả vườn.</p>
          <div class="footer-contact-row">${icon('location', '', 'footer-contact-icon')} 93 Nguyễn Thị Đặng, Phường Tân Thới Hiệp, TP.HCM</div>
          <div class="footer-contact-row">${icon('phone', '', 'footer-contact-icon')} 0938637644 - 0919187299</div>
          <div class="footer-contact-row">${icon('email', '', 'footer-contact-icon')} gavitdongque123@gmail.com</div>
          <div class="footer-contact-row">${icon('clock', '', 'footer-contact-icon')} 7:00 - 22:00 (Thứ hai - Chủ nhật)</div>
        </div>
        <div>
          <div class="footer-col-title">Thực đơn</div>
          <div class="footer-links">
            ${menuLinks
              .map(
                ([cat, label]) =>
                  `<span class="footer-link" data-cat="${cat}" role="button" tabindex="0">${label}</span>`,
              )
              .join("")}
          </div>
        </div>
        <div>
          <div class="footer-col-title">Hỗ trợ</div>
          <div class="footer-links">
            <span class="footer-link" role="button" tabindex="0">Hướng dẫn đặt hàng</span>
            <span class="footer-link" role="button" tabindex="0">Chính sách giao hàng</span>
            <span class="footer-link" role="button" tabindex="0">Chính sách đổi trả</span>
            <span class="footer-link" role="button" tabindex="0">Câu hỏi thường gặp</span>
          </div>
        </div>
        <div>
          <div class="footer-col-title">Kết nối</div>
          <div class="footer-links">
            <span class="footer-link" role="button" tabindex="0">Facebook</span>
            <span class="footer-link" role="button" tabindex="0">Instagram</span>
            <span class="footer-link" role="button" tabindex="0">Google Maps</span>
          </div>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3)">
        <span class="footer-bottom-text">© 2026 Quán Ăn Đồng Quê. Tất cả quyền được bảo lưu.</span>
        <div class="footer-bottom-links">
          <span class="footer-bottom-link" role="button" tabindex="0">Chính sách bảo mật</span>
          <span class="footer-bottom-link" role="button" tabindex="0">Điều khoản sử dụng</span>
        </div>
      </div>
    </div>`;

  document.querySelector(".page-content")?.appendChild(footer);

  const hasMenuSection = !!document.getElementById("menu-section");

  footer.querySelectorAll(".footer-link[data-cat]").forEach((link) => {
    const activate = () => {
      const cat = link.dataset.cat;
      if (hasMenuSection && typeof onCategorySelect === "function") {
        onCategorySelect(cat);
        scrollToIdWithOffset("menu-section", { behavior: "smooth" });
      } else {
        window.location.href = `index.html?cat=${encodeURIComponent(cat)}#menu`;
      }
    };

    link.addEventListener("click", activate);
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activate();
    });
  });
};
