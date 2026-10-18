function pad(value) {
  return String(value).padStart(2, '0');
}

function formatMoney(cents) {
  const value = Number(cents) || 0;
  return (value / 100).toFixed(2);
}

function formatDate(input, withSeconds) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  const base = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  const time = [pad(date.getHours()), pad(date.getMinutes())];
  if (withSeconds) time.push(pad(date.getSeconds()));
  return base + ' ' + time.join(':');
}

function formatShortDate(input) {
  if (!input) return '-';
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

module.exports = {
  formatMoney,
  formatDate,
  formatShortDate
};
