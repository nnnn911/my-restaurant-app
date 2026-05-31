import {
  getVoucherStatus,
  toDateTimeLocal,
  formatDateTimeValue,
  moneyInput,
  OWNER_SHEET_PAGE_SIZE,
  invalidateOwnerData,
  getOwnerData,
  openOwnerDrawer,
  getSortState,
  nextSort,
  sheetSortButton,
  getPagedRows,
  ownerPaginationTableFooterHtml,
  scheduleRenderPage,
  rerenderOwnerPage,
  formatPrice,
  deleteVoucherOnline,
  saveVoucherOnline,
  icon,
  openStaffConfirm,
  escapeAttr,
  escapeHtml,
} from "./common.js";
import { toast } from "../../ui/toast.js";
import {
  bindSegmentedDateTimeInputs,
  getDateTimeValue,
  segmentedDateTimeInput,
} from "../../ui/datetime.js";

let searchQuery = "";
let voucherFilter = "all";
let voucherSort = "code-asc";
let voucherSheetPage = 1;
let voucherSelectedCode = null;

const getSelectedVoucher = () => {
  return (
    getOwnerData().vouchers.find((v) => v.code === voucherSelectedCode) || null
  );
};

export const renderVoucherPage = () => {
  const q = searchQuery.trim().toLowerCase();
  const vouchers = getOwnerData()
    .vouchers.filter(
      (v) => !q || `${v.code || ""} ${v.desc || ""}`.toLowerCase().includes(q),
    )
    .filter(
      (v) => voucherFilter === "all" || getVoucherStatus(v) === voucherFilter,
    )
    .sort((a, b) => {
      const { key, dir } = getSortState(voucherSort, "code");
      const direction = dir === "desc" ? -1 : 1;
      if (key === "value")
        return (Number(a.value || 0) - Number(b.value || 0)) * direction;
      if (key === "minOrder")
        return (Number(a.minOrder || 0) - Number(b.minOrder || 0)) * direction;
      if (key === "type")
        return (a.type || "").localeCompare(b.type || "", "vi") * direction;
      if (key === "startsAt")
        return (a.startsAt || "").localeCompare(b.startsAt || "") * direction;
      if (key === "expiresAt")
        return (a.expiresAt || "").localeCompare(b.expiresAt || "") * direction;
      if (key === "status")
        return (
          getVoucherStatus(a).localeCompare(getVoucherStatus(b), "vi") *
          direction
        );
      return (
        (a.code || "").localeCompare(b.code || "", "vi", { numeric: true }) *
        direction
      );
    });
  const paged = getPagedRows(vouchers, voucherSheetPage, OWNER_SHEET_PAGE_SIZE);
  voucherSheetPage = paged.page;
  const formatVoucherValue = (v) =>
    v.type === "percent"
      ? `${Number(v.value || 0)}%`
      : formatPrice(Number(v.value || 0));
  const voucherTypeLabel = (v) => (v.type === "percent" ? "%" : "Số tiền");
  return `
    <div class="staff-grid staff-grid--manage owner-sheet-grid">
      <section class="staff-panel" aria-label="Danh sách voucher">
        <div class="staff-panel-header owner-menu-header">
          <div class="owner-menu-header-row">
            <div class="search-bar owner-sheet-search">
              <span class="search-icon" aria-hidden="true">${icon("search")}</span>
              <input type="search" id="owner-search" placeholder="Tìm voucher..." value="${escapeAttr(searchQuery)}">
            </div>
            <button class="btn btn-primary btn-sm owner-add-btn" id="voucher-new" type="button">+ Thêm voucher</button>
          </div>
        </div>
        <div class="staff-panel-body owner-sheet-body">
          <div class="owner-table-wrap">
            <table class="owner-table owner-spreadsheet owner-voucher-sheet">
              <thead>
                <tr>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "code", "Mã")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "type", "Loại")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "value", "Value")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "minOrder", "Đơn tối thiểu")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "startsAt", "Bắt đầu")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "expiresAt", "Kết thúc")}</th>
                  <th>${sheetSortButton("data-voucher-sort-col", voucherSort, "status", "Trạng thái")}</th>
                </tr>
              </thead>
              <tbody>
                ${
                  paged.rows
                    .map(
                      (v) => `
                  <tr class="${v.code === voucherSelectedCode ? "active" : ""}" data-voucher-code="${escapeAttr(v.code)}">
                    <td>${escapeHtml(v.code)}</td>
                    <td>${voucherTypeLabel(v)}</td>
                    <td>${formatVoucherValue(v)}</td>
                    <td>${formatPrice(Number(v.minOrder || 0))}</td>
                    <td>${escapeHtml(formatDateTimeValue(v.startsAt))}</td>
                    <td>${escapeHtml(formatDateTimeValue(v.expiresAt))}</td>
                    <td><span class="badge ${v.active ? "badge-success" : "badge-danger"}">${v.active ? "Đang bật" : "Đã tắt"}</span></td>
                  </tr>
                `,
                    )
                    .join("") ||
                  `<tr><td colspan="7"><div class="empty-state"><h3>Không tìm thấy voucher</h3></div></td></tr>`
                }
              </tbody>
              ${ownerPaginationTableFooterHtml({ total: vouchers.length, page: voucherSheetPage, pageCount: paged.pageCount, label: "voucher", prevId: "voucher-prev", nextId: "voucher-next", colspan: 7 })}
            </table>
          </div>
        </div>
      </section>
    </div>
  `;
};

const renderVoucherForm = (v) => {
  if (!v)
    return `<div class="empty-state"><h3>Chọn voucher để chỉnh sửa</h3></div>`;
  return `
    <form class="owner-form" id="voucher-form" data-code="${escapeAttr(v.code)}">
      <div class="owner-form-grid">
        <div class="form-group">
          <label class="form-label" for="voucher-code">Mã</label>
          <input class="form-control" id="voucher-code" value="${escapeAttr(v.code)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-type">Loại</label>
          <select class="form-control" id="voucher-type">
            <option value="percent"${v.type === "percent" ? " selected" : ""}>Phần trăm</option>
            <option value="fixed"${v.type === "fixed" ? " selected" : ""}>Số tiền</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-value">Giá trị</label>
          <input class="form-control" id="voucher-value" type="number" min="0" value="${Number(v.value || 0)}" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-min">Đơn tối thiểu</label>
          ${moneyInput("voucher-min", v.minOrder)}
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-start">Bắt đầu</label>
          ${segmentedDateTimeInput("voucher-start", toDateTimeLocal(v.startsAt))}
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-exp">Kết thúc</label>
          ${segmentedDateTimeInput("voucher-exp", toDateTimeLocal(v.expiresAt))}
        </div>
        <div class="form-group">
          <label class="form-label" for="voucher-active">Trạng thái</label>
          <select class="form-control" id="voucher-active">
            <option value="active"${v.active ? " selected" : ""}>Đang bật</option>
            <option value="inactive"${!v.active ? " selected" : ""}>Đang tắt</option>
          </select>
        </div>
        <div class="form-group owner-form-wide">
          <label class="form-label" for="voucher-desc">Mô tả</label>
          <input class="form-control" id="voucher-desc" value="${escapeAttr(v.desc || "")}">
        </div>
      </div>
      <div class="staff-actions">
        <button class="btn btn-primary" type="submit">${icon("pen")} Lưu voucher</button>
        <button class="btn btn-danger" id="voucher-delete" type="button">${icon("trashcan")} Xoá</button>
      </div>
    </form>
  `;
};

const bindVoucherForm = (closeDrawer) => {
  bindSegmentedDateTimeInputs(
    document.getElementById("voucher-form") || document,
  );
  document.getElementById("voucher-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldCode = e.currentTarget.dataset.code;
    const code = document
      .getElementById("voucher-code")
      .value.trim()
      .toUpperCase();
    const value = Number(document.getElementById("voucher-value").value || 0);
    const minOrder = Number(document.getElementById("voucher-min").value || 0);
    if (
      !code ||
      !Number.isFinite(value) ||
      value < 0 ||
      !Number.isFinite(minOrder) ||
      minOrder < 0
    ) {
      toast.error("Thông tin voucher chưa hợp lệ.");
      return;
    }
    const vouchers = getOwnerData().vouchers;
    if (vouchers.some((v) => v.code !== oldCode && v.code === code)) {
      toast.error("Mã voucher đã tồn tại.");
      return;
    }
    try {
      await saveVoucherOnline(oldCode, {
        code,
        type: document.getElementById("voucher-type").value,
        value,
        minOrder,
        startsAt: getDateTimeValue("voucher-start"),
        expiresAt: getDateTimeValue("voucher-exp"),
        desc: document.getElementById("voucher-desc").value.trim(),
        active: document.getElementById("voucher-active").value === "active",
      });
      invalidateOwnerData();
      voucherSelectedCode = code;
      toast.success("Đã lưu voucher.");
      closeDrawer?.();
      rerenderOwnerPage();
    } catch (error) {
      toast.error(error?.message || "Không thể lưu voucher vào database.");
    }
  });
  document
    .getElementById("voucher-delete")
    ?.addEventListener("click", async () => {
      const v = getSelectedVoucher();
      if (!v) return;
      const ok = await openStaffConfirm({
        title: "Xoá voucher",
        message: `Xác nhận xoá ${v.code}?`,
        confirmText: "Xoá",
        danger: true,
      });
      if (!ok) return;
      try {
        await deleteVoucherOnline(v.code);
        invalidateOwnerData();
        voucherSelectedCode = null;
        toast.success("Đã xoá voucher.");
        closeDrawer?.();
        rerenderOwnerPage();
      } catch (error) {
        toast.error(error?.message || "Không thể xoá voucher khỏi database.");
      }
    });
};

const openEditVoucherDrawer = (code) => {
  voucherSelectedCode = code;
  const voucher = getSelectedVoucher();
  if (!voucher) return;
  openOwnerDrawer({
    title: `${icon("voucher")} Chỉnh sửa voucher`,
    label: "Chỉnh sửa voucher",
    bodyHtml: renderVoucherForm(voucher),
    onBind: (close) => bindVoucherForm(close),
  });
};

const openCreateVoucherDrawer = () => {
  document.getElementById("owner-create-drawer")?.remove();
  const drawer = document.createElement("div");
  drawer.className = "staff-profile-backdrop owner-drawer-backdrop";
  drawer.id = "owner-create-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", "Tạo voucher mới");
  drawer.innerHTML = `
    <aside class="staff-profile-panel owner-drawer-panel">
      <div class="staff-profile-header">
        <div class="staff-profile-title">${icon("cart")} Tạo voucher mới</div>
        <button class="modal-close" id="create-close" aria-label="Đóng">${icon("close")}</button>
      </div>
      <div class="staff-profile-body">
        <form class="owner-form" id="create-voucher-form">
          <div class="owner-form-grid">
            <div class="form-group">
              <label class="form-label" for="new-voucher-code">Mã</label>
              <input class="form-control" id="new-voucher-code" placeholder="VD: SUMMER20" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-type">Loại</label>
              <select class="form-control" id="new-voucher-type">
                <option value="percent">Phần trăm</option>
                <option value="fixed">Số tiền</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-value">Giá trị</label>
              <input class="form-control" id="new-voucher-value" type="number" min="0" value="0" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-min">Đơn tối thiểu</label>
              ${moneyInput("new-voucher-min", 0)}
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-start">Bắt đầu</label>
              ${segmentedDateTimeInput("new-voucher-start", "")}
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-exp">Kết thúc</label>
              ${segmentedDateTimeInput("new-voucher-exp", "2026-12-31T23:59")}
            </div>
            <div class="form-group">
              <label class="form-label" for="new-voucher-active">Trạng thái</label>
              <select class="form-control" id="new-voucher-active">
                <option value="active">Đang bật</option>
                <option value="inactive">Đang tắt</option>
              </select>
            </div>
            <div class="form-group owner-form-wide">
              <label class="form-label" for="new-voucher-desc">Mô tả</label>
              <input class="form-control" id="new-voucher-desc">
            </div>
          </div>
          <div class="staff-actions">
            <button class="btn btn-primary" id="create-voucher-save" type="submit">Tạo</button>
            <button class="btn btn-outline" id="create-cancel" type="button">Đóng</button>
          </div>
        </form>
      </div>
    </aside>
  `;
  document.body.appendChild(drawer);
  document.body.style.overflow = "hidden";

  const close = () => {
    drawer.classList.remove("active");
    document.body.style.overflow = "";
    setTimeout(() => drawer.remove(), 180);
  };

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) close();
  });
  document.getElementById("create-close")?.addEventListener("click", close);
  document.getElementById("create-cancel")?.addEventListener("click", close);
  bindSegmentedDateTimeInputs(drawer);
  document
    .getElementById("create-voucher-form")
    ?.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = document
        .getElementById("new-voucher-code")
        ?.value.trim()
        .toUpperCase();
      const value = Number(
        document.getElementById("new-voucher-value")?.value || 0,
      );
      const minOrder = Number(
        document.getElementById("new-voucher-min")?.value || 0,
      );
      const vouchers = getOwnerData().vouchers;
      if (
        !code ||
        !Number.isFinite(value) ||
        value < 0 ||
        !Number.isFinite(minOrder) ||
        minOrder < 0
      ) {
        toast.error("Thông tin voucher chưa hợp lệ.");
        return;
      }
      if (vouchers.some((v) => v.code === code)) {
        toast.error("Mã voucher đã tồn tại.");
        return;
      }
      const voucher = {
        code,
        type: document.getElementById("new-voucher-type")?.value || "fixed",
        value,
        minOrder,
        startsAt: getDateTimeValue("new-voucher-start"),
        expiresAt: getDateTimeValue("new-voucher-exp"),
        desc: document.getElementById("new-voucher-desc")?.value.trim() || "",
        active:
          (document.getElementById("new-voucher-active")?.value || "active") ===
          "active",
      };
      saveVouchers([...vouchers, voucher]);
      invalidateOwnerData();
      voucherSelectedCode = code;
      toast.success("Đã tạo voucher mới.");
      close();
      rerenderOwnerPage();
    });

  requestAnimationFrame(() => drawer.classList.add("active"));
};

export const bindVoucherPage = () => {
  document.querySelectorAll("[data-voucher-code]")?.forEach((el) => {
    el.addEventListener("click", () => {
      openEditVoucherDrawer(el.dataset.voucherCode);
    });
  });
  document.getElementById("owner-search")?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    voucherSheetPage = 1;
    scheduleRenderPage();
  });
  document.querySelectorAll("[data-voucher-sort-col]")?.forEach((btn) => {
    btn.addEventListener("click", () => {
      voucherSort = nextSort(voucherSort, btn.dataset.voucherSortCol);
      voucherSheetPage = 1;
      rerenderOwnerPage();
    });
  });
  document.getElementById("voucher-prev")?.addEventListener("click", () => {
    voucherSheetPage = Math.max(1, voucherSheetPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById("voucher-next")?.addEventListener("click", () => {
    voucherSheetPage += 1;
    rerenderOwnerPage();
  });
  document
    .getElementById("voucher-new")
    ?.addEventListener("click", openCreateVoucherDrawer);
};
