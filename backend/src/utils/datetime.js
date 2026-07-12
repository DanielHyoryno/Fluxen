const env = require("../config/env");

function getDateParts(value, timeZone = env.businessTimezone) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_DATE");

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function toBusinessDateKey(value) {
  const { year, month, day } = getDateParts(value);
  return `${year}-${month}-${day}`;
}

function toBusinessMonthKey(value) {
  const { year, month } = getDateParts(value);
  return `${year}-${month}`;
}

function formatBusinessDateTime(value) {
  const { year, month, day, hour, minute, second } = getDateParts(value);
  return `${year}-${month}-${day} ${hour}:${minute}:${second} WIB`;
}

module.exports = { formatBusinessDateTime, toBusinessDateKey, toBusinessMonthKey };
