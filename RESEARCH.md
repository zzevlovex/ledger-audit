# Research — Ledger Audit app

Sources below come from web search result summaries (2026-11-25). Pages were not opened in full, so vendor claims are as the vendors state them.

## Tools reviewed

| Tool | Key features | UI patterns worth borrowing | Source |
|---|---|---|---|
| MindBridge | Scores 100% of GL entries; many rule tests ("control points") run at once; risk overview; samples stratified toward high/medium risk | Risk Overview tab summarizing each test's hit count; per-entry risk breakdown that shows which rules fired | [GL Analytics](https://www.mindbridge.ai/general-ledger-analytics/), [JET memo](https://www.mindbridge.ai/docs/library/MindBridge_for_Journal_Entry_Testing_Memo.pdf), [support](https://support.mindbridge.ai/hc/en-us/articles/360058269293) |
| DataSnipper | Matches Excel figures to source documents (invoices, bank statements); tickmarks; evidence stored with workpaper | Side-by-side document + data with links from figure to source; hover to review suggested matches | [Document matching](https://www.datasnipper.com/resources/feature-spotlight-document-matching), [v5.0](https://www.datasnipper.com/resources/everything-you-need-to-know-about-datasnipper-v5-0) |
| Inflo | Data ingestion from client ledgers; automated tests; fraud testing with high-risk visualization; workpapers; reports | Separate modules per job (Select / Detect / Workpapers / Reports) — maps to sidebar sections | [ICAEW](https://www.icaew.com/students/training/technology-hub/inflo), [CPA Ireland](https://cpaireland.ie/Digitalisation-Hub-Industry/Directory-Member/Software-Showcase/Inflo) |
| Caseware Cloud Audit | TB import → planning → risks linked to procedures → sign-off; review notes; audit trail | Manager view of open items and sign-off status during fieldwork | [Caseware Cloud Audit](https://www.caseware.com/products/caseware-cloud-audit-uk), [Review & sign-off docs](https://documentation.Caseware.com/2017/WorkingPapers/nl/Content/Engagement_Management/Electronic_Review_and_Signoff/ml_Electronic_Review_and_SignOff.htm) |
| Dext Prepare | Extracts document type, date, supplier, currency, total, tax; user corrects before publish | Item details page: image + editable fields; nothing posts until user publishes | [What Dext extracts](https://help.dext.com/en/s/article/what-data-is-extracted-by-dext-prepare) |

AuditBoard, TeamMate+, Expensify: not reviewed [unverified]; the five above cover the same patterns.

## GCash receipt fields to extract

From third-party guides ([techpilipinas](https://techpilipinas.com/gcash-reference-number/), [GCash Help](https://help.gcash.com/hc/articles/30245019590553)); exact screen labels [unverified] until tested on real screenshots:

- Reference number ("Ref No.")
- Amount (PHP) and fee, if shown
- Date and time
- Transaction type (Send Money, Pay Bills, Bank Transfer, etc.)
- Sender name and number
- Recipient name / merchant and number
- Message / notes

Note: a reference number proves the transaction was made, not that the money was received.

## Feature list (MVP)

1. **Engagements** — every test and finding needs a client, period and materiality to belong to.
2. **Ledger import + balance check** — nothing else works until the GL is loaded and debits = credits.
3. **Materiality calculator** — thresholds drive "above materiality" flags and adjustment totals.
4. **Journal entry tests + Benford** — core fraud test (management override); each flag shows its rule, as MindBridge does.
5. **Sampling (random + MUS, seeded)** — auditors must reproduce a sample; MUS weights toward big amounts.
6. **Findings + proposed adjustments** — the output of an audit; running total vs. materiality decides the opinion impact.
7. **Review sign-off + append-only audit trail** — Caseware-style preparer/reviewer gate; trail proves who did what.
8. **Reports (PDF/CSV)** — the deliverable to the client or partner.
9. **GCash receipt capture + ledger matching** — DataSnipper/Dext pattern: image beside editable fields, user confirms, then matched to GL.
