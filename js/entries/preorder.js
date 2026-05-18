import { initNavbar, updateCartBadge } from '../ui/navbar.js';
import { toast } from '../ui/toast.js';
import { renderFooter } from '../ui/footer.js';
import { createReservationOnline, formatPrice, getCurrentUser, getMenu, hydrateOnlineData } from '../data/store.js';
import { icon } from '../ui/icons.js';
import { openAuthModal } from '../features/customer/auth.js';

const PREORDER_TYPES = [
  { id: "ga-nguyen-con", label: "Gà nguyên con", category: "ga" },
  { id: "vit-nguyen-con", label: "Vịt nguyên con", category: "vit" },
];

const getPreorderPriceMap = () => {
  const menu = getMenu();
  const maxByCategory = (cat) => {
    const prices = (menu || [])
      .filter((m) => m?.category === cat)
      .map((m) => Number(m?.price || 0))
      .filter((p) => Number.isFinite(p) && p > 0);
    return prices.length ? Math.max(...prices) : 0;
  };

  return {
    "ga-nguyen-con": maxByCategory("ga"),
    "vit-nguyen-con": maxByCategory("vit"),
  };
};

const showPreorderSuccess = ({ reservation, itemLabel, neededDateText, totalText }) => {
  document.getElementById("preorder-success-modal")?.remove();

  const modal = document.createElement("div");
  modal.className = "modal-backdrop active";
  modal.id = "preorder-success-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const canViewHistory = Boolean(getCurrentUser());

  modal.innerHTML = `
    <div class="modal" style="max-width:480px">
      <div class="modal-body">
        <div class="order-success">
          <h2>Đã tạo đơn đặt trước!</h2>
          <div class="order-number">${icon('reservation')} Mã đơn: ${reservation.id}</div>
          <p>
            Đã tạo đơn đặt trước <strong>${itemLabel}</strong> (${totalText}) cho ngày <strong>${neededDateText}</strong>.<br>
            Nhân viên sẽ xác nhận và chuẩn bị đơn theo lịch hẹn.
          </p>
          <div style="display:flex;gap:var(--space-3);margin-top:var(--space-6);justify-content:center;flex-wrap:wrap">
            ${canViewHistory ? `<button class="btn btn-outline" id="preorder-view-history">Xem lịch sử</button>` : ``}
            <button class="btn btn-primary" id="preorder-close">Tiếp tục</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";

  const close = () => {
    modal.remove();
    document.body.style.overflow = "";
  };

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.getElementById("preorder-close")?.addEventListener("click", close);
  document.getElementById("preorder-view-history")?.addEventListener("click", () => {
    close();
    window.location.href = `history.html?highlight=${encodeURIComponent(reservation.id)}`;
  });
};

const renderPreorderSection = () => {
  const priceMap = getPreorderPriceMap();

  const section = document.createElement("section");
  section.id = "reservation-section";
  section.className = "reservation-section";
  section.setAttribute("aria-label", "Đặt gà trước");
  section.innerHTML = `
    <div class="container">
      <div style="text-align:center;margin-bottom:var(--space-6)">
        <h1 class="section-title" style="font-size:var(--font-size-3xl)">${icon('reservation')} Đặt Gà Trước</h1>
        <p class="section-subtitle" style="margin-top:var(--space-5)">
          Lưu ý: Bạn cần đến cửa hàng để pickup đơn đặt trước.
        </p>
      </div>
      <div class="reservation-form-card">
        <form id="reservation-form" novalidate>
          <div class="reservation-grid">
            <div class="form-group">
              <label class="form-label" for="res-name">Họ và tên *</label>
              <input class="form-control" type="text" id="res-name" placeholder="Nguyễn Văn A" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="res-phone">Số điện thoại *</label>
              <input class="form-control" type="tel" id="res-phone" placeholder="0901234567" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="res-type">Loại *</label>
              <select class="form-control" id="res-type" required>
                <option value="">-- Chọn loại --</option>
                ${PREORDER_TYPES.map((t) => {
                  const price = Number(priceMap?.[t.id] || 0);
                  const priceText = price > 0 ? ` — ${formatPrice(price)}` : "";
                  return `<option value="${t.id}" data-price="${price}">${t.label}${priceText}</option>`;
                }).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="res-date">Ngày cần *</label>
              <input class="form-control" type="text" id="res-date" inputmode="numeric" placeholder="dd/mm/yyyy" autocomplete="off" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="res-note">Ghi chú thêm</label>
            <input class="form-control" type="text" id="res-note" placeholder="Ví dụ: Làm sạch, chặt sẵn, ghi chú cúng lễ..." maxlength="120">
          </div>
          <div id="res-error" class="form-error" style="display:none;margin-bottom:var(--space-4)"></div>
          <div style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);flex-wrap:wrap">
            <div id="preorder-price-summary" style="font-weight:800;color:var(--color-primary-700);font-size:var(--font-size-lg)">
              Tạm tính: -
            </div>
            <button type="submit" class="btn btn-primary btn-lg" id="btn-reserve" style="min-width:240px">
              Gửi yêu cầu đặt trước
            </button>
            
          </div>
        </form>
      </div>
    </div>`;

  document.querySelector(".page-content")?.appendChild(section);

  const dateInput = document.getElementById("res-date");
  const typeSelect = document.getElementById("res-type");
  const priceSummary = document.getElementById("preorder-price-summary");

  const updatePriceSummary = () => {
    const selected = typeSelect?.selectedOptions?.[0];
    const price = Number(selected?.dataset?.price || 0);
    priceSummary.textContent = price > 0 ? `Tạm tính: ${formatPrice(price)}` : "Tạm tính: -";
  };

  typeSelect?.addEventListener("change", updatePriceSummary);
  updatePriceSummary();

  const parseDateVi = (value) => {
    const v = (value || "").trim();
    const m = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    d.setHours(0, 0, 0, 0);
    const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { date: d, iso };
  };

  const getTomorrowLocal = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 1);
    return t;
  };

  document.getElementById("reservation-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("res-error");
    const currentUser = getCurrentUser();

    if (!currentUser) {
      openAuthModal("login");
      toast.info("Vui lòng đăng nhập để đặt trước.");
      return;
    }

    const name = document.getElementById("res-name").value.trim();
    const phone = document.getElementById("res-phone").value.trim();
    const type = document.getElementById("res-type").value;
    const typeOption = document.getElementById("res-type")?.selectedOptions?.[0];
    const price = Number(typeOption?.dataset?.price || 0);
    const parsed = parseDateVi(document.getElementById("res-date").value);
    const note = document.getElementById("res-note").value.trim();

    if (!name || !phone || !type || !parsed) {
      errEl.innerHTML = "Vui lòng điền đầy đủ thông tin bắt buộc.";
      errEl.style.display = "flex";
      return;
    }

    const tomorrow = getTomorrowLocal();
    if (parsed.date < tomorrow) {
      errEl.innerHTML = "Ngày cần phải từ ngày mai trở đi.";
      errEl.style.display = "flex";
      return;
    }

    errEl.style.display = "none";

    const itemLabel = PREORDER_TYPES.find((t) => t.id === type)?.label || (type === "ga-nguyen-con" ? "Gà nguyên con" : "Vịt nguyên con");
    const safeQty = 1;
    const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
    const total = safePrice * safeQty;

    let reservation;
    try {
      reservation = await createReservationOnline({
      userId: currentUser?.id || null,
      name,
      phone,
      type,
      itemName: itemLabel,
      qty: safeQty,
      price: safePrice,
      total,
      date: parsed.iso,
      note,
      });
    } catch (error) {
      errEl.innerHTML = error?.message || "Không thể tạo đơn đặt trước online. Vui lòng thử lại.";
      errEl.style.display = "flex";
      return;
    }

    document.getElementById("reservation-form").reset();

    toast.success("Đã gửi yêu cầu đặt trước!");

    showPreorderSuccess({
      reservation,
      itemLabel,
      neededDateText: parsed.date.toLocaleDateString("vi-VN"),
      totalText: safePrice > 0 ? formatPrice(total) : "Chưa có giá",
    });
  });
};

const requirePreorderLogin = () => {
  if (getCurrentUser()) return;
  openAuthModal("login");
  toast.info("Vui lòng đăng nhập để đặt trước.");
};

const init = async () => {
  await hydrateOnlineData();
  initNavbar();
  document.body.classList.add('page-preorder');
  renderPreorderSection();
  renderFooter();
  updateCartBadge();
  requirePreorderLogin();
  window.addEventListener("user:loggedin", (event) => {
    updateCartBadge();
    const user = event.detail;
    const nameInput = document.getElementById("res-name");
    const phoneInput = document.getElementById("res-phone");
    if (nameInput && !nameInput.value) nameInput.value = user?.name || "";
    if (phoneInput && !phoneInput.value) phoneInput.value = user?.phone || "";
  });
};

document.addEventListener("DOMContentLoaded", init);
