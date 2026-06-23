# Archive — original logistics product

This is the codebase from the original freight/logistics intelligence product
built before TariffLens. Do not import from here in the active app.

## Why it's kept

The extraction logic here is genuinely good, especially for handwritten documents
(bilties, lorry receipts, handwritten invoices). The current extract-shipment
function works well for typed PDFs and invoices but the older approach handled
messy, handwritten, and multilingual docs better.

When upgrading document extraction in TariffLens — especially for:
- Handwritten invoices or packing lists
- Vernacular/regional language documents
- Messy scanned docs with partial OCR

...look here first before rewriting from scratch.

## Key files

### lib/
- `generateBilty.ts` — bilty (lorry receipt) generation logic. The field extraction
  and data structuring here is the gold standard for Indian trade docs.
- `redFlagEngine.ts` (569 lines) — risk signal detection across document fields.
  Solid logic for spotting inconsistencies between declared vs actual values.
- `riskSignals.ts` (624 lines) — signal weighting and scoring. The multi-signal
  approach here is more rigorous than the current single-score system.
- `documentReconciler.ts` — reconciles extracted fields across multiple documents
  (e.g. invoice vs packing list vs bill of lading). Directly applicable to
  TariffLens multi-document upload when that gets built.
- `narrativeGenerator.ts` — generates human-readable summaries from structured
  risk data. Reusable pattern.
- `shipmentClassifier.ts` — classifies cargo type (ODC/LOOSE/MIXED) from weight
  and package counts. Useful for freight cost estimation features.
- `regulationMatcher.ts` — matches shipment data against regulation patterns.
  Applicable to compliance checking feature.

### supabase/functions/_archive/
- `extract-lr/` — lorry receipt extraction. Best example of handwritten doc handling.
- `chat/` — streaming chat with tool use. Reference for if/when TariffLens adds
  a chat interface.
- `scrape-regulations/` — regulation scraper (separate from scrape-tariffs).
- `transcribe/` — audio transcription function.
- `fix-document/` — document correction/validation flow.

### pages/
- `ReportPage.tsx` — full report UI with signal groups, narrative, action items.
  The layout and information hierarchy here is better than the current results page
  in some ways. Worth referencing when rebuilding the results experience.
- `ChatPage.tsx` — streaming chat UI.
- `BiltyPage.tsx` — bilty generation flow.

### components/
- `report/` — ReportHeader, NarrativeSection, SignalGroupSection, ActionItems,
  DataConsistencyPanel. All reusable patterns for displaying structured risk data.
- `chat/` — EditApprovalCard, RegulationImpactBanner.
