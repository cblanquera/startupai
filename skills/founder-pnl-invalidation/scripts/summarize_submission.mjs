import { readFile } from "node:fs/promises";

const inputPath = process.argv[2];

if (!inputPath) {
  console.error("Usage: node summarize_submission.mjs <submission.json>");
  process.exit(1);
}

const submission = JSON.parse(await readFile(inputPath, "utf8"));

const founders = submission.founders || [];
const salaryPlan = submission.salaryPlan || [];
const expenses = submission.expenses || [];

const roleSalary = new Map(
  founders.map((founder) => [
    founder.name,
    Number(String(founder.fairMonthlySalary || "0").replace(/,/g, ""))
  ])
);

function toNumber(value) {
  return Number(String(value ?? "0").replace(/,/g, "")) || 0;
}

function cashSalaryForFounderMonth(founderName, month) {
  const starts = salaryPlan
    .filter((item) => item.founder === founderName)
    .map((item) => ({
      startMonth: Math.min(36, Math.max(1, toNumber(item.startMonth) || 1)),
      cashSalaryTaken: toNumber(item.cashSalaryTaken)
    }))
    .filter((item) => item.startMonth <= month)
    .sort((a, b) => a.startMonth - b.startMonth);
  return starts.at(-1)?.cashSalaryTaken || 0;
}

const deferredSalary = Array.from({ length: 36 }, (_, index) => index + 1).reduce((total, month) => {
  return total + founders.reduce((founderTotal, founder) => {
    const fairSalary = roleSalary.get(founder.name) || 0;
    const cashSalary = cashSalaryForFounderMonth(founder.name, month);
    return founderTotal + Math.max(0, fairSalary - cashSalary);
  }, 0);
}, 0);

const monthlyExpenses = expenses.reduce((total, item) => {
  return total + Number(String(item.monthlyAmount || "0").replace(/,/g, ""));
}, 0);

console.log(`# Founder P&L Invalidation Intake Summary`);
console.log("");
console.log(`Idea: ${submission.startup?.idea || "Missing"}`);
console.log("");
console.log(`Founders: ${founders.length}`);
console.log(`Deferred founder salary contribution: ${deferredSalary.toLocaleString()}`);
console.log(`Monthly operating expenses entered: ${monthlyExpenses.toLocaleString()}`);
