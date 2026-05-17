import { initNavbar, updateCartBadge } from '../ui/navbar.js';
import { renderFooter } from '../ui/footer.js';
import { icon } from '../ui/icons.js';
import { hydrateOnlineData } from '../data/store.js';

const renderAbout = () => {
  const section = document.createElement("section");
  section.style.cssText = "padding:var(--space-16) 0;background:var(--color-bg)";
  section.setAttribute("aria-label", "About us");
  section.innerHTML = `
    <div class="container">
      <div style="text-align:center;margin-bottom:var(--space-10)">
        <h1 class="section-title" style="font-size:var(--font-size-4xl)">About Us</h1>
        <p class="section-subtitle" style="margin-top:var(--space-5)">
          Quán Ăn Đồng Quê — món ngon từ gà & vịt ta thả vườn.
        </p>
      </div>

      <div class="card" style="max-width:900px;margin:0 auto">
        <div class="card-body" style="padding:var(--space-8)">
          <h2 style="font-size:var(--font-size-2xl);font-weight:800;margin-bottom:var(--space-3);color:var(--color-primary-800)">Câu chuyện của chúng tôi</h2>
          <p style="color:var(--color-text-muted);line-height:1.8;margin-bottom:var(--space-6)">
            Đồng Quê mong muốn mang hương vị quen thuộc của bữa cơm gia đình đến gần hơn với mọi người.
            Chúng tôi ưu tiên nguyên liệu tươi, chế biến trong ngày và giữ trọn vị ngon truyền thống.
          </p>

          <div class="divider"></div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:var(--space-6)">
            <div>
              <h3 style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:var(--space-2)">Cam kết</h3>
              <ul style="display:flex;flex-direction:column;gap:var(--space-2);color:var(--color-text-muted)">
                <li>Gà & vịt ta thả vườn, chọn lọc kỹ</li>
                <li>Món ăn chế biến trong ngày</li>
                <li>Giao hàng nhanh, đóng gói cẩn thận</li>
              </ul>
            </div>
            <div>
              <h3 style="font-size:var(--font-size-lg);font-weight:800;margin-bottom:var(--space-2)">Liên hệ</h3>
              <div style="display:flex;flex-direction:column;gap:var(--space-2);color:var(--color-text-muted)">
                <div class="about-contact-row">${icon('location', '', 'about-contact-icon')} 12 Mai Chí Thọ, Phường An Khánh, TP.HCM</div>
                <div class="about-contact-row">${icon('phone', '', 'about-contact-icon')} 0901 234 567</div>
                <div class="about-contact-row">${icon('email', '', 'about-contact-icon')} contact@quanandongque.vn</div>
                <div class="about-contact-row">${icon('clock', '', 'about-contact-icon')} 7:00 - 22:00 (Thứ hai - Chủ nhật)</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:var(--space-10)">
        <a class="btn btn-primary" href="index.html#menu">Đặt đồ ăn</a>
        <a class="btn btn-outline" href="preorder.html">Đặt gà trước</a>
      </div>
    </div>
  `;

  document.querySelector(".page-content")?.appendChild(section);
};

const init = async () => {
  await hydrateOnlineData();
  initNavbar();
  renderAbout();
  renderFooter();
  updateCartBadge();
  window.addEventListener("user:loggedin", () => updateCartBadge());
};

document.addEventListener("DOMContentLoaded", init);
