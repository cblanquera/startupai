const form = document.querySelector("#intakeForm");
const steps = Array.from(document.querySelectorAll(".step"));
const backBtn = document.querySelector("#backBtn");
const nextBtn = document.querySelector("#nextBtn");
const submitBtn = document.querySelector("#submitBtn");
const stepNow = document.querySelector("#stepNow");
const stepTotal = document.querySelector("#stepTotal");
const result = document.querySelector("#result");

const repeaters = {
  founders: {
    title: "Founder",
    minRows: 1,
    fields: [
      { key: "name", label: "Name", required: true, placeholder: "Alex" },
      { key: "role", label: "Role", required: true, placeholder: "CEO / Sales" },
      { key: "fairMonthlySalary", label: "Fair monthly salary", type: "number", required: true, placeholder: "4000" },
      { key: "cashBuyIn", label: "Cash buy-in", type: "number", placeholder: "0" }
    ]
  },
  salaryPlan: {
    title: "Salary start",
    minRows: 1,
    fields: [
      { key: "founder", label: "Founder", required: true, placeholder: "Alex" },
      { key: "startMonth", label: "From month", type: "number", required: true, placeholder: "1" },
      { key: "cashSalaryTaken", label: "Monthly cash salary taken", type: "number", required: true, placeholder: "0" }
    ]
  },
  revenueModels: {
    title: "Possible business model",
    minRows: 1,
    fields: [
      {
        key: "description",
        label: "Model explanation",
        type: "textarea",
        className: "span-2",
        required: true,
        placeholder: "Example: Coaches pay a monthly subscription to list and sell training programs. Use a conservative starting assumption such as $80/month per active coach, slow adoption, and cite competitor pricing or a benchmark."
      },
      { key: "source", label: "Evidence or benchmark", className: "span-2", placeholder: "Competitor pricing, marketplace benchmark, customer interview, industry report" },
      { key: "month1Revenue", label: "Example M1 revenue", type: "number", placeholder: "0" },
      { key: "month12Revenue", label: "Example M12 revenue", type: "number", placeholder: "800" },
      { key: "month24Revenue", label: "Example M24 revenue", type: "number", placeholder: "2400" },
      { key: "month36Revenue", label: "Example M36 revenue", type: "number", placeholder: "6400" }
    ]
  },
  expenses: {
    title: "Expense",
    minRows: 1,
    fields: [
      { key: "category", label: "Section", required: true, placeholder: "Tech, Operations, Marketing, Legal" },
      { key: "name", label: "Expense name", required: true, placeholder: "Hosting" },
      { key: "timing", label: "Timing", type: "select", required: true, options: ["Recurring", "One-time"] },
      { key: "monthlyAmount", label: "Amount", type: "number", required: true, placeholder: "100" },
      { key: "startMonth", label: "Start month", type: "number", required: true, placeholder: "1" },
      { key: "source", label: "Source or note", className: "span-2", placeholder: "AWS calculator, vendor quote, benchmark" }
    ]
  }
};

let stepIndex = 0;
stepTotal.textContent = String(steps.length);

function showStep(index) {
  stepIndex = index;
  steps.forEach((step, current) => {
    step.classList.toggle("is-active", current === stepIndex);
  });
  stepNow.textContent = String(stepIndex + 1);
  backBtn.disabled = stepIndex === 0;
  nextBtn.hidden = stepIndex === steps.length - 1;
  submitBtn.hidden = stepIndex !== steps.length - 1;
}

function currentFieldsAreValid() {
  const fields = Array.from(steps[stepIndex].querySelectorAll("input, textarea, select"));
  return fields.every((field) => field.reportValidity());
}

function fieldControl(collectionName, field, value = "") {
  const tag = field.type === "textarea" ? "textarea" : field.type === "select" ? "select" : "input";
  const control = document.createElement(tag);
  control.name = `${collectionName}.${field.key}`;
  control.dataset.key = field.key;
  if (tag === "select") {
    for (const optionLabel of field.options || []) {
      const option = document.createElement("option");
      option.value = optionLabel;
      option.textContent = optionLabel;
      control.append(option);
    }
  }
  if (tag === "input") {
    control.type = field.type || "text";
    if (control.type === "number") {
      control.min = "0";
      control.step = "1";
    }
  }
  control.placeholder = field.placeholder || "";
  control.required = Boolean(field.required);
  control.value = value;
  return control;
}

function addRepeaterRow(collectionName, values = {}) {
  const config = repeaters[collectionName];
  const list = document.querySelector(`[data-collection="${collectionName}"]`);
  const row = document.createElement("fieldset");
  row.className = "input-row";
  row.dataset.row = collectionName;

  const header = document.createElement("div");
  header.className = "input-row-header";

  const title = document.createElement("div");
  title.className = "input-row-title";
  title.textContent = `${config.title} ${list.children.length + 1}`;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-row";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    if (list.children.length <= config.minRows) return;
    row.remove();
    renumberRows(collectionName);
  });

  header.append(title, remove);
  row.append(header);

  const grid = document.createElement("div");
  grid.className = "input-grid";
  for (const field of config.fields) {
    const label = document.createElement("label");
    if (field.className) label.className = field.className;
    label.textContent = field.label;
    label.append(fieldControl(collectionName, field, values[field.key] || ""));
    grid.append(label);
  }
  row.append(grid);
  list.append(row);
  renumberRows(collectionName);
}

function renumberRows(collectionName) {
  const config = repeaters[collectionName];
  const list = document.querySelector(`[data-collection="${collectionName}"]`);
  Array.from(list.children).forEach((row, index) => {
    row.querySelector(".input-row-title").textContent = `${config.title} ${index + 1}`;
    row.querySelector(".remove-row").disabled = list.children.length <= config.minRows;
  });
}

function collectionRows(collectionName) {
  return Array.from(document.querySelectorAll(`[data-row="${collectionName}"]`)).map((row, index) => {
    const values = Object.fromEntries(
      Array.from(row.querySelectorAll("[data-key]")).map((field) => [field.dataset.key, field.value.trim()])
    );
    if (collectionName === "revenueModels") {
      return {
        name: `Model ${index + 1}`,
        type: "open ended",
        unit: "",
        frequency: "",
        ...values
      };
    }
    return values;
  });
}

function formPayload() {
  const data = new FormData(form);
  return {
    submittedAt: new Date().toISOString(),
    startup: {
      idea: data.get("idea")
    },
    founders: collectionRows("founders"),
    salaryPlan: collectionRows("salaryPlan"),
    revenueModels: collectionRows("revenueModels"),
    expenses: collectionRows("expenses")
  };
}

document.querySelectorAll("[data-add-row]").forEach((button) => {
  button.addEventListener("click", () => addRepeaterRow(button.dataset.addRow));
});

backBtn.addEventListener("click", () => showStep(Math.max(0, stepIndex - 1)));

nextBtn.addEventListener("click", () => {
  if (currentFieldsAreValid()) {
    showStep(Math.min(steps.length - 1, stepIndex + 1));
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentFieldsAreValid()) return;

  submitBtn.disabled = true;
  result.hidden = true;

  try {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(formPayload(), null, 2)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Submission failed");

    result.innerHTML = `<strong>Submission saved</strong><code>${body.path}</code>`;
    result.hidden = false;
  } catch (error) {
    result.innerHTML = `<strong>Could not save submission</strong>${error.message}`;
    result.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

addRepeaterRow("founders", { name: "Alex", role: "CEO / Sales", fairMonthlySalary: "4000", cashBuyIn: "0" });
addRepeaterRow("founders", { name: "Sam", role: "CTO", fairMonthlySalary: "5000", cashBuyIn: "0" });
addRepeaterRow("salaryPlan", { founder: "Alex", startMonth: "1", cashSalaryTaken: "0" });
addRepeaterRow("salaryPlan", { founder: "Sam", startMonth: "1", cashSalaryTaken: "0" });
addRepeaterRow("salaryPlan", { founder: "Sam", startMonth: "7", cashSalaryTaken: "2500" });
addRepeaterRow("revenueModels", {
  description: "Coaches pay a monthly subscription to list and sell training programs. Conservative starting assumption: $80 per active coach per month with slow adoption, based on competitor pricing.",
  source: "competitor pricing",
  month1Revenue: "0",
  month12Revenue: "800",
  month24Revenue: "2400",
  month36Revenue: "6400"
});
addRepeaterRow("expenses", { category: "Tech", name: "Hosting", timing: "Recurring", monthlyAmount: "100", startMonth: "1", source: "AWS calculator" });
showStep(0);
