# Design: Automated Pricing & Notification System
Date: 2026-04-27
Status: Proposed

## Context
The system currently relies on static seed data for LLM pricing and benchmarks. To maintain accuracy and avoid manual updates, the system needs to transition to a dynamic model where data is fetched from external APIs. This must include a way for administrators to trigger updates and be notified of significant changes.

## Architecture

### 1. Data Ingestion Layer
- **`PricingProvider` (Interface)**: Defines methods for `fetch_models()` and `fetch_benchmarks()`.
- **`ExternalApiProvider` (Implementation)**: Implements the interface to communicate with the chosen External API.
- **Mapper**: Logic to transform external API JSON structures into internal `LLMModel` and `ModelBenchmark` schemas.

### 2. Sync & Notification Logic
- **Change Detection**: A service that compares the fetched data with existing database records.
- **Logging**: When a discrepancy is found (Price change, New Model, Deprecated Model), a log entry is created with the `NOTIFY` level.
- **Database Update**: Performs an "upsert" (update or insert) to ensure the database reflects the latest API state.

### 3. API & UI Integration
- **Endpoint**: `POST /api/models/refresh`
    - Triggers the `PricingProvider` $\rightarrow$ `Change Detection` $\rightarrow$ `DB Update` flow.
    - Returns a `SyncReport` containing:
        - Number of models updated.
        - Number of price changes detected.
        - Number of new models added.
- **Frontend**: `Settings.tsx`
    - Triggers the refresh via the API.
    - Displays the `SyncReport` as a toast or a status message below the refresh button.
    - Updates the "Last Updated" timestamp.

## Data Flow
`Settings UI` $\rightarrow$ `API /refresh` $\rightarrow$ `External API` $\rightarrow$ `Comparison Logic` $\rightarrow$ `NOTIFY Log` $\rightarrow$ `DB Update` $\rightarrow$ `Sync Report` $\rightarrow$ `Settings UI`

## Verification Plan
1. **Mock API Test**: Use a mock provider that returns a modified price to verify that the `NOTIFY` log is generated and the DB is updated.
2. **UI Flow Test**: Trigger refresh from Settings and verify that the `SyncReport` (e.g., "3 changes detected") is displayed correctly.
3. **Persistence Test**: Refresh the page and verify that the "Last Updated" timestamp has changed.
