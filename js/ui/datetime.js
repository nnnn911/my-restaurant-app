import flatpickr from 'flatpickr';
import { Vietnamese } from 'flatpickr/dist/l10n/vn.js';
import 'flatpickr/dist/flatpickr.min.css';
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

export const getDateTimeValue = (idOrEl) => {
  const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!input) return '';
  if (input._flatpickr) input.dataset.submitValue = toSubmitValue(input._flatpickr.selectedDates, input.dataset.includeTime === 'true');
  return input.dataset.submitValue || '';
};
