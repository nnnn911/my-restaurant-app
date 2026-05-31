import {
  OWNER_SHEET_PAGE_SIZE,
  deleteMonthlyCostOnline,
  escapeAttr,
  escapeHtml,
  formatPrice,
  getMonthlyCosts,
  getPagedRows,
  getSortState,
  icon,
  nextSort,
  openOwnerDrawer,
  openStaffConfirm,
  ownerPaginationHtml,
  rerenderOwnerPage,
  saveMonthlyCostOnline,
  scheduleRenderPage,
  sheetSortButton,
} from "./common.js";
import { getStaffActors } from "./staffData.js";
import { toast } from "../../ui/toast.js";
import {
  bindSegmentedMonthInputs,
  getMonthValue,
  segmentedMonthInput,
} from "../../ui/datetime.js";
import Chart from 'chart.js/auto';

let costSearch = "";
let costSort = "month-desc";
let costPage = 1;
let staffSalaryTotal = 0;
let staffSalaryLoaded = false;
let costChartSeq = 0;
let pendingCostCharts = [];
let mountedCostCharts = [];
let costBreakdownMonth = "";

const COST_FIELDS = [
  ["electricity", "Tiền điện"],
  ["water", "Tiền nước"],
  ["rent", "Thuê mặt bằng"],
  ["ingredients", "Tiền nguyên liệu"],
];

const currentMonth = () => new Date().toISOString().slice(0, 7);
const costTotal = (cost = {}) =>
  COST_FIELDS.reduce((sum, [key]) => sum + Number(cost[key] || 0), 0) +
  Number(cost.staffSalary || 0);

const loadStaffSalary = async () => {
  if (staffSalaryLoaded) return;
  try {
    const actors = await getStaffActors();
    staffSalaryTotal = actors.reduce(
      (sum, actor) => sum + Number(actor.salaryVnd || 0),
      0,
    );
  } catch {
    staffSalaryTotal = 0;
  } finally {
    staffSalaryLoaded = true;
  }
};

const filteredCosts = () => {
  const q = costSearch.trim().toLowerCase();
  return [...getMonthlyCosts()]
    .filter(
      (cost) =>
        !q ||
        `${cost.month} ${cost.note || ""} ${costTotal(cost)}`
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => {
      const { key, dir } = getSortState(costSort, "month");
      const direction = dir === "desc" ? -1 : 1;
      if (key === "total") return (costTotal(a) - costTotal(b)) * direction;
      if (key === "staffSalary")
        return (
          (Number(a.staffSalary || 0) - Number(b.staffSalary || 0)) * direction
        );
      return (a.month || "").localeCompare(b.month || "") * direction;
    });
};

const costBreakdownRows = (cost = {}) =>
  [
    ...COST_FIELDS.map(([key, label]) => ({
      label,
      value: Number(cost[key] || 0),
    })),
    { label: "Lương nhân viên", value: Number(cost.staffSalary || 0) },
  ].filter((row) => row.value > 0);

const resetCostCharts = () => {
  mountedCostCharts.forEach((chart) => chart.destroy());
  mountedCostCharts = [];
  pendingCostCharts = [];
  costChartSeq = 0;
};

const costChartHtml = ({ type, rows, valueKey, labelKey, height = 280 }) => {
  if (!rows.length)
    return `<div class="empty-state"><h3>Chưa có dữ liệu</h3></div>`;
  const id = `cost-chart-${(costChartSeq += 1)}`;
  pendingCostCharts.push({ id, type, rows, valueKey, labelKey });
  return `
    <div class="owner-chart owner-chartjs" style="height:${height}px">
      <canvas id="${id}" role="img" aria-label="${type === "doughnut" ? "Biểu đồ cơ cấu chi phí" : "Biểu đồ chi phí theo tháng"}"></canvas>
    </div>
  `;
};

const mountCostCharts = () => {
  mountedCostCharts.forEach((chart) => chart.destroy());
  mountedCostCharts = [];
  const style = getComputedStyle(document.documentElement);
  const colors = {
    primary: style.getPropertyValue("--color-primary-600").trim() || "#1f5c25",
    accent: style.getPropertyValue("--color-accent-400").trim() || "#f59e0b",
    blue: "#2563eb",
    red: "#dc2626",
    purple: "#7c3aed",
    text: style.getPropertyValue("--color-text").trim() || "#1f2937",
    muted: style.getPropertyValue("--color-text-muted").trim() || "#6b7280",
    border: style.getPropertyValue("--color-border").trim() || "#e5e7eb",
    surface: style.getPropertyValue("--color-surface").trim() || "#ffffff",
  };
  const palette = [
    colors.primary,
    colors.accent,
    colors.blue,
    colors.red,
    colors.purple,
  ];

  pendingCostCharts.forEach((spec) => {
    const canvas = document.getElementById(spec.id);
    if (!canvas) return;
    const labels = spec.rows.map((row) => row[spec.labelKey]);
    const values = spec.rows.map((row) => Number(row[spec.valueKey] || 0));
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: spec.type === "doughnut",
          position: "right",
          labels: {
            color: colors.text,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: colors.surface,
          titleColor: colors.text,
          bodyColor: colors.text,
          borderColor: colors.border,
          borderWidth: 1,
          callbacks: { label: (item) => formatPrice(Number(item.raw || 0)) },
        },
      },
    };
    const config =
      spec.type === "doughnut"
        ? {
            type: "doughnut",
            data: {
              labels,
              datasets: [
                {
                  data: values,
                  backgroundColor: labels.map(
                    (_, idx) => palette[idx % palette.length],
                  ),
                  borderColor: colors.surface,
                  borderWidth: 3,
                },
              ],
            },
            options: { ...baseOptions, cutout: "62%" },
          }
        : {
            type: "bar",
            data: {
              labels,
              datasets: [
                {
                  data: values,
                  backgroundColor: colors.accent,
                  borderColor: colors.primary,
                  borderWidth: 1,
                  borderRadius: 6,
                },
              ],
            },
            options: {
              ...baseOptions,
              plugins: { ...baseOptions.plugins, legend: { display: false } },
              scales: {
                x: {
                  grid: { color: colors.border },
                  ticks: { color: colors.muted, font: { weight: "600" } },
                },
                y: {
                  beginAtZero: true,
                  grid: { color: colors.border },
                  ticks: {
                    color: colors.muted,
                    callback: (value) =>
                      formatPrice(Number(value)).replace(/\s?₫$/, ""),
                  },
                },
              },
            },
          };
    mountedCostCharts.push(new Chart(canvas.getContext("2d"), config));
  });
};

const costBarsHtml = (costs) => {
  const rows = costs.slice().reverse();
  return costChartHtml({
    type: "bar",
    rows: rows.map((cost) => ({ month: cost.month, total: costTotal(cost) })),
    valueKey: "total",
    labelKey: "month",
  });
};

const breakdownBarsHtml = (cost) => {
  const rows = costBreakdownRows(cost);
  return costChartHtml({
    type: "doughnut",
    rows,
    valueKey: "value",
    labelKey: "label",
  });
};

export const renderCostsPage = () => {
  resetCostCharts();
  if (!staffSalaryLoaded) loadStaffSalary().then(rerenderOwnerPage);
  const costs = filteredCosts();
  const paged = getPagedRows(costs, costPage, OWNER_SHEET_PAGE_SIZE);
  costPage = paged.page;
  const latest = costs[0] || null;
  if (!costBreakdownMonth && latest?.month) costBreakdownMonth = latest.month;
  const breakdownCost =
    costs.find((cost) => cost.month === costBreakdownMonth) || latest;
  if (breakdownCost) costBreakdownMonth = breakdownCost.month;
  const monthOptions = costs.map((cost) => cost.month);

  return `
    <div class="owner-page owner-analytics-page owner-costs-page">
      <div class="staff-grid staff-grid--manage owner-sheet-grid">
        <section class="staff-panel" aria-label="Quản lý chi phí">
          <div class="staff-panel-header owner-menu-header">
            <div class="owner-menu-header-row">
              <div class="search-bar owner-sheet-search">
                <span class="search-icon" aria-hidden="true">${icon("search")}</span>
                <input type="search" id="cost-search" placeholder="Tìm tháng, ghi chú..." value="${escapeAttr(costSearch)}">
              </div>
              <button class="btn btn-primary" id="cost-create" type="button">${icon("addpeople")} Thêm chi phí tháng</button>
            </div>
          </div>
          <div class="staff-panel-body owner-sheet-body owner-costs-sheet-body">
            <div class="owner-table-wrap">
              <table class="owner-table owner-spreadsheet">
                <thead><tr><th>${sheetSortButton("data-cost-sort", costSort, "month", "Tháng")}</th><th>Điện</th><th>Nước</th><th>Mặt bằng</th><th>Nguyên liệu</th><th>${sheetSortButton("data-cost-sort", costSort, "staffSalary", "Lương NV")}</th><th>${sheetSortButton("data-cost-sort", costSort, "total", "Tổng")}</th></tr></thead>
                <tbody>${paged.rows.map((cost) => `<tr data-cost-month="${escapeAttr(cost.month)}"><td>${escapeHtml(cost.month)}</td><td>${formatPrice(cost.electricity)}</td><td>${formatPrice(cost.water)}</td><td>${formatPrice(cost.rent)}</td><td>${formatPrice(cost.ingredients)}</td><td>${formatPrice(cost.staffSalary)}</td><td>${formatPrice(costTotal(cost))}</td></tr>`).join("") || `<tr><td colspan="7"><div class="empty-state"><h3>Chưa có chi phí</h3></div></td></tr>`}</tbody>
              </table>
            </div>
            <div class="owner-panel-pagination">
              ${ownerPaginationHtml({ total: costs.length, page: costPage, pageCount: paged.pageCount, label: "tháng", prevId: "cost-prev", nextId: "cost-next" })}
            </div>
          </div>
        </section>
      </div>
      <div class="owner-analytics-grid">
        <section class="staff-panel"><div class="staff-panel-header"><div class="staff-panel-title">Tổng chi phí theo tháng</div></div><div class="staff-panel-body">${costs.length ? costBarsHtml(costs) : `<div class="empty-state"><h3>Chưa có dữ liệu</h3></div>`}</div></section>
        <section class="staff-panel"><div class="staff-panel-header owner-menu-header"><div class="staff-panel-title">Cơ cấu chi phí ${escapeHtml(breakdownCost?.month || "")}</div>${monthOptions.length ? `<div class="owner-menu-header-row"><label class="sr-only" for="cost-breakdown-month">Tháng cơ cấu chi phí</label>${segmentedMonthInput("cost-breakdown-month", costBreakdownMonth)}</div>` : ""}</div><div class="staff-panel-body">${breakdownCost ? breakdownBarsHtml(breakdownCost) : `<div class="empty-state"><h3>Chưa có dữ liệu</h3></div>`}</div></section>
      </div>
    </div>
  `;
};

const renderCostForm = (cost = null) => `
  <form class="owner-form" id="cost-form">
    <div class="owner-form-grid">
      <div class="form-group"><label class="form-label" for="cost-month">Tháng</label>${segmentedMonthInput("cost-month", cost?.month || currentMonth())}</div>
      ${COST_FIELDS.map(([key, label]) => `<div class="form-group"><label class="form-label" for="cost-${key}">${escapeHtml(label)}</label><input class="form-control" id="cost-${key}" type="number" min="0" step="1" value="${Number(cost?.[key] || 0)}"></div>`).join("")}
      <div class="form-group"><label class="form-label">Lương nhân viên</label><div class="owner-points-box">${formatPrice(staffSalaryTotal)}</div></div>
      <div class="form-group owner-detail-grid-wide"><label class="form-label" for="cost-note">Ghi chú</label><input class="form-control" id="cost-note" value="${escapeAttr(cost?.note || "")}"></div>
    </div>
    <div class="staff-actions">
      <button class="btn btn-primary" id="cost-save" type="submit">${icon("pen")} Lưu chi phí</button>
      ${cost ? `<button class="btn btn-danger" id="cost-delete" type="button">${icon("trashcan")} Xoá</button>` : ""}
    </div>
  </form>
`;

const openCostDrawer = (cost = null) =>
  openOwnerDrawer({
    title: `${icon(cost ? "pen" : "addpeople")} ${cost ? "Sửa chi phí tháng" : "Thêm chi phí tháng"}`,
    label: "Chi phí tháng",
    bodyHtml: renderCostForm(cost),
    onBind: (close) => bindCostForm(close, cost),
  });

const bindCostForm = (close, cost = null) => {
  bindSegmentedMonthInputs(document.getElementById("cost-form") || document);
  document
    .getElementById("cost-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("cost-save");
      saveBtn.disabled = true;
      try {
        await saveMonthlyCostOnline({
          month: getMonthValue("cost-month") || currentMonth(),
          electricity: Number(
            document.getElementById("cost-electricity")?.value || 0,
          ),
          water: Number(document.getElementById("cost-water")?.value || 0),
          rent: Number(document.getElementById("cost-rent")?.value || 0),
          ingredients: Number(
            document.getElementById("cost-ingredients")?.value || 0,
          ),
          staffSalary: staffSalaryTotal,
          note: document.getElementById("cost-note")?.value || "",
        });
        toast.success("Đã lưu chi phí tháng.");
        close?.();
        rerenderOwnerPage();
      } catch (error) {
        toast.error(error?.message || "Không thể lưu chi phí.");
        saveBtn.disabled = false;
      }
    });
  document
    .getElementById("cost-delete")
    ?.addEventListener("click", async () => {
      if (!cost) return;
      const ok = await openStaffConfirm({
        title: "Xoá chi phí",
        message: `Xoá chi phí tháng ${cost.month}?`,
        confirmText: "Xoá",
        danger: true,
      });
      if (!ok) return;
      await deleteMonthlyCostOnline(cost.month);
      toast.success("Đã xoá chi phí tháng.");
      close?.();
      rerenderOwnerPage();
    });
};

export const bindCostsPage = () => {
  mountCostCharts();
  bindSegmentedMonthInputs(document);
  const breakdownMonthInput = document.getElementById("cost-breakdown-month");
  if (breakdownMonthInput) {
    const updateBreakdownMonth = () => {
      costBreakdownMonth = getMonthValue("cost-breakdown-month");
      rerenderOwnerPage();
    };
    breakdownMonthInput.addEventListener("change", updateBreakdownMonth);
    breakdownMonthInput._flatpickr?.config.onChange.push(updateBreakdownMonth);
    breakdownMonthInput._flatpickr?.config.onClose.push(updateBreakdownMonth);
  }
  document
    .getElementById("cost-create")
    ?.addEventListener("click", () => openCostDrawer());
  document.querySelectorAll("[data-cost-month]")?.forEach((row) =>
    row.addEventListener("click", () => {
      const cost = getMonthlyCosts().find(
        (item) => item.month === row.dataset.costMonth,
      );
      if (cost) openCostDrawer(cost);
    }),
  );
  document.getElementById("cost-search")?.addEventListener("input", (e) => {
    costSearch = e.target.value;
    costPage = 1;
    scheduleRenderPage();
  });
  document.querySelectorAll("[data-cost-sort]")?.forEach((btn) =>
    btn.addEventListener("click", () => {
      costSort = nextSort(costSort, btn.dataset.costSort);
      costPage = 1;
      rerenderOwnerPage();
    }),
  );
  document.getElementById("cost-prev")?.addEventListener("click", () => {
    costPage = Math.max(1, costPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById("cost-next")?.addEventListener("click", () => {
    costPage += 1;
    rerenderOwnerPage();
  });
};
