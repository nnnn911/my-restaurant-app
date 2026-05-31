import flatpickr from 'flatpickr';
import { Vietnamese } from 'flatpickr/dist/l10n/vn.js';
import monthSelectPlugin from 'flatpickr/dist/plugins/monthSelect/index.js';
import 'flatpickr/dist/flatpickr.min.css';
import 'flatpickr/dist/plugins/monthSelect/style.css';
import { escapeAttr } from '../core/html.js';

const toDisplayDate = (value = '', includeTime = true) => {
  const raw = value.toString().trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return raw;
  const date = `${match[3]}/${match[2]}/${match[1]}`;
  if (!includeTime) return date;
  return `${date} ${match[4] || '00'}:${match[5] || '00'}`;
};

const toSubmitValue = (dates = [], includeTime = true) => {
  const date = dates[0];
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return includeTime ? `${base}T${pad(date.getHours())}:${pad(date.getMinutes())}` : base;
};

const parseSubmitDate = (value = '') => {
  const raw = value.toString().trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!match) return raw || null;
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] || 0),
    Number(match[5] || 0)
  );
};

const toDisplayMonth = (value = '') => {
  const raw = value.toString().trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  return match ? `${match[2]}/${match[1]}` : raw;
};

const parseSubmitMonth = (value = '') => {
  const raw = value.toString().trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  if (!match) return raw || null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
};

const toSubmitMonth = (dates = []) => {
  const date = dates[0];
  if (!date) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

export const segmentedDateTimeInput = (id, value = '', { includeTime = true } = {}) => `
  <input
    class="form-control datetime-flatpickr"
    id="${escapeAttr(id)}"
    type="text"
    value="${escapeAttr(toDisplayDate(value, includeTime))}"
    data-datetime="${escapeAttr(id)}"
    data-include-time="${includeTime ? 'true' : 'false'}"
    data-submit-value="${escapeAttr(value)}"
    placeholder="${includeTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}"
    autocomplete="off">
`;

export const segmentedMonthInput = (id, value = '') => `
  <input
    class="form-control month-flatpickr"
    id="${escapeAttr(id)}"
    type="text"
    value="${escapeAttr(toDisplayMonth(value))}"
    data-month="${escapeAttr(id)}"
    data-submit-value="${escapeAttr(value)}"
    placeholder="MM/YYYY"
    autocomplete="off">
`;

export const bindSegmentedDateTimeInputs = (root = document) => {
  root.querySelectorAll('.datetime-flatpickr')?.forEach((input) => {
    if (input._flatpickr) return;
    const includeTime = input.dataset.includeTime === 'true';
    flatpickr(input, {
      allowInput: true,
      dateFormat: includeTime ? 'd/m/Y H:i' : 'd/m/Y',
      defaultDate: parseSubmitDate(input.dataset.submitValue) || input.value || null,
      enableTime: includeTime,
      locale: Vietnamese,
      time_24hr: true,
      minuteIncrement: 1,
      onChange: (dates) => {
        input.dataset.submitValue = toSubmitValue(dates, includeTime);
      },
      onClose: (dates) => {
        input.dataset.submitValue = toSubmitValue(dates, includeTime);
      },
      onReady: (dates) => {
        input.dataset.submitValue = toSubmitValue(dates, includeTime);
      },
    });
  });
};

export const bindSegmentedMonthInputs = (root = document) => {
  root.querySelectorAll('.month-flatpickr')?.forEach((input) => {
    if (input._flatpickr) return;
    flatpickr(input, {
      allowInput: true,
      dateFormat: 'm/Y',
      defaultDate: parseSubmitMonth(input.dataset.submitValue) || input.value || null,
      locale: Vietnamese,
      plugins: [
        monthSelectPlugin({
          shorthand: false,
          dateFormat: 'm/Y',
          altFormat: 'F Y',
        }),
      ],
      onChange: (dates) => {
        input.dataset.submitValue = toSubmitMonth(dates);
      },
      onClose: (dates) => {
        input.dataset.submitValue = toSubmitMonth(dates);
      },
      onReady: (dates) => {
        input.dataset.submitValue = toSubmitMonth(dates);
      },
    });
  });
};

export const getDateTimeValue = (idOrEl) => {
  const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!input) return '';
  if (input._flatpickr) input.dataset.submitValue = toSubmitValue(input._flatpickr.selectedDates, input.dataset.includeTime === 'true');
  return input.dataset.submitValue || '';
};

export const getMonthValue = (idOrEl) => {
  const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!input) return '';
  if (input._flatpickr) input.dataset.submitValue = toSubmitMonth(input._flatpickr.selectedDates);
  return input.dataset.submitValue || '';
};
