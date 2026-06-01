import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function reportFailure(error) {
  console.error(`Workbook generation failed: ${error?.name || "Error"}: ${error?.message || error}`);
  if (error?.stack) {
    console.error(error.stack.split("\n").slice(0, 6).join("\n"));
  }
  process.exit(1);
}

process.on("uncaughtException", reportFailure);
process.on("unhandledRejection", reportFailure);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(__dirname, "..");
const defaultOutputDir = path.join(skillDir, "outputs");
const inputPath = process.argv[2];
const outputPath = process.argv[3] || path.join(defaultOutputDir, "founder-pnl-invalidation-draft.xlsx");

if (!inputPath) {
  console.error("Usage: node generate_workbook.mjs <submission.json> [output.xlsx]");
  process.exit(1);
}

const workspaceNodeModules = process.env.WORKSPACE_NODE_MODULES;
if (!workspaceNodeModules) {
  console.error("Set WORKSPACE_NODE_MODULES to the bundled node_modules path that contains @oai/artifact-tool.");
  process.exit(1);
}

const requireFromHere = createRequire(import.meta.url);
const artifactToolPath = requireFromHere.resolve("@oai/artifact-tool", {
  paths: [workspaceNodeModules]
});
const { SpreadsheetFile, Workbook } = await import(pathToFileURL(artifactToolPath).href);

const submission = JSON.parse(await readFile(inputPath, "utf8"));
const workbook = Workbook.create();
const months = Array.from({ length: 36 }, (_, index) => index + 1);
const monthHeaders = months.map((month) => `M${month}`);
const pnlFirstMonthColumn = 2;
const pnlYtdColumn = pnlFirstMonthColumn + months.length;
const pnlYtdColumnName = columnName(pnlYtdColumn);
const expenseFirstMonthColumn = 3;
const expenseYtdColumn = expenseFirstMonthColumn + months.length;
const expenseYtdColumnName = columnName(expenseYtdColumn);
const revenueFirstMonthColumn = 7;
const revenueYtdColumn = revenueFirstMonthColumn + months.length;
const revenueYtdColumnName = columnName(revenueYtdColumn);

function founders() {
  return submission.founders || [];
}

function salaryPlan() {
  return submission.salaryPlan || [];
}

function expenses() {
  return submission.expenses || [];
}

function revenueModels() {
  if (Array.isArray(submission.revenueModels) && submission.revenueModels.length > 0) {
    return submission.revenueModels;
  }
  if (submission.revenueModel) {
    return [{
      name: "Revenue",
      type: "described",
      unit: "",
      frequency: "",
      description: submission.revenueModel.description || "",
      source: submission.revenueModel.source || ""
    }];
  }
  return [];
}

function toNumber(value) {
  return Number(String(value ?? "0").replace(/,/g, "")) || 0;
}

function columnNumber(name) {
  return name.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function columnName(number) {
  let name = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function rowsToRange(sheet, startCell, rows) {
  if (rows.length === 0) return;
  const startColumn = startCell.match(/[A-Z]+/)[0];
  const startRow = Number(startCell.match(/\d+/)[0]);
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => [...row, ...Array(width - row.length).fill(null)]);
  const endColumn = columnName(columnNumber(startColumn) + width - 1);
  const endRow = startRow + rows.length - 1;
  sheet.getRange(`${startCell}:${endColumn}${endRow}`).values = normalizedRows;
}

function styleTable(sheet, range, moneyColumns = []) {
  const [start, end] = range.split(":");
  const startColumn = start.match(/[A-Z]+/)[0];
  const startRow = start.match(/\d+/)[0];
  const endColumn = end.match(/[A-Z]+/)[0];
  const header = sheet.getRange(`${startColumn}${startRow}:${endColumn}${startRow}`);
  header.format.font = { bold: true, color: "#FFFFFF" };
  header.format.fill = "#0C6B58";
  sheet.getRange(range).format.borders = { preset: "outside", style: "thin", color: "#D7DBE2" };
  sheet.getRange(range).format.wrapText = true;
  for (const column of moneyColumns) {
    sheet.getRange(column).format.numberFormat = '"$"#,##0;[Red]("$"#,##0);-';
  }
}

function addSheet(name) {
  return workbook.worksheets.getOrAdd(name, { renameFirstIfOnlyNewSpreadsheet: true });
}

function founderSalary(founderName) {
  const founder = founders().find((candidate) => candidate.name === founderName);
  return toNumber(founder?.fairMonthlySalary);
}

function founderCashBuyIn(founder) {
  return toNumber(founder?.cashBuyIn);
}

function salaryStartsForFounder(founderName) {
  return salaryPlan()
    .filter((item) => item.founder === founderName)
    .map((item) => ({
      ...item,
      startMonth: Math.min(36, Math.max(1, toNumber(item.startMonth) || 1)),
      cashSalaryTaken: toNumber(item.cashSalaryTaken)
    }))
    .sort((a, b) => a.startMonth - b.startMonth);
}

function effectiveSalaryStarts() {
  return salaryPlan().map((item, index) => {
    const starts = salaryStartsForFounder(item.founder);
    const currentStart = Math.min(36, Math.max(1, toNumber(item.startMonth) || 1));
    const nextStart = starts.find((candidate) => candidate.startMonth > currentStart)?.startMonth;
    return {
      ...item,
      rowIndex: index,
      startMonth: currentStart,
      endMonth: nextStart ? nextStart - 1 : 36,
      cashSalaryTaken: toNumber(item.cashSalaryTaken)
    };
  });
}

function cashSalaryForFounderMonth(founderName, month) {
  const starts = salaryStartsForFounder(founderName).filter((item) => item.startMonth <= month);
  return starts.at(-1)?.cashSalaryTaken || 0;
}

function deferredSalaryByMonth() {
  return months.map((month) => founders().reduce((total, founder) => {
    const cashSalary = cashSalaryForFounderMonth(founder.name, month);
    return total + Math.max(0, founderSalary(founder.name) - cashSalary);
  }, 0));
}

function expenseAmountByMonth(expense) {
  const startMonth = toNumber(expense.startMonth) || 1;
  const amount = toNumber(expense.monthlyAmount);
  const timing = String(expense.timing || "Recurring").toLowerCase();
  if (timing.includes("one")) {
    return months.map((month) => (month === startMonth ? amount : 0));
  }
  return months.map((month) => (month >= startMonth ? amount : 0));
}

function founderDeferredTotal(founderName) {
  return months.reduce((total, month) => {
    const cashSalary = cashSalaryForFounderMonth(founderName, month);
    return total + Math.max(0, founderSalary(founderName) - cashSalary);
  }, 0);
}

function revenueAmountByMonth(model) {
  if (Array.isArray(model.monthlyRevenue)) {
    return months.map((month, index) => toNumber(model.monthlyRevenue[index] ?? model.monthlyRevenue[month - 1]));
  }
  const checkpoints = [
    { month: 1, value: toNumber(model.month1Revenue) },
    { month: 12, value: toNumber(model.month12Revenue) },
    { month: 24, value: toNumber(model.month24Revenue) },
    { month: 36, value: toNumber(model.month36Revenue) }
  ];
  return months.map((month) => {
    const exact = checkpoints.find((point) => point.month === month);
    if (exact) return exact.value;
    const previous = checkpoints.filter((point) => point.month < month).at(-1);
    const next = checkpoints.find((point) => point.month > month);
    if (!previous || !next) return previous?.value || 0;
    const progress = (month - previous.month) / (next.month - previous.month);
    return Math.round(previous.value + (next.value - previous.value) * progress);
  });
}

function monthRange(startMonth, endMonth, row) {
  return `${columnName(pnlFirstMonthColumn + startMonth - 1)}${row}:${columnName(pnlFirstMonthColumn + endMonth - 1)}${row}`;
}

const seriesASheet = addSheet("Series A");
const preSeedSheet = addSheet("Pre Seed");
const pnlSheet = addSheet("PNL");
const revenuesSheet = addSheet("Revenues");
const expensesSheet = addSheet("Expenses");
const rolesSheet = addSheet("Resource Rates");
const salarySheet = addSheet("Founder Salary Plan");
const sourcesSheet = addSheet("Sources");

const deferredSalary = deferredSalaryByMonth();

const expenseItems = [
  ...expenses().map((expense) => ({
    category: expense.category || "Operations",
    name: expense.name || expense.category || "Expense",
    monthly: expenseAmountByMonth(expense)
  })),
  ...founders().map((founder) => ({
    category: "Executive",
    name: `${founder.name || "Founder"} planned salary`,
    monthly: months.map(() => founderSalary(founder.name))
  }))
];
const categoryOrder = [];
for (const item of expenseItems) {
  if (!categoryOrder.includes(item.category)) categoryOrder.push(item.category);
}

const expenseRows = [["Category", "Name", ...monthHeaders, "YTD"]];
const itemRows = [];
const categoryTotalRows = [];
for (const category of categoryOrder) {
  const firstItemRow = expenseRows.length + 1;
  for (const item of expenseItems.filter((candidate) => candidate.category === category)) {
    const row = expenseRows.length + 1;
    expenseRows.push([category, item.name, ...item.monthly, null]);
    itemRows.push(row);
  }
  const lastItemRow = expenseRows.length;
  const totalRow = expenseRows.length + 1;
  expenseRows.push([category, `${category} Total`, ...months.map(() => null), null]);
  categoryTotalRows.push({ row: totalRow, firstItemRow, lastItemRow });
}
const expensesTotalRow = expenseRows.length + 1;
expenseRows.push(["Total Expenses", "", ...months.map(() => null), null]);

rowsToRange(expensesSheet, "A1", expenseRows);
for (const row of itemRows) {
  expensesSheet.getRange(`${expenseYtdColumnName}${row}`).formulas = [[`=SUM(C${row}:${columnName(expenseYtdColumn - 1)}${row})`]];
}
for (const total of categoryTotalRows) {
  expensesSheet.getRange(`C${total.row}:${expenseYtdColumnName}${total.row}`).formulas = [[
    ...months.map((_, index) => `=SUM(${columnName(index + expenseFirstMonthColumn)}${total.firstItemRow}:${columnName(index + expenseFirstMonthColumn)}${total.lastItemRow})`),
    `=SUM(${expenseYtdColumnName}${total.firstItemRow}:${expenseYtdColumnName}${total.lastItemRow})`
  ]];
  expensesSheet.getRange(`A${total.row}:${expenseYtdColumnName}${total.row}`).format.font = { bold: true };
}
expensesSheet.getRange(`C${expensesTotalRow}:${expenseYtdColumnName}${expensesTotalRow}`).formulas = [[
  ...months.map((_, index) => `=SUM(${categoryTotalRows.map((total) => `${columnName(index + expenseFirstMonthColumn)}${total.row}`).join(",")})`),
  `=SUM(${categoryTotalRows.map((total) => `${expenseYtdColumnName}${total.row}`).join(",")})`
]];
styleTable(expensesSheet, `A1:${expenseYtdColumnName}${expensesTotalRow}`, [`C:${expenseYtdColumnName}`]);
expensesSheet.getRange(`A${expensesTotalRow}:${expenseYtdColumnName}${expensesTotalRow}`).format.font = { bold: true };
expensesSheet.getRange("A:B").format.columnWidthPx = 180;
expensesSheet.getRange(`C:${expenseYtdColumnName}`).format.columnWidthPx = 86;

const revenueRows = [
  ["Revenue Model", "Type", "Unit", "Frequency", "Conservative Explanation", "Source", ...monthHeaders, "YTD"],
  ...revenueModels().map((model, index) => {
    const row = index + 2;
    return [
      model.name || `Model ${index + 1}`,
      model.type || "",
      model.unit || "",
      model.frequency || "",
      model.description || "",
      model.source || "",
      ...revenueAmountByMonth(model),
      `=SUM(G${row}:${columnName(6 + months.length)}${row})`
    ];
  }),
  ["Total Revenue", "", "", "", "", "", ...months.map(() => null), null]
];
const revenueTotalRow = revenueRows.length;
rowsToRange(revenuesSheet, "A1", [
  ...revenueRows.map((row) => row.map((cell) => (typeof cell === "string" && cell.startsWith("=") ? null : cell)))
]);
if (revenueModels().length > 0) {
  revenuesSheet.getRange(`${revenueYtdColumnName}2:${revenueYtdColumnName}${revenueModels().length + 1}`).formulas = revenueModels().map((_, index) => {
    const row = index + 2;
    return [`=SUM(G${row}:${columnName(revenueYtdColumn - 1)}${row})`];
  });
}
revenuesSheet.getRange(`G${revenueTotalRow}:${revenueYtdColumnName}${revenueTotalRow}`).formulas = [[
  ...months.map((_, index) => `=SUM(${columnName(revenueFirstMonthColumn + index)}2:${columnName(revenueFirstMonthColumn + index)}${Math.max(2, revenueTotalRow - 1)})`),
  `=SUM(${revenueYtdColumnName}2:${revenueYtdColumnName}${Math.max(2, revenueTotalRow - 1)})`
]];
styleTable(revenuesSheet, `A1:${revenueYtdColumnName}${revenueTotalRow}`, [`G:${revenueYtdColumnName}`]);
revenuesSheet.getRange(`A${revenueTotalRow}:${revenueYtdColumnName}${revenueTotalRow}`).format.font = { bold: true };
revenuesSheet.getRange("A:F").format.columnWidthPx = 170;
revenuesSheet.getRange(`G:${revenueYtdColumnName}`).format.columnWidthPx = 86;

rowsToRange(pnlSheet, "A1", [
  ["Line", ...monthHeaders, "YTD"],
  ["Revenues", ...months.map((_, index) => `=Revenues!${columnName(index + revenueFirstMonthColumn)}${revenueTotalRow}`), `=SUM(B2:${columnName(pnlYtdColumn - 1)}2)`],
  ["Cost of Sales", ...months.map(() => 0), `=SUM(B3:${columnName(pnlYtdColumn - 1)}3)`],
  ["Gross Profit", ...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}2-${columnName(index + pnlFirstMonthColumn)}3`), `=SUM(B4:${columnName(pnlYtdColumn - 1)}4)`],
  ["Operating Expenses", ...months.map((_, index) => `=Expenses!${columnName(index + expenseFirstMonthColumn)}${expensesTotalRow}`), `=SUM(B5:${columnName(pnlYtdColumn - 1)}5)`],
  ["EBT", ...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}4-${columnName(index + pnlFirstMonthColumn)}5`), `=SUM(B6:${columnName(pnlYtdColumn - 1)}6)`],
  ["Advances", ...deferredSalary, `=SUM(B7:${columnName(pnlYtdColumn - 1)}7)`],
  ["Investment Needed", ...months.map((_, index) => `=MAX(0,-(${columnName(index + pnlFirstMonthColumn)}6+${columnName(index + pnlFirstMonthColumn)}7))`), `=SUM(B8:${columnName(pnlYtdColumn - 1)}8)`],
  ["Net Cash After Financing", ...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}6+${columnName(index + pnlFirstMonthColumn)}7+${columnName(index + pnlFirstMonthColumn)}8`), `=SUM(B9:${columnName(pnlYtdColumn - 1)}9)`]
]);
pnlSheet.getRange(`B2:${pnlYtdColumnName}9`).formulas = [
  [...months.map((_, index) => `=Revenues!${columnName(index + revenueFirstMonthColumn)}${revenueTotalRow}`), `=SUM(B2:${columnName(pnlYtdColumn - 1)}2)`],
  [...months.map(() => "0"), `=SUM(B3:${columnName(pnlYtdColumn - 1)}3)`],
  [...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}2-${columnName(index + pnlFirstMonthColumn)}3`), `=SUM(B4:${columnName(pnlYtdColumn - 1)}4)`],
  [...months.map((_, index) => `=Expenses!${columnName(index + expenseFirstMonthColumn)}${expensesTotalRow}`), `=SUM(B5:${columnName(pnlYtdColumn - 1)}5)`],
  [...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}4-${columnName(index + pnlFirstMonthColumn)}5`), `=SUM(B6:${columnName(pnlYtdColumn - 1)}6)`],
  [...deferredSalary.map((value) => String(value)), `=SUM(B7:${columnName(pnlYtdColumn - 1)}7)`],
  [...months.map((_, index) => `=MAX(0,-(${columnName(index + pnlFirstMonthColumn)}6+${columnName(index + pnlFirstMonthColumn)}7))`), `=SUM(B8:${columnName(pnlYtdColumn - 1)}8)`],
  [...months.map((_, index) => `=${columnName(index + pnlFirstMonthColumn)}6+${columnName(index + pnlFirstMonthColumn)}7+${columnName(index + pnlFirstMonthColumn)}8`), `=SUM(B9:${columnName(pnlYtdColumn - 1)}9)`]
];
styleTable(pnlSheet, `A1:${pnlYtdColumnName}9`, [`B:${pnlYtdColumnName}`]);
pnlSheet.getRange("A:A").format.columnWidthPx = 190;
pnlSheet.getRange(`B:${pnlYtdColumnName}`).format.columnWidthPx = 86;
pnlSheet.getRange(`A4:${pnlYtdColumnName}4`).format.font = { bold: true };
pnlSheet.getRange(`A6:${pnlYtdColumnName}6`).format.font = { bold: true };
pnlSheet.getRange(`A6:${pnlYtdColumnName}9`).format.font = { bold: true };

const investorRow = founders().length + 2;
const totalRow = founders().length + 3;
const preSeedRows = [
  ["Shareholder", "Cash Buy In", "Salary Advances", "Total Value", "Split"],
  ...founders().map((founder, index) => {
    const row = index + 2;
    return [
      founder.name || "",
      founderCashBuyIn(founder),
      founderDeferredTotal(founder.name),
      `=B${row}+C${row}`,
      `=IF(SUM($D$2:$D$${investorRow})=0,0,D${row}/SUM($D$2:$D$${investorRow}))`
    ];
  }),
  ["Investment Group", `=CEILING(PNL!${pnlYtdColumnName}8,10000)`, 0, `=B${investorRow}+C${investorRow}`, `=IF(SUM($D$2:$D$${investorRow})=0,0,D${investorRow}/SUM($D$2:$D$${investorRow}))`],
  ["Total", `=SUM(B2:B${investorRow})`, `=SUM(C2:C${investorRow})`, `=SUM(D2:D${investorRow})`, `=SUM(E2:E${investorRow})`]
];
rowsToRange(preSeedSheet, "A1", preSeedRows.map((row) => row.map((cell) => (typeof cell === "string" && cell.startsWith("=") ? null : cell))));
if (founders().length > 0) {
  preSeedSheet.getRange(`D2:E${founders().length + 1}`).formulas = founders().map((_, index) => {
    const row = index + 2;
    return [`=B${row}+C${row}`, `=IF(SUM($D$2:$D$${investorRow})=0,0,D${row}/SUM($D$2:$D$${investorRow}))`];
  });
}
preSeedSheet.getRange(`B${investorRow}:E${totalRow}`).formulas = [
  [`=CEILING(PNL!${pnlYtdColumnName}8,10000)`, "0", `=B${investorRow}+C${investorRow}`, `=IF(SUM($D$2:$D$${investorRow})=0,0,D${investorRow}/SUM($D$2:$D$${investorRow}))`],
  [`=SUM(B2:B${investorRow})`, `=SUM(C2:C${investorRow})`, `=SUM(D2:D${investorRow})`, `=SUM(E2:E${investorRow})`]
];
styleTable(preSeedSheet, `A1:E${totalRow}`, ["B:D"]);
preSeedSheet.getRange("E:E").format.numberFormat = "0.0%";
preSeedSheet.getRange("A:E").format.columnWidthPx = 155;

rowsToRange(seriesASheet, "A1", [
  ["Series A Estimate", "Value", "Notes"],
  ["Cash in bank, last projected year", `=SUM(PNL!${monthRange(25, 36, 9)})`, "Uses the final projected year net cash after financing."],
  ["Exit value", "=MAX(0,B2)*10", "Cash in bank times 10."],
  ["Series C value", "=B3/2", "Backsolved by dividing exit value by 2."],
  ["Series B value", "=B4/2", "Backsolved by dividing Series C value by 2."],
  ["Series A post-money value", "=B5/2", "Backsolved by dividing Series B value by 2."],
  ["Founder shares before employee pool", `=SUM('Pre Seed'!D2:D${founders().length + 1})`, "Founder cash buy-in plus salary advances at $1/share."],
  ["Pre-seed investor shares", `='Pre Seed'!D${investorRow}`, "Investment Group shares stay separate from founder shares."],
  ["Employee pool reserve", 0.1, "10% carved out of founder-held shares."],
  ["Founder shares after employee pool", "=B7*(1-B9)", "Founder shares after holding employee pool in trust."],
  ["Employee pool shares", "=B7*B9", "Vested employee stock group carved from founders."],
  ["Pre-Series A shares", "=B10+B11+B8", "Founder, employee pool, and pre-seed investor shares before Series A."],
  ["Pre-seed price/share", 1, "Pre-seed teaching convention."],
  ["Series A ownership sold", 0.2, "Default target: sell 20% of company."],
  ["Series A new shares issued", "=IF(B6<=0,\"\",B12*B14/(1-B14))", "New shares needed to sell 20% post-money."],
  ["Series A shares post-financing", "=IF(B15=\"\",\"\",B12+B15)", "Pre-Series A shares plus new Series A shares."],
  ["Series A investment", "=IF(B6<=0,\"\",B6*B14)", "Cash raised at Series A if 20% is sold."],
  ["Series A price/share", "=IF(B15=\"\",\"\",B17/B15)", "Implied Series A cost per share."],
  ["Founder ownership after A", "=IF(B16=\"\",\"\",B10/B16)", "Founder ownership after employee pool and Series A dilution."],
  ["Employee pool ownership after A", "=IF(B16=\"\",\"\",B11/B16)", "Vested employee stock group ownership after Series A."],
  ["Pre-seed investor ownership after A", "=IF(B16=\"\",\"\",B8/B16)", "Investment Group ownership after Series A."],
  ["Series A investor ownership after A", "=IF(B16=\"\",\"\",B15/B16)", "Should equal the Series A ownership sold assumption."],
  [],
  ["Source", "Wall Street Prep VC Method", "Uses VC-method style backsolving, simplified into exit/C/B/A round ladder."]
]);
seriesASheet.getRange("B2:B22").formulas = [
  [`=SUM(PNL!${monthRange(25, 36, 9)})`],
  ["=MAX(0,B2)*10"],
  ["=B3/2"],
  ["=B4/2"],
  ["=B5/2"],
  [`=SUM('Pre Seed'!D2:D${founders().length + 1})`],
  [`='Pre Seed'!D${investorRow}`],
  ["0.1"],
  ["=B7*(1-B9)"],
  ["=B7*B9"],
  ["=B10+B11+B8"],
  ["1"],
  ["0.2"],
  ["=IF(B6<=0,\"\",B12*B14/(1-B14))"],
  ["=IF(B15=\"\",\"\",B12+B15)"],
  ["=IF(B6<=0,\"\",B6*B14)"],
  ["=IF(B15=\"\",\"\",B17/B15)"],
  ["=IF(B16=\"\",\"\",B10/B16)"],
  ["=IF(B16=\"\",\"\",B11/B16)"],
  ["=IF(B16=\"\",\"\",B8/B16)"],
  ["=IF(B16=\"\",\"\",B15/B16)"]
];
styleTable(seriesASheet, "A1:C24", ["B:B"]);
seriesASheet.getRange("A:C").format.columnWidthPx = 230;
seriesASheet.getRange("B2:B6").format.numberFormat = '"$"#,##0;[Red]("$"#,##0);-';
seriesASheet.getRange("B7:B12").format.numberFormat = "#,##0";
seriesASheet.getRange("B13").format.numberFormat = "$0.00";
seriesASheet.getRange("B9:B14").format.numberFormat = "0.0%";
seriesASheet.getRange("B15:B16").format.numberFormat = "#,##0";
seriesASheet.getRange("B17").format.numberFormat = '"$"#,##0;[Red]("$"#,##0);-';
seriesASheet.getRange("B18").format.numberFormat = "$0.00";
seriesASheet.getRange("B19:B22").format.numberFormat = "0.0%";

const roleRows = [
  ["Founder", "Role", "Fair Monthly Salary", "Outsourced Hourly Rate", "Rate Logic"],
  ...founders().map((founder, index) => [
    founder.name || "",
    founder.role || "",
    toNumber(founder.fairMonthlySalary),
    `=(C${index + 2}*2/160)*1.3`,
    "Monthly salary x 2 / 160, plus 30% outsourcing margin"
  ])
];
rowsToRange(rolesSheet, "A1", roleRows.map((row) => row.map((cell) => (typeof cell === "string" && cell.startsWith("=") ? null : cell))));
if (founders().length > 0) {
  rolesSheet.getRange(`D2:D${founders().length + 1}`).formulas = founders().map((_, index) => [`=(C${index + 2}*2/160)*1.3`]);
}
styleTable(rolesSheet, `A1:E${Math.max(2, roleRows.length)}`, ["C:D"]);
rolesSheet.getRange("A:E").format.columnWidthPx = 170;

const salaryRows = [
  ["Founder", "Start Month", "Assumed Through Month", "Fair Monthly Salary", "Cash Salary Taken", "Deferred Salary", "Deferred Total"],
  ...effectiveSalaryStarts().map((item, index) => {
    const row = index + 2;
    return [
      item.founder || "",
      toNumber(item.startMonth),
      toNumber(item.endMonth),
      founderSalary(item.founder),
      item.cashSalaryTaken,
      `=MAX(0,D${row}-E${row})`,
      `=MAX(0,C${row}-B${row}+1)*F${row}`
    ];
  })
];
rowsToRange(salarySheet, "A1", salaryRows.map((row) => row.map((cell) => (typeof cell === "string" && cell.startsWith("=") ? null : cell))));
if (salaryPlan().length > 0) {
  salarySheet.getRange(`F2:G${salaryPlan().length + 1}`).formulas = salaryPlan().map((_, index) => {
    const row = index + 2;
    return [`=MAX(0,D${row}-E${row})`, `=MAX(0,C${row}-B${row}+1)*F${row}`];
  });
}
styleTable(salarySheet, `A1:G${Math.max(2, salaryRows.length)}`, ["D:G"]);
salarySheet.getRange("A:G").format.columnWidthPx = 150;

const sourceRows = [["Item", "Source", "Notes"]];
for (const founder of founders()) {
  sourceRows.push([`${founder.name || "Founder"} salary benchmark`, "", `Founder-entered role: ${founder.role || ""}`]);
}
for (const model of revenueModels()) {
  sourceRows.push([`${model.name || "Revenue model"} revenue model`, model.source || "", model.description || ""]);
}
sourceRows.push(["Series A VC method", "https://www.wallstreetprep.com/knowledge/vc-valuation-6-steps-to-valuing-early-stage-firms-excel-template/", "Used as structure for the Series A teaching tab."]);
for (const expense of expenses()) {
  sourceRows.push([`${expense.category || "Expense"} expense`, expense.source || "", `Starts month ${expense.startMonth || ""}`]);
}
rowsToRange(sourcesSheet, "A1", sourceRows);
styleTable(sourcesSheet, `A1:C${Math.max(2, sourceRows.length)}`);
sourcesSheet.getRange("A:C").format.columnWidthPx = 260;

await mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
