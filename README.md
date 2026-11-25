# Ledger Audit

**Live:** https://zzevlovex.github.io/ledger-audit/

A simple, free, phone-friendly audit app for a school project. It runs fully in the browser: no server, no account, no paid services. Data is saved in the browser (IndexedDB) on the computer that runs it.

## Run

```
npm install
npm run dev      # open the printed localhost link
npm test         # unit tests
npm run build    # static build in dist/
```

Every push to `main` rebuilds and redeploys the site through GitHub Actions (`.github/workflows/deploy.yml`).

First run loads a demo company (Bayanihan Trading Corp., FY2025, ~500 ledger lines with planted errors). On the Payments page, **Load sample receipts** reads the 5 sample GCash-style receipts in `public/samples/`.

## Backup (keep your work safe)

Data is saved in the browser. To avoid losing it, use **Back up** (sidebar on desktop, **More** on phones). It downloads one file with everything, receipt images included. Keep it in Google Drive or on a USB stick.

**Restore** loads a backup file and replaces what's in the app. Use it to recover lost data or to move your work to another browser or device. The app shows how long ago the last backup was and warns after 7 days.

## Pages

- **Dashboard**: key numbers, test results chart, materiality. "Edit company & materiality" sets the company name, period and materiality.
- **Ledger**: import a CSV/XLSX general ledger, map columns, check debits = credits.
- **Payments**: upload GCash receipt screenshots (PNG/JPG). Text is read in the browser, you confirm the fields, then the payment is matched to the ledger. Flags duplicate reference numbers, amount differences and dates outside the period.
- **Testing**: journal entry tests (duplicates, round amounts, weekend and holiday postings, above materiality, gaps in numbering, unusual users) and a Benford's Law chart.
- **Findings**: record issues and proposed adjusting entries.
- **Statements**: balance sheet, income statement and trial balance, before and after proposed adjustments.
- **Reports**: one-page summary, Save as PDF (browser print) or CSV.

## Limits

- Account types come from the first digit of the account code (1 assets … 9 income tax).
- Holiday list covers fixed and Holy Week Philippine holidays only.
- The OCR model (~10 MB) downloads once on first use.
- Data lives in one browser. Clearing site data deletes it unless you have a backup file.

`scripts/make-receipts.ps1` regenerates the sample receipt images (Windows).
