# Control Signal Engine V1 Architecture

## Overview
Control Signal Engine (T2_CSE) is a generic derivation engine for calculating and routing "attention requests" (signals) across TIZIM_02. A signal represents a derived control state requiring action or attention.

**Crucial constraint:** Financial truth DOES NOT move to the signal table. The signal table is strictly for tracking the lifecycle of an attention request.

## Signal Model (	2_signal)
The core signal entity contains:
- id: Primary UUID.
- kompaniya_id: Tenant boundary.
- entity_type / entity_id: The domain entity this signal belongs to (e.g. 'obyekt', 'qator', 'shartnoma').
- signal_type: The category of the signal (e.g. missing_price, mirror_conflict, open_request, schedule_delay, payment_overdue, document_missing, data_quality).
- severity: Indicates priority (info, warning, error, critical).
- 	itle / details: Human-readable summary of the issue.
- source / source_id: Origin of the signal (e.g. 'erp_taminot', '123').
- operation_id (idempotency key): A unique hash or identifier ensuring duplicate signals aren't created for the exact same source state.
- state: Lifecycle state of the signal (open, esolved, dismissed).
- detected_at: Timestamp of signal generation.
- due_at: Deadline for resolving the signal (if applicable).
- esolved_at: Timestamp of resolution.

## Core Behaviors

1. **Idempotency & Deduplication**
   Using operation_id or (entity_type, entity_id, signal_type, source_id) uniquely identifies a signal instance. If the signal already exists and is open, it is not duplicated. If the signal is esolved and the source state re-triggers it, it is **reopened**.

2. **Resolve/Reopen Lifecycle**
   - **Open**: Action required.
   - **Resolved**: Source system confirms the underlying issue is fixed.
   - **Dismissed**: Suppressed by user (optional extension).
   - If a signal triggers again while esolved, it moves back to open and updates detected_at / details.

3. **Read-Model & Mindmap Integration**
   - The signal engine does not store financial values directly.
   - 	2_mindmap_grafi function incorporates signals by aggregating them per entity_type and entity_id. It exposes counts of open signals (e.g., open_requests, warnings) to populate visual indicators (badges/ticks) on the mindmap.

## Initial Producers (Signal Types)
1. missing_price: Smeta row lacks an approved price.
2. mirror_conflict: Supabase local state differs significantly from external mirror (Google Sheets/ERP).
3. open_request: Zayavka (procurement request) opened via PTO and requires fulfillment.
4. schedule_delay: Work falling behind the projected timeline (Gantt/AOSR).
5. payment_overdue: Approved payment not processed within the expected SLA.
6. document_missing: Required act or invoice missing.
7. data_quality: Anomalies, missing metadata, or validation errors.

## Implementation Plan
1. Create `t2_signal` table and related indexes.
2. Implement signal UPSERT function (`t2_signal_emit`) to handle duplicate/reopen logic.
3. Update `t2_mindmap_grafi` read-model to fetch and bundle active signal stats (meta.signals = { errors: 1, warnings: 2, open_requests: 1 }).
4. Apply row-level security (RLS).
5. Add tests.
