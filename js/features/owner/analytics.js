import {
  CATEGORY_LABELS,
  formatDateTimeValue,
  getOwnerData,
  openOwnerDrawer,
  parseDate,
  getSortState,
  getPagedRows,
  nextSort,
  sheetSortButton,
  ownerPaginationTableFooterHtml,
  scheduleRenderPage,
  rerenderOwnerPage,
  formatPrice,
  getOrders,
  icon,
  escapeAttr,
  escapeHtml
} from './common.js';
import { getReservations } from '../../data/store.js';
import { toast } from '../../ui/toast.js';

let analyticsRange = '7d';
let analyticsCustomStart = '';
let analyticsCustomEnd = '';
let reportTab = 'revenue';
let reportGroupBy = 'day';
let recentOrderSort = 'createdAt-desc';
let revenueSort = 'date-desc';
let revenueSheetPage = 1;
let menuItemSort = 'qty-desc';
let menuItemSearch = '';
let menuCategoryFilter = 'all';
let menuItemSheetPage = 1;
let orderSheetSearch = '';
let orderStatusFilter = 'all';
let orderTypeFilter = 'all';
let orderPaymentFilter = 'all';
let orderSheetSort = 'createdAt-desc';
let orderSheetPage = 1;
let analyticsFirstPaint = true;
let analyticsCustomMenuOpen = false;
let reportScrollRenderTimer = null;
const ORDER_PAGE_SIZE = 10;
const REPORT_SHEET_PAGE_SIZE = 20;

const ORDER_STATUS = {
  pending: { label: 'Chờ xác nhận', className: 'badge-warning' },
  placed: { label: 'Đã đặt', className: 'badge-primary' },
  paid: { label: 'Đã thanh toán', className: 'badge-success' },
  confirmed: { label: 'Đã xác nhận', className: 'badge-primary' },
  preparing: { label: 'Đang làm', className: 'badge-warning' },
  ready: { label: 'Sẵn sàng', className: 'badge-success' },
  shipping: { label: 'Đang giao', className: 'badge-primary' },
  delivered: { label: 'Hoàn thành', className: 'badge-primary' },
  done: { label: 'Hoàn thành', className: 'badge-primary' },
  preorder: { label: 'Đặt trước', className: 'badge-accent' },
  cancelled: { label: 'Đã huỷ', className: 'badge-danger' },
};

const PAYMENT_LABELS = {
  cash: 'Tiền mặt',
  bank: 'Chuyển khoản',
  momo: 'Momo',
  vnpay: 'VNPay',
  preorder: 'Đặt trước',
};

const ORDER_TYPE_LABELS = {
  order: 'Order',
  preorder: 'Preorder',
  pos: 'POS',
};

const SUCCESS_REVENUE_STATUSES = new Set(['delivered', 'done']);

const pad2 = (n) => String(n).padStart(2, '0');
const toInputDate = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
const dayKey = (date) => toInputDate(date);
const monthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
const weekKey = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return `Tuần ${toInputDate(d)}`;
};
const shortDate = (value) => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '—';
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const startOfBucket = (date, mode = 'day') => {
  const d = new Date(date);
  if (mode === 'hour') {
    d.setMinutes(0, 0, 0);
    return d;
  }
  d.setHours(0, 0, 0, 0);
  if (mode === 'week') {
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
  } else if (mode === 'month') {
    d.setDate(1);
  }
  return d;
};

const chartDateLabel = (date, mode = 'day') => {
  const d = parseDate(date);
  if (!d) return '—';
  if (mode === 'hour') return `${pad2(d.getHours())}:00, ${d.toLocaleDateString('vi-VN')}`;
  if (mode === 'month') return d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
  return d.toLocaleDateString('vi-VN');
};

const chartAxisDateLabel = (date, mode = 'day') => {
  const d = parseDate(date);
  if (!d) return '—';
  if (mode === 'hour') return `${pad2(d.getHours())}:00`;
  if (mode === 'month') return d.toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const formatReservationDate = (value) => {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('vi-VN') : value || '—';
};

const getReservationCategory = (reservation = {}) => {
  const type = (reservation.type || '').toString();
  if (type.startsWith('ga-')) return 'ga';
  if (type.startsWith('vit-')) return 'vit';
  return 'com';
};

const getOrderType = (order = {}) => {
  if (/^RES-/.test((order?.id || '').toString())) return 'preorder';
  const source = (order.source || '').toString().toLowerCase();
  if (source === 'pos') return 'pos';
  if (source === 'preorder' || order.status === 'preorder' || order.paymentMethod === 'preorder') return 'preorder';
  if ((order.userId || '').toString().startsWith('staff:') || /tại quán/i.test(order.address || '')) return 'pos';
  return 'order';
};

const isPosRecord = (order = {}) =>
  order.type === 'pos'
  || (order.source || '').toString().toLowerCase() === 'pos'
  || /^POS-/.test((order.id || '').toString());

const isRevenueRecord = (order = {}) => {
  const status = (order.status || '').toString();
  if (SUCCESS_REVENUE_STATUSES.has(status)) return true;
  return isPosRecord(order) && status !== 'cancelled';
};

const getRevenueRecords = (orders = []) => orders.filter(isRevenueRecord);

const orderItemsSummary = (order) => {
  const itemsText = order.items.map((item) => `${item.name} x${item.qty}`).join(', ');
  return `${order.itemQty.toLocaleString('vi-VN')} món${itemsText ? `: ${itemsText}` : ''}`;
};

const getStatusMeta = (status) => ORDER_STATUS[(status || '').toString()] || { label: status || 'Chưa rõ', className: 'badge-muted' };
const statusBadge = (status) => {
  const meta = getStatusMeta(status);
  return `<span class="badge ${meta.className}">${escapeHtml(meta.label)}</span>`;
};

const compareText = (a, b) => (a || '').toString().localeCompare((b || '').toString(), 'vi', { numeric: true });

const getContributionPercent = (revenue, totalRevenue) => totalRevenue ? Math.round((revenue / totalRevenue) * 100) : 0;

const resetReportSheetPages = () => {
  revenueSheetPage = 1;
  menuItemSheetPage = 1;
};

const rerenderReportsPreservingScroll = () => {
  const x = window.scrollX;
  const y = window.scrollY;
  rerenderOwnerPage();
  requestAnimationFrame(() => window.scrollTo(x, y));
};

const scheduleReportsRenderPreservingScroll = () => {
  const x = window.scrollX;
  const y = window.scrollY;
  window.clearTimeout(reportScrollRenderTimer);
  reportScrollRenderTimer = window.setTimeout(() => {
    rerenderOwnerPage();
    requestAnimationFrame(() => window.scrollTo(x, y));
  }, 180);
};

const normalizeOrder = (order = {}) => {
  const createdAt = parseDate(order.createdAt) || new Date(0);
  const items = Array.isArray(order.items) ? order.items : [];
  const total = Number(order.total || 0);
  return {
    ...order,
    createdAt,
    type: getOrderType(order),
    items,
    itemQty: items.reduce((sum, item) => sum + Number(item.qty || 0), 0),
    total: Number.isFinite(total) ? total : 0,
    discount: Number(order.discount || 0),
    paymentMethod: order.paymentMethod || 'cash',
    status: order.status || 'paid',
  };
};

const normalizeReservation = (reservation = {}) => {
  const createdAt = parseDate(reservation.createdAt) || new Date(0);
  const qty = Number(reservation.qty || 0);
  const price = Number(reservation.price || 0);
  const total = Number(reservation.total);
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
  const safePrice = Number.isFinite(price) && price >= 0 ? price : 0;
  const safeTotal = Number.isFinite(total) && total >= 0 ? total : safePrice * safeQty;
  const itemName = reservation.itemName || reservation.type || 'Đơn đặt trước';
  const reservationDate = reservation.date || '';
  return {
    ...reservation,
    source: 'preorder',
    type: 'preorder',
    createdAt,
    customerName: reservation.name || 'Khách hàng',
    customerPhone: reservation.phone || '',
    address: reservationDate ? `Ngày cần: ${formatReservationDate(reservationDate)}` : 'Đơn đặt trước',
    paymentMethod: 'preorder',
    status: reservation.status || 'pending',
    subtotal: safeTotal,
    total: safeTotal,
    discount: 0,
    items: [{
      id: reservation.type || reservation.id,
      name: itemName,
      category: getReservationCategory(reservation),
      qty: safeQty,
      price: safePrice,
      note: reservation.note || '',
    }],
    itemQty: safeQty,
    reservationDate,
  };
};

const getNormalizedBusinessRecords = () => [
  ...getOrders().map(normalizeOrder),
  ...getReservations().map(normalizeReservation),
];

const getDateRange = () => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (analyticsRange === 'all') return { start: new Date(0), end, label: 'Tất cả' };
  if (analyticsRange === 'today') return { start, end, label: 'Hôm nay' };
  if (analyticsRange === '30d') {
    start.setDate(start.getDate() - 29);
    return { start, end, label: '30 ngày qua' };
  }
  if (analyticsRange === 'custom') {
    const customStart = parseDate(analyticsCustomStart);
    const customEnd = parseDate(analyticsCustomEnd);
    const s = customStart || start;
    const e = customEnd || end;
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e, label: 'Tuỳ chỉnh' };
  }
  start.setDate(start.getDate() - 6);
  return { start, end, label: '7 ngày qua' };
};

const getAnalyticsOrders = () => {
  const { start, end } = getDateRange();
  return getNormalizedBusinessRecords()
    .filter((order) => order.createdAt >= start && order.createdAt <= end)
    .sort((a, b) => b.createdAt - a.createdAt);
};

const getAllAnalyticsOrders = () => getNormalizedBusinessRecords()
  .sort((a, b) => b.createdAt - a.createdAt);

const getOrderItems = (orders) => {
  const menuById = new Map(getOwnerData().menu.map((item) => [item.id, item]));
  const map = new Map();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const key = item.id || item.name;
      const menuItem = menuById.get(item.id) || {};
      const row = map.get(key) || {
        id: key,
        name: item.name || menuItem.name || 'Món chưa đặt tên',
        category: menuItem.category || item.category || 'com',
        qty: 0,
        revenue: 0,
      };
      const qty = Number(item.qty || 0);
      row.qty += qty;
      row.revenue += Number(item.price || menuItem.price || 0) * qty;
      map.set(key, row);
    });
  });
  return [...map.values()];
};

const getAnalyticsSummary = (orders) => {
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const itemQty = orders.reduce((sum, order) => sum + order.itemQty, 0);
  const items = getOrderItems(orders);
  const topItem = [...items].sort((a, b) => b.qty - a.qty)[0];
  const topRevenueItem = [...items].sort((a, b) => b.revenue - a.revenue)[0];
  return {
    revenue,
    orders: orders.length,
    itemQty,
    topItem,
    topRevenueItem,
    avgOrder: orders.length ? Math.round(revenue / orders.length) : 0,
  };
};

const customRangeLabel = () => {
  if (analyticsRange !== 'custom' || !analyticsCustomStart || !analyticsCustomEnd) return 'Tuỳ chỉnh';
  return `${shortDate(analyticsCustomStart)} - ${shortDate(analyticsCustomEnd)}`;
};

const rangeCaptionHtml = () => {
  const { start, end, label } = getDateRange();
  const detail = analyticsRange === 'all'
    ? 'Toàn bộ dữ liệu đơn hàng'
    : `${start.toLocaleDateString('vi-VN')} - ${end.toLocaleDateString('vi-VN')}`;
  return `<div class="owner-range-caption">Đang xem: <strong>${escapeHtml(label)}</strong><span>${escapeHtml(detail)}</span></div>`;
};

const timeFilterHtml = ({ includeAll = false } = {}) => {
  const range = getDateRange();
  const quick = [
    ...(includeAll ? [['all', 'Tất cả'], ['today', 'Hôm nay']] : [['today', 'Hôm nay']]),
    ['7d', '7 ngày qua'],
    ['30d', '30 ngày qua'],
  ];
  return `
    <div class="owner-analytics-filter" aria-label="Bộ lọc thời gian">
      <div class="owner-chip-row">
        ${quick.map(([id, label]) => `<button class="chip${analyticsRange === id ? ' active' : ''}" data-range="${id}" type="button">${label}</button>`).join('')}
        <div class="owner-custom-filter">
          <button class="chip owner-custom-filter-btn${analyticsRange === 'custom' ? ' active' : ''}" data-range-custom-toggle type="button">
            <span>${escapeHtml(customRangeLabel())}</span>
            <img src="assets/icons/chevron.svg" alt="" aria-hidden="true">
          </button>
          ${analyticsCustomMenuOpen ? `
            <div class="owner-custom-filter-menu" role="menu">
              <label>Ngày bắt đầu<input class="form-control" id="analytics-start" type="date" value="${escapeAttr(analyticsCustomStart || toInputDate(range.start))}"></label>
              <label>Ngày kết thúc<input class="form-control" id="analytics-end" type="date" value="${escapeAttr(analyticsCustomEnd || toInputDate(range.end))}"></label>
              <button class="btn btn-primary btn-sm" id="analytics-apply-custom" type="button">Áp dụng</button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

const metricCardsHtml = (cards) => `
  <div class="owner-metric-grid">
    ${cards.map((card) => `
      <article class="owner-metric">
        <div class="owner-metric-label">${escapeHtml(card.label)}</div>
        <div class="owner-metric-value">${card.value}</div>
        ${card.note ? `<div class="owner-metric-note">${escapeHtml(card.note)}</div>` : ''}
      </article>
    `).join('')}
  </div>
`;

export const renderAnalyticsSkeletonPage = (showFilter = false) => `
  <div class="owner-page owner-analytics-page">
    ${showFilter ? `<div class="owner-toolbar owner-toolbar--filter-only">${timeFilterHtml()}</div>` : ''}
    <div class="owner-metric-grid">
      ${Array.from({ length: 5 }).map(() => `<div class="owner-loading-block"><div class="skeleton" style="height:14px;width:44%;margin-bottom:18px"></div><div class="skeleton" style="height:30px;width:78%;margin-bottom:10px"></div><div class="skeleton" style="height:12px;width:58%"></div></div>`).join('')}
    </div>
    <div class="owner-analytics-grid">
      <div class="owner-loading-block"><div class="skeleton" style="height:220px;width:100%"></div></div>
      <div class="owner-loading-block"><div class="skeleton" style="height:220px;width:100%"></div></div>
    </div>
    <div class="owner-loading-block"><div class="skeleton" style="height:280px;width:100%"></div></div>
  </div>
`;

const aggregateBy = (orders, mode) => {
  const map = new Map();
  orders.forEach((order) => {
    const d = startOfBucket(order.createdAt, mode);
    const key = mode === 'hour' ? `${dayKey(d)} ${pad2(d.getHours())}:00` : mode === 'week' ? weekKey(d) : mode === 'month' ? monthKey(d) : dayKey(d);
    const label = mode === 'hour' ? `${pad2(d.getHours())}:00` : key;
    const row = map.get(key) || { label, orders: 0, itemQty: 0, revenue: 0, date: d };
    row.orders += 1;
    row.itemQty += order.itemQty;
    row.revenue += order.total;
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => a.date - b.date);
};

const completeChartRows = (rows, mode, range) => {
  if (!range || !['hour', 'day'].includes(mode)) return rows;
  const start = startOfBucket(range.start, mode);
  const end = startOfBucket(range.end, mode);
  const stepMs = mode === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const bucketCount = Math.floor((end - start) / stepMs) + 1;
  if (bucketCount < 1 || bucketCount > 370) return rows;
  const byTime = new Map(rows.map((row) => [startOfBucket(row.date, mode).getTime(), row]));
  return Array.from({ length: bucketCount }, (_, idx) => {
    const date = new Date(start.getTime() + idx * stepMs);
    const key = date.getTime();
    return byTime.get(key) || {
      label: mode === 'hour' ? `${pad2(date.getHours())}:00` : dayKey(date),
      orders: 0,
      itemQty: 0,
      revenue: 0,
      date,
    };
  });
};

const getChartDomain = (rows, mode, range) => {
  if (range && range.start && range.end && range.start.getFullYear() > 1970) {
    return {
      start: startOfBucket(range.start, mode),
      end: startOfBucket(range.end, mode),
    };
  }
  const dates = rows.map((row) => startOfBucket(row.date, mode).getTime()).filter(Number.isFinite);
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  return {
    start: new Date(min),
    end: new Date(max),
  };
};

const chartXAxisTicks = (domain, mode) => {
  const start = domain.start.getTime();
  const end = domain.end.getTime();
  const span = Math.max(end - start, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const daySpan = mode === 'hour' ? 0 : Math.round(span / dayMs) + 1;
  if (mode === 'hour') {
    const count = 7;
    return Array.from({ length: count }, (_, idx) => {
      const time = start + (span * idx) / (count - 1 || 1);
      const d = startOfBucket(new Date(time), 'hour');
      return { date: d, label: chartAxisDateLabel(d, mode) };
    });
  }
  if (daySpan > 7) {
    return Array.from({ length: 7 }, (_, idx) => {
      const offsetDays = Math.round(((daySpan - 1) * idx) / 6);
      const d = new Date(start + offsetDays * dayMs);
      return { date: d, label: chartAxisDateLabel(d, mode) };
    });
  }
  return Array.from({ length: Math.max(daySpan, 1) }, (_, idx) => {
    const d = new Date(start + idx * dayMs);
    return { date: d, label: chartAxisDateLabel(d, mode) };
  });
};

const lineChartHtml = (rows, valueKey = 'revenue', { showLegend = true, showAxes = false, mode = 'day', range = null } = {}) => {
  const width = 720;
  const height = 240;
  const padLeft = showAxes ? 22 : 20;
  const padRight = 18;
  const padTop = 16;
  const padBottom = showAxes ? 34 : 20;
  if (!rows.length) return `<div class="owner-chart-empty empty-state"><h3>Chưa có dữ liệu</h3><p>Thử chọn khoảng thời gian khác.</p></div>`;
  const chartRows = completeChartRows(rows, mode, range);
  const domain = getChartDomain(chartRows, mode, range);
  const domainStart = domain.start.getTime();
  const domainEnd = domain.end.getTime();
  const domainSpan = Math.max(domainEnd - domainStart, 1);
  const max = Math.max(...chartRows.map((r) => Number(r[valueKey] || 0)), 1);
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const xForDate = (date) => padLeft + ((startOfBucket(date, mode).getTime() - domainStart) / domainSpan) * plotWidth;
  const xTicks = chartXAxisTicks(domain, mode).map((tick) => ({
    ...tick,
    x: xForDate(tick.date),
  }));
  const points = chartRows.map((r) => {
    const x = clamp(xForDate(r.date), padLeft, width - padRight);
    const y = height - padBottom - (Number(r[valueKey] || 0) / max) * plotHeight;
    const value = Number(r[valueKey] || 0);
    const displayValue = valueKey === 'revenue' ? formatPrice(value) : value.toLocaleString('vi-VN');
    const tooltipWidth = 164;
    const tooltipHeight = 50;
    const tooltipX = clamp(x - tooltipWidth / 2, padLeft, width - padRight - tooltipWidth);
    const tooltipY = y > padTop + tooltipHeight + 16 ? y - tooltipHeight - 14 : y + 16;
    return { ...r, x, y, displayValue, tooltipX, tooltipY, tooltipWidth, tooltipHeight };
  });
  return `
    <div class="owner-chart owner-line-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ doanh thu theo thời gian">
        ${showAxes ? `
          <line class="owner-axis" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}"></line>
          ${xTicks.map((tick) => `
            <line class="owner-axis-tick" x1="${tick.x}" y1="${height - padBottom}" x2="${tick.x}" y2="${height - padBottom + 5}"></line>
            <text class="owner-axis-label owner-axis-label-x" x="${tick.x}" y="${height - 14}" text-anchor="middle">${escapeHtml(tick.label)}</text>
          `).join('')}
        ` : ''}
        <polyline points="${points.map((p) => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="var(--color-primary-600)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${points.map((p) => `
          <g class="owner-chart-point" tabindex="0" aria-label="${escapeAttr(`${chartDateLabel(p.date, mode)}: ${p.displayValue}`)}">
            <line class="owner-chart-hover-line" x1="${p.x}" y1="${padTop}" x2="${p.x}" y2="${height - padBottom}"></line>
            <circle class="owner-chart-hit" cx="${p.x}" cy="${p.y}" r="16"></circle>
            <circle class="owner-chart-dot" cx="${p.x}" cy="${p.y}" r="5"></circle>
            <g class="owner-chart-tooltip" transform="translate(${p.tooltipX} ${p.tooltipY})">
              <rect width="${p.tooltipWidth}" height="${p.tooltipHeight}" rx="7"></rect>
              <text class="owner-chart-tooltip-date" x="12" y="19">${escapeHtml(chartDateLabel(p.date, mode))}</text>
              <text class="owner-chart-tooltip-value" x="12" y="38">${escapeHtml(p.displayValue)}</text>
            </g>
          </g>
        `).join('')}
      </svg>
      ${showLegend ? '<div class="owner-chart-legend"><span class="owner-legend-dot primary"></span>Doanh thu</div>' : ''}
    </div>
  `;
};

const barChartHtml = (rows, {
  horizontal = false,
  valueKey = 'revenue',
  labelKey = 'label',
  money = true,
  showLegend = true,
  mono = false,
  valueInLabel = false,
  hideValue = false,
  labelsOnBar = false,
  singleBar = false,
} = {}) => {
  if (!rows.length) return `<div class="owner-chart-empty empty-state"><h3>Chưa có dữ liệu</h3><p>Không có mục nào phù hợp bộ lọc.</p></div>`;
  const max = Math.max(...rows.map((r) => Number(r[valueKey] || 0)), 1);
  return `
    <div class="owner-bars${horizontal ? ' owner-bars--horizontal' : ''}${mono ? ' owner-bars--mono' : ''}${valueInLabel ? ' owner-bars--with-label-value' : ''}${hideValue ? ' owner-bars--hide-value' : ''}${labelsOnBar ? ' owner-bars--labels-on-bar' : ''}${singleBar ? ' owner-bars--single-bar' : ''}" role="img" aria-label="Biểu đồ cột">
      ${rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        const pct = Math.max(3, Math.round((value / max) * 100));
        const display = money ? formatPrice(value) : value.toLocaleString('vi-VN');
        const label = row[labelKey];
        return `
          <div class="owner-bar-row" title="${escapeAttr(label)}: ${escapeAttr(display)}">
            ${labelsOnBar ? '' : `<div class="owner-bar-label"><span>${escapeHtml(label)}</span>${valueInLabel ? `<small>${escapeHtml(display)}</small>` : ''}</div>`}
            ${hideValue ? '' : `<div class="owner-bar-value">${escapeHtml(display)}</div>`}
            <div class="owner-bar-track">
              <span style="${horizontal ? `width:${pct}%` : `height:${pct}%`}"></span>
              ${labelsOnBar ? `<em class="owner-bar-overlay-label">${escapeHtml(label)}</em>` : ''}
            </div>
          </div>
        `;
      }).join('')}
      ${showLegend ? `<div class="owner-chart-legend"><span class="owner-legend-dot accent"></span>${money ? 'Doanh thu' : 'Số lượng'}</div>` : ''}
    </div>
  `;
};

const donutChartHtml = (rows, { valueKey = 'revenue', labelKey = 'label', money = true } = {}) => {
  const total = rows.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  if (!total) return `<div class="owner-chart-empty empty-state"><h3>Chưa có dữ liệu</h3><p>Không có phần doanh thu để hiển thị.</p></div>`;
  const colors = ['#1f5c25', '#d97706', '#2563eb', '#dc2626', '#7c3aed'];
  let acc = 0;
  const stops = rows.map((row, idx) => {
    const start = acc;
    acc += (Number(row[valueKey] || 0) / total) * 100;
    return `${colors[idx % colors.length]} ${start}% ${acc}%`;
  }).join(', ');
  return `
    <div class="owner-donut-wrap">
      <div class="owner-donut" style="background:conic-gradient(${stops})" role="img" aria-label="Biểu đồ donut"></div>
      <div class="owner-donut-legend">
        ${rows.map((row, idx) => {
          const value = Number(row[valueKey] || 0);
          const display = money ? formatPrice(value) : value.toLocaleString('vi-VN');
          return `<div title="${escapeAttr(row[labelKey])}: ${escapeAttr(display)}"><span style="background:${colors[idx % colors.length]}"></span><em>${escapeHtml(row[labelKey])}</em><small>${escapeHtml(display)}</small><strong>${Math.round((value / total) * 100)}%</strong></div>`;
        }).join('')}
      </div>
    </div>
  `;
};

const openOrderDetailDrawer = (id) => {
  const order = getAllAnalyticsOrders().find((item) => item.id === id);
  if (!order) return;
  const valueOrDash = (value) => {
    if (value === null || value === undefined || value === '') return '—';
    return value;
  };
  const boolLabel = (value) => value ? 'Có' : 'Không';
  const sourceLabel = ORDER_TYPE_LABELS[order.type] || order.source || order.type || 'order';
  openOwnerDrawer({
    title: `${icon('order')} Chi tiết đơn ${escapeHtml(order.id)}`,
    label: 'Chi tiết đơn hàng',
    bodyHtml: `
      <div class="owner-order-detail">
        <section class="owner-detail-section">
          <div class="owner-detail-section-title">Tổng quan</div>
          <div class="owner-detail-grid">
            <div><div class="staff-profile-label">Mã đơn</div><div class="staff-profile-value">${escapeHtml(order.id)}</div></div>
            <div><div class="staff-profile-label">Loại đơn</div><div class="staff-profile-value">${escapeHtml(sourceLabel)}</div></div>
            <div><div class="staff-profile-label">Nguồn lưu</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.source || order.type))}</div></div>
            <div><div class="staff-profile-label">Trạng thái</div><div class="staff-profile-value">${statusBadge(order.status)}</div></div>
            <div><div class="staff-profile-label">Thời gian tạo</div><div class="staff-profile-value">${escapeHtml(formatDateTimeValue(order.createdAt))}</div></div>
            ${order.reservationDate ? `<div><div class="staff-profile-label">Ngày cần</div><div class="staff-profile-value">${escapeHtml(order.reservationDate)}</div></div>` : ''}
            <div><div class="staff-profile-label">User ID</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.userId))}</div></div>
          </div>
        </section>
        <section class="owner-detail-section">
          <div class="owner-detail-section-title">Khách hàng & giao nhận</div>
          <div class="owner-detail-grid">
            <div><div class="staff-profile-label">Khách hàng</div><div class="staff-profile-value">${escapeHtml(order.customerName || 'Khách hàng')}</div></div>
            <div><div class="staff-profile-label">Số điện thoại</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.customerPhone))}</div></div>
            <div class="owner-detail-grid-wide"><div class="staff-profile-label">Địa chỉ</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.address))}</div></div>
            <div class="owner-detail-grid-wide"><div class="staff-profile-label">Ghi chú đơn</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.note))}</div></div>
          </div>
        </section>
        <section class="owner-detail-section">
          <div class="owner-detail-section-title">Thanh toán & ưu đãi</div>
          <div class="owner-detail-grid">
            <div><div class="staff-profile-label">Phương thức thanh toán</div><div class="staff-profile-value">${escapeHtml(PAYMENT_LABELS[order.paymentMethod] || valueOrDash(order.paymentMethod))}</div></div>
            <div><div class="staff-profile-label">Mã voucher</div><div class="staff-profile-value">${escapeHtml(valueOrDash(order.voucherCode))}</div></div>
            <div><div class="staff-profile-label">Điểm nhận được</div><div class="staff-profile-value">${Number(order.pointsEarned || 0).toLocaleString('vi-VN')}</div></div>
            <div><div class="staff-profile-label">Đã cộng điểm</div><div class="staff-profile-value">${escapeHtml(boolLabel(order.pointsAwarded))}</div></div>
            <div class="owner-detail-grid-wide"><div class="staff-profile-label">Thời điểm cộng điểm</div><div class="staff-profile-value">${escapeHtml(order.pointsAwardedAt ? formatDateTimeValue(order.pointsAwardedAt) : '—')}</div></div>
          </div>
        </section>
        <div class="owner-table-wrap">
          <table class="owner-table">
            <thead><tr><th>Mã món</th><th>Món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th><th>Ghi chú</th></tr></thead>
            <tbody>${order.items.map((item) => `<tr><td>${escapeHtml(valueOrDash(item.id))}</td><td>${escapeHtml(item.name)}</td><td>${Number(item.qty || 0)}</td><td>${formatPrice(Number(item.price || 0))}</td><td>${formatPrice(Number(item.price || 0) * Number(item.qty || 0))}</td><td>${escapeHtml(valueOrDash(item.note))}</td></tr>`).join('') || `<tr><td colspan="6"><div class="empty-state"><h3>Không có món</h3></div></td></tr>`}</tbody>
          </table>
        </div>
        <div class="owner-detail-total">
          <div><span>Số món</span><strong>${Number(order.itemQty || 0).toLocaleString('vi-VN')}</strong></div>
          <div><span>Tạm tính</span><strong>${formatPrice(Number(order.subtotal || order.total))}</strong></div>
          <div><span>Giảm giá</span><strong>-${formatPrice(order.discount)}</strong></div>
          <div><span>Tổng cộng</span><strong>${formatPrice(order.total)}</strong></div>
        </div>
      </div>
    `,
  });
};

export const renderDashboardPage = () => {
  if (analyticsRange === 'all') analyticsRange = '7d';
  const range = getDateRange();
  const orders = getAnalyticsOrders();
  const revenueOrders = getRevenueRecords(orders);
  const summary = getAnalyticsSummary(revenueOrders);
  const chartMode = analyticsRange === 'today' ? 'hour' : 'day';
  const chartRows = aggregateBy(revenueOrders, chartMode);
  const topItems = getOrderItems(revenueOrders).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const recent = [...orders].sort((a, b) => {
    const { key, dir } = getSortState(recentOrderSort, 'createdAt');
    const direction = dir === 'desc' ? -1 : 1;
    if (key === 'id') return compareText(a.id, b.id) * direction;
    if (key === 'customerName') return compareText(a.customerName || 'Khách hàng', b.customerName || 'Khách hàng') * direction;
    if (key === 'total') return (a.total - b.total) * direction;
    if (key === 'status') return compareText(getStatusMeta(a.status).label, getStatusMeta(b.status).label) * direction;
    return (a.createdAt - b.createdAt) * direction;
  }).slice(0, 8);
  return `
    <div class="owner-page owner-analytics-page">
      <div class="owner-toolbar owner-toolbar--filter-only">
        ${timeFilterHtml()}
      </div>
      ${metricCardsHtml([
        { label: 'Tổng doanh thu', value: formatPrice(summary.revenue), note: 'Đơn thành công sau giảm giá' },
        { label: 'Số đơn thành công', value: summary.orders.toLocaleString('vi-VN'), note: 'Đã ghi nhận doanh thu' },
        { label: 'Số món đã bán', value: summary.itemQty.toLocaleString('vi-VN'), note: 'Theo số lượng món' },
        { label: 'Món bán chạy nhất', value: escapeHtml(summary.topItem?.name || '—'), note: summary.topItem ? `${summary.topItem.qty} món` : 'Chưa có dữ liệu' },
        { label: 'Giá trị TB/đơn', value: formatPrice(summary.avgOrder), note: 'AOV' },
      ])}
      <div class="owner-analytics-grid owner-dashboard-grid">
        <section class="staff-panel owner-chart-panel">
          <div class="staff-panel-header"><div class="staff-panel-title">Doanh thu ngắn hạn</div></div>
          <div class="staff-panel-body">${lineChartHtml(chartRows, 'revenue', { showLegend: false, showAxes: true, mode: chartMode, range })}</div>
        </section>
        <section class="staff-panel owner-chart-panel">
          <div class="staff-panel-header"><div class="staff-panel-title">Top 5 món bán chạy</div></div>
          <div class="staff-panel-body">${barChartHtml(topItems, { horizontal: true, valueKey: 'qty', labelKey: 'name', money: false, showLegend: false, mono: true, valueInLabel: true, hideValue: true })}</div>
        </section>
        <section class="staff-panel owner-recent-orders-panel">
          <div class="staff-panel-header"><div class="staff-panel-title">Đơn hàng gần đây</div></div>
          <div class="staff-panel-body owner-sheet-body">
            <div class="owner-table-wrap">
              <table class="owner-table owner-spreadsheet">
                <thead><tr><th>${sheetSortButton('data-recent-order-sort', recentOrderSort, 'id', 'Mã đơn')}</th><th>${sheetSortButton('data-recent-order-sort', recentOrderSort, 'createdAt', 'Thời gian')}</th><th>${sheetSortButton('data-recent-order-sort', recentOrderSort, 'customerName', 'Khách hàng')}</th><th>${sheetSortButton('data-recent-order-sort', recentOrderSort, 'total', 'Tổng tiền')}</th><th>${sheetSortButton('data-recent-order-sort', recentOrderSort, 'status', 'Trạng thái')}</th></tr></thead>
                <tbody>
                  ${recent.map((order) => `<tr data-order-detail="${escapeAttr(order.id)}"><td>${escapeHtml(order.id)}</td><td>${escapeHtml(formatDateTimeValue(order.createdAt))}</td><td>${escapeHtml(order.customerName || 'Khách hàng')}</td><td>${formatPrice(order.total)}</td><td>${statusBadge(order.status)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><h3>Chưa có đơn hàng</h3><p>Khi có đơn mới, danh sách sẽ xuất hiện tại đây.</p></div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;
};

const revenueSummaryRows = (orders) => aggregateBy(orders, reportGroupBy);

const renderRevenueTab = (orders, summary) => {
  const rows = revenueSummaryRows(orders);
  const range = getDateRange();
  const best = [...rows].sort((a, b) => b.revenue - a.revenue)[0];
  const typeRows = Object.entries(ORDER_TYPE_LABELS).map(([type, label]) => ({
    label,
    revenue: orders.filter((o) => o.type === type).reduce((sum, o) => sum + o.total, 0),
  })).filter((row) => row.revenue > 0);
  const sortedRows = [...rows].sort((a, b) => {
    const { key, dir } = getSortState(revenueSort, 'date');
    const direction = dir === 'desc' ? -1 : 1;
    if (key === 'revenue') return (a.revenue - b.revenue) * direction;
    if (key === 'orders') return (a.orders - b.orders) * direction;
    if (key === 'itemQty') return (a.itemQty - b.itemQty) * direction;
    if (key === 'avgOrder') return ((a.orders ? a.revenue / a.orders : 0) - (b.orders ? b.revenue / b.orders : 0)) * direction;
    return a.label.localeCompare(b.label, 'vi') * direction;
  });
  const pagedRows = getPagedRows(sortedRows, revenueSheetPage, REPORT_SHEET_PAGE_SIZE);
  revenueSheetPage = pagedRows.page;
  return `
    ${metricCardsHtml([
      { label: 'Tổng doanh thu', value: formatPrice(summary.revenue) },
      { label: 'Tổng số đơn thành công', value: summary.orders.toLocaleString('vi-VN') },
      { label: 'Giá trị TB/đơn', value: formatPrice(summary.avgOrder) },
      { label: 'Ngày cao nhất', value: escapeHtml(best?.label || '—'), note: best ? formatPrice(best.revenue) : 'Chưa có dữ liệu' },
    ])}
    <div class="owner-analytics-grid owner-revenue-grid">
      <section class="staff-panel"><div class="staff-panel-header"><div class="staff-panel-title">Doanh thu theo thời gian</div></div><div class="staff-panel-body">${lineChartHtml(rows, 'revenue', { showLegend: false, showAxes: true, mode: reportGroupBy, range })}</div></section>
      <section class="staff-panel"><div class="staff-panel-header"><div class="staff-panel-title">Doanh thu theo loại đơn</div></div><div class="staff-panel-body">${donutChartHtml(typeRows)}</div></section>
      <section class="staff-panel owner-revenue-summary-panel"><div class="staff-panel-header"><div class="staff-panel-title">Tóm tắt doanh thu</div></div><div class="staff-panel-body owner-sheet-body"><div class="owner-table-wrap"><table class="owner-table owner-spreadsheet"><thead><tr><th>${sheetSortButton('data-revenue-sort', revenueSort, 'date', 'Ngày')}</th><th>${sheetSortButton('data-revenue-sort', revenueSort, 'orders', 'Số đơn')}</th><th>${sheetSortButton('data-revenue-sort', revenueSort, 'itemQty', 'Số món')}</th><th>${sheetSortButton('data-revenue-sort', revenueSort, 'revenue', 'Doanh thu')}</th><th>${sheetSortButton('data-revenue-sort', revenueSort, 'avgOrder', 'TB/đơn')}</th></tr></thead><tbody>${pagedRows.rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${row.orders}</td><td>${row.itemQty}</td><td>${formatPrice(row.revenue)}</td><td>${formatPrice(row.orders ? Math.round(row.revenue / row.orders) : 0)}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><h3>Chưa có dữ liệu</h3></div></td></tr>`}</tbody>${ownerPaginationTableFooterHtml({ total: sortedRows.length, page: revenueSheetPage, pageCount: pagedRows.pageCount, label: 'dòng', prevId: 'revenue-prev', nextId: 'revenue-next', colspan: 5 })}</table></div></div></section>
    </div>
  `;
};

const renderMenuStatsTab = (orders, summary) => {
  const items = getOrderItems(orders);
  const categoryRows = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
    label,
    revenue: items.filter((item) => item.category === cat).reduce((sum, item) => sum + item.revenue, 0),
  })).filter((row) => row.revenue > 0);
  const topCategory = [...categoryRows].sort((a, b) => b.revenue - a.revenue)[0];
  const q = menuItemSearch.trim().toLowerCase();
  const filtered = items
    .filter((item) => menuCategoryFilter === 'all' || item.category === menuCategoryFilter)
    .filter((item) => !q || item.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const { key, dir } = getSortState(menuItemSort, 'qty');
      const direction = dir === 'desc' ? -1 : 1;
      if (key === 'revenue') return (a.revenue - b.revenue) * direction;
      if (key === 'name') return compareText(a.name, b.name) * direction;
      if (key === 'category') return compareText(CATEGORY_LABELS[a.category] || a.category, CATEGORY_LABELS[b.category] || b.category) * direction;
      if (key === 'contribution') return (getContributionPercent(a.revenue, summary.revenue) - getContributionPercent(b.revenue, summary.revenue)) * direction;
      return (a.qty - b.qty) * direction;
    });
  const pagedItems = getPagedRows(filtered, menuItemSheetPage, REPORT_SHEET_PAGE_SIZE);
  menuItemSheetPage = pagedItems.page;
  return `
    ${metricCardsHtml([
      { label: 'Tổng món đã bán', value: summary.itemQty.toLocaleString('vi-VN') },
      { label: 'Món bán chạy nhất', value: escapeHtml(summary.topItem?.name || '—'), note: summary.topItem ? `${summary.topItem.qty} món` : '' },
      { label: 'Nhóm bán chạy nhất', value: escapeHtml(topCategory?.label || '—'), note: topCategory ? formatPrice(topCategory.revenue) : '' },
      { label: 'Món doanh thu cao nhất', value: escapeHtml(summary.topRevenueItem?.name || '—'), note: summary.topRevenueItem ? formatPrice(summary.topRevenueItem.revenue) : '' },
    ])}
    <div class="owner-analytics-grid owner-menu-stats-grid">
      <section class="staff-panel owner-top-items-panel"><div class="staff-panel-header"><div class="staff-panel-title">Top 10 món theo số lượng</div></div><div class="staff-panel-body">${barChartHtml([...items].sort((a, b) => b.qty - a.qty).slice(0, 10), { horizontal: true, valueKey: 'qty', labelKey: 'name', money: false, showLegend: false, mono: true, valueInLabel: true, hideValue: true })}</div></section>
      <section class="staff-panel owner-category-revenue-panel"><div class="staff-panel-header"><div class="staff-panel-title">Doanh thu theo nhóm món</div></div><div class="staff-panel-body">${donutChartHtml(categoryRows)}</div></section>
    </div>
    <section class="staff-panel owner-menu-items-sheet">
      <div class="staff-panel-header owner-menu-header"><div class="owner-menu-header-row"><div class="search-bar owner-sheet-search"><span class="search-icon">${icon('search')}</span><input id="menu-stat-search" type="search" placeholder="Tìm tên món..." value="${escapeAttr(menuItemSearch)}"></div><select class="form-control" id="menu-stat-category"><option value="all">Mọi nhóm món</option>${Object.entries(CATEGORY_LABELS).map(([id, label]) => `<option value="${id}"${menuCategoryFilter === id ? ' selected' : ''}>${label}</option>`).join('')}</select></div></div>
      <div class="staff-panel-body owner-sheet-body"><div class="owner-table-wrap"><table class="owner-table owner-spreadsheet"><thead><tr><th>${sheetSortButton('data-menu-stat-sort', menuItemSort, 'name', 'Tên món')}</th><th>${sheetSortButton('data-menu-stat-sort', menuItemSort, 'category', 'Nhóm món')}</th><th>${sheetSortButton('data-menu-stat-sort', menuItemSort, 'qty', 'Số lượng')}</th><th>${sheetSortButton('data-menu-stat-sort', menuItemSort, 'revenue', 'Doanh thu')}</th><th>${sheetSortButton('data-menu-stat-sort', menuItemSort, 'contribution', 'Tỷ lệ đóng góp')}</th></tr></thead><tbody>${pagedItems.rows.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</td><td>${item.qty}</td><td>${formatPrice(item.revenue)}</td><td>${getContributionPercent(item.revenue, summary.revenue)}%</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty-state"><h3>Không tìm thấy món</h3></div></td></tr>`}</tbody>${ownerPaginationTableFooterHtml({ total: filtered.length, page: menuItemSheetPage, pageCount: pagedItems.pageCount, label: 'món', prevId: 'menu-stat-prev', nextId: 'menu-stat-next', colspan: 5 })}</table></div></div>
    </section>
  `;
};

const renderOrdersTab = (orders) => {
  const q = orderSheetSearch.trim().toLowerCase();
  const filtered = orders
    .filter((order) => orderStatusFilter === 'all' || order.status === orderStatusFilter)
    .filter((order) => orderTypeFilter === 'all' || order.type === orderTypeFilter)
    .filter((order) => orderPaymentFilter === 'all' || order.paymentMethod === orderPaymentFilter)
    .filter((order) => !q || `${order.id} ${ORDER_TYPE_LABELS[order.type] || order.type} ${order.customerName || ''} ${order.customerPhone || ''} ${order.items.map((item) => item.name).join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const { key, dir } = getSortState(orderSheetSort, 'createdAt');
      const direction = dir === 'desc' ? -1 : 1;
      if (key === 'id') return compareText(a.id, b.id) * direction;
      if (key === 'type') return compareText(ORDER_TYPE_LABELS[a.type] || a.type, ORDER_TYPE_LABELS[b.type] || b.type) * direction;
      if (key === 'customerName') return compareText(a.customerName || 'Khách hàng', b.customerName || 'Khách hàng') * direction;
      if (key === 'itemQty') return (a.itemQty - b.itemQty) * direction;
      if (key === 'total') return (a.total - b.total) * direction;
      if (key === 'paymentMethod') return compareText(PAYMENT_LABELS[a.paymentMethod] || a.paymentMethod, PAYMENT_LABELS[b.paymentMethod] || b.paymentMethod) * direction;
      if (key === 'status') return compareText(getStatusMeta(a.status).label, getStatusMeta(b.status).label) * direction;
      return (a.createdAt - b.createdAt) * direction;
    });
  const pageCount = Math.max(1, Math.ceil(filtered.length / ORDER_PAGE_SIZE));
  orderSheetPage = Math.min(orderSheetPage, pageCount);
  const pageRows = filtered.slice((orderSheetPage - 1) * ORDER_PAGE_SIZE, orderSheetPage * ORDER_PAGE_SIZE);
  return `
    <section class="staff-panel owner-orders-panel">
      <div class="staff-panel-header owner-menu-header">
        <div class="owner-menu-header-row owner-orders-toolbar">
          <div class="search-bar owner-sheet-search"><span class="search-icon">${icon('search')}</span><input id="order-sheet-search" type="search" placeholder="Tìm mã đơn, khách, món..." value="${escapeAttr(orderSheetSearch)}"></div>
          <select class="form-control" id="order-status-filter"><option value="all">Mọi trạng thái</option>${Object.entries(ORDER_STATUS).map(([id, meta]) => `<option value="${id}"${orderStatusFilter === id ? ' selected' : ''}>${meta.label}</option>`).join('')}</select>
          <select class="form-control" id="order-type-filter"><option value="all">Mọi loại đơn</option>${Object.entries(ORDER_TYPE_LABELS).map(([id, label]) => `<option value="${id}"${orderTypeFilter === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
          <select class="form-control" id="order-payment-filter"><option value="all">Mọi thanh toán</option>${Object.entries(PAYMENT_LABELS).map(([id, label]) => `<option value="${id}"${orderPaymentFilter === id ? ' selected' : ''}>${label}</option>`).join('')}</select>
        </div>
      </div>
      <div class="staff-panel-body owner-sheet-body"><div class="owner-table-wrap owner-orders-table-wrap"><table class="owner-table owner-spreadsheet owner-orders-sheet"><colgroup><col class="owner-orders-col-id"><col class="owner-orders-col-type"><col class="owner-orders-col-date"><col class="owner-orders-col-customer"><col class="owner-orders-col-items"><col class="owner-orders-col-money"><col class="owner-orders-col-payment"><col class="owner-orders-col-status"></colgroup><thead><tr><th>${sheetSortButton('data-order-sort', orderSheetSort, 'id', 'Mã đơn')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'type', 'Loại đơn')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'createdAt', 'Ngày giờ')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'customerName', 'Khách hàng')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'itemQty', 'Số lượng món')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'total', 'Tổng tiền')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'paymentMethod', 'Thanh toán')}</th><th>${sheetSortButton('data-order-sort', orderSheetSort, 'status', 'Trạng thái')}</th></tr></thead><tbody>${pageRows.map((order) => `<tr data-order-detail="${escapeAttr(order.id)}"><td>${escapeHtml(order.id)}</td><td>${escapeHtml(ORDER_TYPE_LABELS[order.type] || order.type)}</td><td>${escapeHtml(formatDateTimeValue(order.createdAt))}</td><td>${escapeHtml(order.customerName || 'Khách hàng')}</td><td>${Number(order.itemQty || 0).toLocaleString('vi-VN')}</td><td>${formatPrice(order.total)}</td><td>${escapeHtml(PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod)}</td><td>${statusBadge(order.status)}</td></tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><h3>Không có đơn hàng</h3><p>Thử đổi bộ lọc hoặc khoảng thời gian.</p></div></td></tr>`}</tbody>${ownerPaginationTableFooterHtml({ total: filtered.length, page: orderSheetPage, pageCount, label: 'đơn', prevId: 'order-prev', nextId: 'order-next', colspan: 8 })}</table></div></div>
    </section>
  `;
};

export const renderReportsPage = () => {
  const orders = getAnalyticsOrders();
  const revenueOrders = getRevenueRecords(orders);
  const summary = getAnalyticsSummary(revenueOrders);
  return `
    <div class="owner-page owner-analytics-page">
      <div class="owner-toolbar owner-toolbar--filter-only">
        ${timeFilterHtml({ includeAll: true })}
      </div>
      ${rangeCaptionHtml()}
      <div class="owner-report-content${reportTab === 'orders' ? ' owner-report-content--orders' : ''}">
        ${reportTab === 'items' ? renderMenuStatsTab(revenueOrders, summary) : reportTab === 'orders' ? renderOrdersTab(orders) : renderRevenueTab(revenueOrders, summary)}
      </div>
    </div>
  `;
};

const reportTabsHtml = () => `
  <button class="${reportTab === 'revenue' ? 'active' : ''}" data-report-tab="revenue" type="button">Doanh thu</button>
  <button class="${reportTab === 'items' ? 'active' : ''}" data-report-tab="items" type="button">Lượt bán món</button>
  <button class="${reportTab === 'orders' ? 'active' : ''}" data-report-tab="orders" type="button">Đơn hàng</button>
`;

const syncReportTabsNav = () => {
  const slot = document.getElementById('owner-report-tabs-nav');
  if (slot) slot.innerHTML = reportTabsHtml();
};

const bindAnalyticsFilters = ({ bindRange = true } = {}) => {
  if (analyticsFirstPaint) {
    analyticsFirstPaint = false;
    window.setTimeout(() => rerenderOwnerPage(), 220);
  }
  if (!bindRange) {
    document.querySelectorAll('[data-order-detail]')?.forEach((el) => {
      el.addEventListener('click', () => openOrderDetailDrawer(el.dataset.orderDetail || el.closest('[data-order-detail]')?.dataset.orderDetail));
    });
    return;
  }
  document.querySelectorAll('[data-range]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      analyticsRange = btn.dataset.range;
      analyticsCustomMenuOpen = false;
      resetReportSheetPages();
      orderSheetPage = 1;
      rerenderOwnerPage();
    });
  });
  document.querySelector('[data-range-custom-toggle]')?.addEventListener('click', () => {
    analyticsCustomMenuOpen = !analyticsCustomMenuOpen;
    rerenderOwnerPage();
  });
  document.getElementById('analytics-apply-custom')?.addEventListener('click', () => {
    const start = document.getElementById('analytics-start')?.value || '';
    const end = document.getElementById('analytics-end')?.value || '';
    if (!start || !end) {
      toast.error('Vui lòng chọn đủ ngày bắt đầu và kết thúc.');
      return;
    }
    analyticsRange = 'custom';
    analyticsCustomStart = start;
    analyticsCustomEnd = end;
    analyticsCustomMenuOpen = false;
    resetReportSheetPages();
    orderSheetPage = 1;
    rerenderOwnerPage();
  });
  document.querySelectorAll('[data-order-detail]')?.forEach((el) => {
    el.addEventListener('click', () => openOrderDetailDrawer(el.dataset.orderDetail || el.closest('[data-order-detail]')?.dataset.orderDetail));
  });
  document.querySelectorAll('[data-recent-order-sort]')?.forEach((btn) => btn.addEventListener('click', () => {
    recentOrderSort = nextSort(recentOrderSort, btn.dataset.recentOrderSort);
    rerenderOwnerPage();
  }));
};

export const bindDashboardPage = () => bindAnalyticsFilters();

export const bindReportsPage = () => {
  bindAnalyticsFilters();
  syncReportTabsNav();
  document.querySelectorAll('[data-report-tab]')?.forEach((btn) => {
    btn.addEventListener('click', () => {
      reportTab = btn.dataset.reportTab;
      rerenderOwnerPage();
    });
  });
  document.getElementById('report-group')?.addEventListener('change', (e) => {
    reportGroupBy = e.target.value;
    revenueSheetPage = 1;
    rerenderReportsPreservingScroll();
  });
  document.querySelectorAll('[data-revenue-sort]')?.forEach((btn) => btn.addEventListener('click', () => {
    revenueSort = nextSort(revenueSort, btn.dataset.revenueSort);
    revenueSheetPage = 1;
    rerenderReportsPreservingScroll();
  }));
  document.getElementById('revenue-prev')?.addEventListener('click', () => {
    revenueSheetPage = Math.max(1, revenueSheetPage - 1);
    rerenderReportsPreservingScroll();
  });
  document.getElementById('revenue-next')?.addEventListener('click', () => {
    revenueSheetPage += 1;
    rerenderReportsPreservingScroll();
  });
  document.getElementById('menu-stat-search')?.addEventListener('input', (e) => {
    menuItemSearch = e.target.value;
    menuItemSheetPage = 1;
    scheduleReportsRenderPreservingScroll();
  });
  document.getElementById('menu-stat-category')?.addEventListener('change', (e) => {
    menuCategoryFilter = e.target.value;
    menuItemSheetPage = 1;
    rerenderReportsPreservingScroll();
  });
  document.querySelectorAll('[data-menu-stat-sort]')?.forEach((btn) => btn.addEventListener('click', () => {
    menuItemSort = nextSort(menuItemSort, btn.dataset.menuStatSort);
    menuItemSheetPage = 1;
    rerenderReportsPreservingScroll();
  }));
  document.getElementById('menu-stat-prev')?.addEventListener('click', () => {
    menuItemSheetPage = Math.max(1, menuItemSheetPage - 1);
    rerenderReportsPreservingScroll();
  });
  document.getElementById('menu-stat-next')?.addEventListener('click', () => {
    menuItemSheetPage += 1;
    rerenderReportsPreservingScroll();
  });
  document.getElementById('order-sheet-search')?.addEventListener('input', (e) => {
    orderSheetSearch = e.target.value;
    orderSheetPage = 1;
    scheduleRenderPage();
  });
  document.getElementById('order-status-filter')?.addEventListener('change', (e) => {
    orderStatusFilter = e.target.value;
    orderSheetPage = 1;
    rerenderOwnerPage();
  });
  document.getElementById('order-type-filter')?.addEventListener('change', (e) => {
    orderTypeFilter = e.target.value;
    orderSheetPage = 1;
    rerenderOwnerPage();
  });
  document.getElementById('order-payment-filter')?.addEventListener('change', (e) => {
    orderPaymentFilter = e.target.value;
    orderSheetPage = 1;
    rerenderOwnerPage();
  });
  document.querySelectorAll('[data-order-sort]')?.forEach((btn) => btn.addEventListener('click', () => {
    orderSheetSort = nextSort(orderSheetSort, btn.dataset.orderSort);
    rerenderOwnerPage();
  }));
  document.getElementById('order-prev')?.addEventListener('click', () => {
    orderSheetPage = Math.max(1, orderSheetPage - 1);
    rerenderOwnerPage();
  });
  document.getElementById('order-next')?.addEventListener('click', () => {
    orderSheetPage += 1;
    rerenderOwnerPage();
  });
};
