---
name: founder-pnl-invalidation
description: Use when helping startup founders pressure-test an idea with a conservative founder-contribution P&L, deferred salary logic, source-backed assumptions, funding need, and an interactive intake flow before workbook generation.
---

# Founder P&L Invalidation

Use this skill to act like an interactive analyst for founders before they build a startup. The goal is to present conservative, source-backed numbers so founders can decide for themselves whether to continue, rethink, self-fund, or raise.

## Core Position

This is an educational founder-contribution workbook, not a strict accounting P&L.

- Founder time has replacement cost.
- Salary actually paid is operating expense.
- Salary not taken is founder contribution.
- Full salary taken creates no labor contribution credit.
- Partial salary creates contribution credit only for the unpaid portion.
- Revenue should be conservative and scenario-tested.
- Assumptions should cite sources where practical.
- The workbook should not decide for the founder. It should make the operating loss, founder advances, and implied investment need clear enough for founders and investors to evaluate.

## Workflow

1. Run the intake server:
   ```bash
   node skills/founder-pnl-invalidation/scripts/start_intake_server.mjs
   ```
2. Open the printed local URL in the in-app browser.
3. Have founders complete the intake wizard.
4. Read the saved JSON submission from `skills/founder-pnl-invalidation/data/submissions/`.
5. Summarize the submitted assumptions:
   ```bash
   node skills/founder-pnl-invalidation/scripts/summarize_submission.mjs <submission.json>
   ```
6. Generate the first workbook draft:
   ```bash
   WORKSPACE_NODE_MODULES=/path/to/workspace/node_modules \
   node skills/founder-pnl-invalidation/scripts/generate_workbook.mjs <submission.json>
   ```
7. Ask clarifying questions only where the submission is materially incomplete.

## Intake Coverage

The intake should gather:

- Startup idea
- Founders, roles, fair monthly salaries, and cash buy-in by founder
- Salary plan starts: each time a founder starts taking salary or increases take-home salary, capture founder, from month, and monthly cash salary taken. The latest amount continues through the projection.
- Open-ended possible business models for a technology product, including who pays, what they pay for, pricing mechanics, billing frequency, conservative adoption assumptions, evidence/benchmarks, and an example revenue ramp for review.
- Operating expenses, including recurring and one-time costs, with source links or notes
- Funding need is calculated from the PNL and Pre Seed tabs, not collected from founders as an intake answer

## Modeling Rules

Founder labor rate:

```text
outsourced_hourly_rate = (fair_monthly_salary * 2 / 160) * 1.30
```

Explanation:

- `fair_monthly_salary` is the local market salary for the role.
- `2 / 160` converts monthly employee salary into an approximate outsourced hourly replacement cost.
- `1.30` adds a 30% vendor margin.

Deferred salary:

```text
deferred_salary = max(0, fair_monthly_salary - cash_salary_taken)
```

Only `deferred_salary` counts as founder contribution. If a founder takes full salary, deferred salary is zero.

## Workbook Shape

The draft workbook generator currently creates these sheets:

- `Series A`
- `Pre Seed`
- `PNL`
- `Revenues`
- `Expenses`
- `Resource Rates`
- `Founder Salary Plan`
- `Sources`

In `PNL`, investment need should follow the founder workshop rule:

```text
investment_needed = EBT + advances
```

Keep investment/support rows visibly separate from operating profit so founders understand both the P&L and the founder-contribution math.

`Pre Seed` should include:

- one row per founder, with founder-specific cash buy-in defaulting to zero
- one `Investment Group` row, with cash buy-in set to the rounded investment needed
- salary advances only for founders, not for the investment group

`Series A` should use the VC method as a teaching model:

- estimate investment needed
- forecast financials
- determine exit timing
- apply an exit multiple
- discount exit value at the required return
- calculate implied valuation and investor ownership
- keep founder shares and the pre-seed `Investment Group` shares separate
- add a vested employee stock group, defaulting to 10% carved directly from founder-held shares before Series A dilution
- show post-Series A ownership for founders, employee pool, pre-seed investors, and Series A investors

Use a 3-year projection by default, or the first year where exit value reaches at least `$100M`, whichever comes first.
