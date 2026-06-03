const GOV_RATE = 0.6;
const USER_RATE = 0.4;
const GOV_CAP = 200;
const EPSILON = 0.005;

const governmentInput = document.querySelector("#government");
const customerInput = document.querySelector("#customer");
const totalInput = document.querySelector("#total");
const ratio = document.querySelector("#ratio");
const capStatus = document.querySelector("#cap-status");

let activeInput = null;

function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function format(value) {
  return money(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function formatPercent(value) {
  return value
    .toFixed(1)
    .replace(/\.0$/, "");
}

function splitFromTotal(total) {
  return {
    government: total * GOV_RATE,
    customer: total * USER_RATE,
    total,
  };
}

function splitFromGovernment(government) {
  const total = government / GOV_RATE;
  return {
    government,
    customer: total * USER_RATE,
    total,
  };
}

function splitFromCustomer(customer) {
  const total = customer / USER_RATE;
  return splitFromTotal(total);
}

function setValue(input, value) {
  if (input !== activeInput) {
    input.value = format(value);
  }
}

function updateSummary(values) {
  const governmentPercent = values.total > 0 ? (values.government / values.total) * 100 : 0;
  const customerPercent = values.total > 0 ? (values.customer / values.total) * 100 : 0;
  ratio.textContent = `รัฐ ${formatPercent(governmentPercent)}% / เรา ${formatPercent(customerPercent)}%`;

  if (values.government >= GOV_CAP - EPSILON) {
    const extra = Math.max(values.government - GOV_CAP, 0);
    const actualCustomer = values.customer + extra;
    capStatus.textContent = extra > 0
      ? `ต้องจ่ายเพิ่ม ${format(extra)} บาท / เราจ่ายจริง ${format(actualCustomer)} บาท`
      : "แตะเพดาน 200 บาท";
    return;
  }

  capStatus.textContent = `ยังเหลือ ${format(GOV_CAP - values.government)} บาท`;
}

function recalculate(source) {
  activeInput = source;

  const values = source === governmentInput
    ? splitFromGovernment(toNumber(source.value))
    : source === customerInput
      ? splitFromCustomer(toNumber(source.value))
      : splitFromTotal(toNumber(source.value));

  setValue(governmentInput, values.government);
  setValue(customerInput, values.customer);
  setValue(totalInput, values.total);
  updateSummary(values);
}

[governmentInput, customerInput, totalInput].forEach((input) => {
  input.addEventListener("input", () => recalculate(input));
  input.addEventListener("blur", () => {
    activeInput = null;
    recalculate(input);
  });
});

recalculate(totalInput);
