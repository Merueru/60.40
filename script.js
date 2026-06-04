const GOV_RATE = 0.6;
const USER_RATE = 0.4;
const GOV_CAP = 200;
const EPSILON = 0.005;

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

const governmentInput = document.querySelector("#government");
const customerInput = document.querySelector("#customer");
const totalInput = document.querySelector("#total");
const ratio = document.querySelector("#ratio");
const capStatus = document.querySelector("#cap-status");

const multiTotalInput = document.querySelector("#multi-total");
const machineList = document.querySelector("#machine-list");
const machineCount = document.querySelector("#machine-count");
const addMachineButton = document.querySelector("#add-machine");
const removeMachineButton = document.querySelector("#remove-machine");
const equalPay = document.querySelector("#equal-pay");
const multiGovernment = document.querySelector("#multi-government");
const multiCustomer = document.querySelector("#multi-customer");
const multiExtra = document.querySelector("#multi-extra");
const multiUnused = document.querySelector("#multi-unused");

let activeInput = null;
let machines = [200, 200, 200];

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

function baht(value) {
  return `${format(value)} บาท`;
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

function updateSingleSummary(values) {
  const governmentPercent = values.total > 0 ? (values.government / values.total) * 100 : 0;
  const customerPercent = values.total > 0 ? (values.customer / values.total) * 100 : 0;
  ratio.textContent = `รัฐ ${formatPercent(governmentPercent)}% / เรา ${formatPercent(customerPercent)}%`;

  if (values.government >= GOV_CAP - EPSILON) {
    const extra = Math.max(values.government - GOV_CAP, 0);
    const actualCustomer = values.customer + extra;
    capStatus.textContent = extra > 0
      ? `ต้องจ่ายเพิ่ม ${baht(extra)} / เราจ่ายจริง ${baht(actualCustomer)}`
      : "แตะเพดาน 200 บาท";
    return;
  }

  capStatus.textContent = `ยังเหลือ ${baht(GOV_CAP - values.government)}`;
}

function recalculateSingle(source) {
  activeInput = source;

  const values = source === governmentInput
    ? splitFromGovernment(toNumber(source.value))
    : source === customerInput
      ? splitFromCustomer(toNumber(source.value))
      : splitFromTotal(toNumber(source.value));

  setValue(governmentInput, values.government);
  setValue(customerInput, values.customer);
  setValue(totalInput, values.total);
  updateSingleSummary(values);
}

function transactionAtEqualPay(customerPay, cap) {
  const capThreshold = cap * USER_RATE / GOV_RATE;
  if (customerPay <= capThreshold + EPSILON) {
    return customerPay / USER_RATE;
  }

  return customerPay + cap;
}

function calculateEqualPlan(total, caps) {
  if (total <= 0 || caps.length === 0) {
    return {
      perMachinePay: 0,
      rows: caps.map((cap) => ({ cap, itemShare: 0, government: 0, customer: 0, unused: cap })),
      totalGovernment: 0,
      totalCustomer: 0,
      extra: 0,
      unused: caps.reduce((sum, cap) => sum + cap, 0),
    };
  }

  let low = 0;
  let high = total;

  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2;
    const covered = caps.reduce((sum, cap) => sum + transactionAtEqualPay(middle, cap), 0);
    if (covered < total) {
      low = middle;
    } else {
      high = middle;
    }
  }

  const perMachinePay = high;
  const rawRows = caps.map((cap) => {
    const itemShare = transactionAtEqualPay(perMachinePay, cap);
    const government = Math.min(itemShare * GOV_RATE, cap);
    return {
      cap,
      itemShare,
      government,
      customer: itemShare - government,
      unused: Math.max(cap - government, 0),
    };
  });

  const rawTotal = rawRows.reduce((sum, row) => sum + row.itemShare, 0) || 1;
  const rows = rawRows.map((row) => ({
    ...row,
    itemShare: row.itemShare * total / rawTotal,
  })).map((row) => {
    const government = Math.min(row.itemShare * GOV_RATE, row.cap);
    return {
      ...row,
      government,
      customer: row.itemShare - government,
      unused: Math.max(row.cap - government, 0),
    };
  });

  const totalGovernment = rows.reduce((sum, row) => sum + row.government, 0);
  const totalCustomer = total - totalGovernment;
  const expectedGovernment = total * GOV_RATE;
  const extra = Math.max(expectedGovernment - totalGovernment, 0);
  const unused = rows.reduce((sum, row) => sum + row.unused, 0);

  return {
    perMachinePay: totalCustomer / caps.length,
    rows,
    totalGovernment,
    totalCustomer,
    extra,
    unused,
  };
}

function createMachineRows(plan) {
  machineList.innerHTML = "";
  machines.forEach((cap, index) => {
    const row = plan.rows[index];
    const wrapper = document.createElement("div");
    wrapper.className = "machine-row";
    wrapper.dataset.index = String(index);
    wrapper.innerHTML = `
      <div class="machine-title">
        <strong>เครื่อง ${index + 1}</strong>
        <span>สิทธิที่เหลือ</span>
      </div>
      <label class="machine-cap">
        <input class="machine-input" type="number" inputmode="decimal" min="0" step="0.01" value="${format(cap)}" data-index="${index}" aria-label="สิทธิที่เหลือเครื่อง ${index + 1}">
        <span>บาท</span>
      </label>
      <div class="machine-meta">
        <div>
          <span>แบ่งสินค้า</span>
          <strong data-value="itemShare">${baht(row.itemShare)}</strong>
        </div>
        <div>
          <span>รัฐออก</span>
          <strong data-value="government">${baht(row.government)}</strong>
        </div>
        <div>
          <span>เราจ่าย</span>
          <strong data-value="customer">${baht(row.customer)}</strong>
        </div>
        <div>
          <span>เหลือหลังใช้</span>
          <strong data-value="unused">${baht(row.unused)}</strong>
        </div>
      </div>
    `;
    machineList.appendChild(wrapper);
  });
}

function syncMachineRows(plan) {
  if (machineList.children.length !== machines.length) {
    createMachineRows(plan);
    return;
  }

  plan.rows.forEach((row, index) => {
    const wrapper = machineList.querySelector(`[data-index="${index}"]`);
    if (!wrapper) {
      createMachineRows(plan);
      return;
    }

    wrapper.querySelector('[data-value="itemShare"]').textContent = baht(row.itemShare);
    wrapper.querySelector('[data-value="government"]').textContent = baht(row.government);
    wrapper.querySelector('[data-value="customer"]').textContent = baht(row.customer);
    wrapper.querySelector('[data-value="unused"]').textContent = baht(row.unused);
  });
}

function recalculateMulti() {
  const total = toNumber(multiTotalInput.value);
  const caps = machines.map((cap) => Math.max(cap, 0));
  const plan = calculateEqualPlan(total, caps);

  machineCount.textContent = `${machines.length} เครื่อง`;
  removeMachineButton.disabled = machines.length <= 1;
  equalPay.textContent = baht(plan.perMachinePay);
  multiGovernment.textContent = baht(plan.totalGovernment);
  multiCustomer.textContent = baht(plan.totalCustomer);
  multiExtra.textContent = plan.extra > EPSILON
    ? `${baht(plan.extra)} / เครื่องละ ${baht(plan.extra / machines.length)}`
    : "0 บาท";
  multiUnused.textContent = baht(plan.unused);

  syncMachineRows(plan);
}

function switchTab(tabId) {
  tabs.forEach((tab) => {
    const isActive = tab.id === tabId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    const isActive = panel.getAttribute("aria-labelledby") === tabId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    switchTab(tab.id);
    window.location.hash = tab.id === "multi-tab" ? "multi" : "single";
  });
});

[governmentInput, customerInput, totalInput].forEach((input) => {
  input.addEventListener("input", () => recalculateSingle(input));
  input.addEventListener("blur", () => {
    activeInput = null;
    recalculateSingle(input);
  });
});

multiTotalInput.addEventListener("input", recalculateMulti);
multiTotalInput.addEventListener("blur", () => {
  multiTotalInput.value = format(toNumber(multiTotalInput.value));
  recalculateMulti();
});

machineList.addEventListener("input", (event) => {
  if (!event.target.classList.contains("machine-input")) {
    return;
  }

  const index = Number.parseInt(event.target.dataset.index, 10);
  machines[index] = toNumber(event.target.value);
  recalculateMulti();
});

machineList.addEventListener("blur", (event) => {
  if (!event.target.classList.contains("machine-input")) {
    return;
  }

  const index = Number.parseInt(event.target.dataset.index, 10);
  machines[index] = toNumber(event.target.value);
  event.target.value = format(machines[index]);
  recalculateMulti();
}, true);

addMachineButton.addEventListener("click", () => {
  machines.push(200);
  recalculateMulti();
});

removeMachineButton.addEventListener("click", () => {
  if (machines.length > 1) {
    machines.pop();
    recalculateMulti();
  }
});

recalculateSingle(totalInput);
recalculateMulti();

if (window.location.hash === "#multi") {
  switchTab("multi-tab");
}
