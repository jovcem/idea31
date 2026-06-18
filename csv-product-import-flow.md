# CSV Product Import Flow

Reference implementation: `cms-frontend` repo.

---

## Overview

Users upload a CSV file through a modal. Items ≤50 are imported directly; larger batches are queued as async background jobs via S3.

---

## Step-by-Step Flow

### 1. User Uploads CSV (Frontend)

- Component: `ImportModalProduct.tsx`
- User selects a `.csv` file via a file input.
- The file is read client-side and parsed into rows.
- Each row is validated against expected headers (product code, name, family, type, dimensions, etc.).

**Expected CSV columns** (from `shared/projects/projectProductImportHeaders.ts`):
- Product ID, Product Code, Product Name, Page URL
- Product Family, Product Type, Version Type
- Archetype (boolean flag)
- Width, Height, Depth, Unit (Cm or In)
- Product Class Name / Product Class ID
- Project ID (optional)

---

### 2. CSV Parsing

- Low-level stream parsing: `shared/uploader/parseCsv.ts` (uses `csv-parse` library)
- Upload handler: `shared/uploader/csvUploader.ts` (uses `busboy` for multipart)
- Each row is passed to `ProductProjectCSVRecordParser.ts` which:
  - Maps header names to internal fields
  - Validates formats (product code, URL, dimensions, types)
  - Detects duplicates by code and name

---

### 3. Status Determination

- `api-src/src/services/productProjectItemImport/GetProjectProduct.ts`
- Each parsed row gets a status:
  - **New** — product doesn't exist yet
  - **Existing** — product already in the system
  - **Duplicate** — same code/name found in the upload itself

---

### 4. Branch: Small vs Large Batch

#### Small batch (≤50 items) — Direct Import
- API route: `src/pages/api/rest/upload/product-project-items-new.ts`
- Calls `ProductProjectItemImporter.ts` directly
- Runs synchronously, returns results immediately
- Frontend fires GraphQL mutations:
  - `ImportModalCreateProductData` — creates product records
  - `ImportModalUpdateReviewItems` — updates review/status on items

#### Large batch (>50 items) — Job-based Async Import
- CSV file is uploaded to S3
- Frontend fires GraphQL mutation: `ImportModalProdoctCreateJob`
- A pubsub job is enqueued (`importProjectProductItemsJob.ts`)
- `ProductProjectItemImporterJob.ts` processes the job:
  - Downloads CSV from S3
  - Runs the same parsing and import logic
  - Updates job status for polling

---

### 5. Data Mapping

- `mapProductToProductImport.ts` — converts a parsed CSV row into the internal product import format before saving.

---

### 6. GraphQL Layer

- Mutations defined in `ImportModalProduct.rq.graphql`
- Generated hooks follow the pattern `use[OperationName]Mutation`

---

## Key Files (cms-frontend)

| Purpose | Path |
|---|---|
| Import modal UI | `src/components/customer-project/Products/ImportModalProduct.tsx` |
| CSV upload API (current) | `src/pages/api/rest/upload/product-project-items-new.ts` |
| CSV upload API (legacy) | `src/pages/api/rest/upload/product-project-items.ts` |
| CSV record parser | `api-src/src/services/productProjectItemImport/ProductProjectCSVRecordParser.ts` |
| Import orchestrator | `api-src/src/services/productProjectItemImport/ProductProjectItemImporter.ts` |
| Batch job processor | `api-src/src/services/productProjectItemImport/ProductProjectItemImporterJob.ts` |
| Import status logic | `api-src/src/services/productProjectItemImport/GetProjectProduct.ts` |
| CSV column headers | `shared/projects/projectProductImportHeaders.ts` |
| Low-level CSV parsing | `shared/uploader/parseCsv.ts` |
| Data mapper | `src/components/customer-project/Products/mapProductToProductImport.ts` |
| GraphQL mutations | `src/components/customer-project/Products/ImportModalProduct.rq.graphql` |
| Pubsub job config | `api-src/src/services/pubsub/configs/importProjectProductItemsJob.ts` |

---

## Things to Replicate

1. **CSV parser** — validate headers up front, report unknown columns early.
2. **Status tagging** — tag each row as new/existing/duplicate before any writes.
3. **Batch threshold** — pick a threshold (50 here) above which you offload to a job queue.
4. **Job queue + S3** — store the raw file on object storage, let the job re-parse it; avoids re-sending the file over internal APIs.
5. **GraphQL mutations per action** — separate mutations for create, update, and job creation keep the API surface clean.
