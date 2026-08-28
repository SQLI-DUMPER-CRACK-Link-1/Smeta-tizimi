# TIZIM_02 — GLOBAL CONSTRUCTION OS
## Yakuniy arxitektura va rivojlantirish rejasi

**Canonical maqsad:** Supabase/PostgreSQL — yagona miya va Source of Truth; Cloudflare — web/API/agent platforma; Google Sheets — Frontend bilan teng huquqli full client; Google Drive — original hujjatlar ombori; AI/Agents — intelligence + automation qatlamidir.

**Migration prinsipi:** Tizim_01 ishlaydigan reference/rollback sifatida saqlanadi. Tizim_02 bosqichma-bosqich yangi core bo‘ladi. Big-bang migration yo‘q.

**Security prinsipi:** to‘liq security hardening oxirgi katta bosqichda bajariladi. Biroq hozirdanoq ID/version/audit/operation/source va secret separation kabi security-ready arxitektura buzilmaydi.

---

# 1. YAKUNIY MAHSULOT

Bu loyiha “smeta dasturi” emas. Yakuniy mahsulot — qurilish kompaniyasi va qurilish loyihasining yagona raqamli operatsion tizimi:

- Smeta va narxlash
- LRV/nakopitelniy
- Fakt
- F2 / progress certification
- Akt/AOSR/APPOK
- Shartnomalar
- Procurement
- Sklad
- Yetkazib beruvchilar
- Invoice/EDO
- To‘lovlar
- Debitor/kreditor
- Bank
- Didox
- Loyiha hujjatlari
- BIM/CAD/takeoff
- Turar-joy/unit sotuvlari
- CRM
- Dashboard
- AI data assistant
- RAG/knowledge
- AI agents
- Monitoring/anomaly detection
- Performance/self-improvement
- Global localization

---

# 2. ASOSIY ARXITEKTURA

```text
                         USERS
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   CLOUDFLARE WEB      GOOGLE SHEETS     MOBILE/OTHER
    FULL CLIENT         FULL CLIENT         CLIENTS
          │                │
          └────────┬───────┘
                   ▼
             API / DOMAIN
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
 CLOUDFLARE WORKERS      SUPABASE RPC
        │                     │
        └──────────┬──────────┘
                   ▼
            POSTGRESQL CORE
             SINGLE TRUTH
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
 CONSTRUCTION    FINANCE       DOCUMENTS
    │              │              │
 Estimate/F2     Bank/Didox      Drive
 Fact/Sklad      Payments        originals
                   │
                   ▼
            AI / AGENTS / RAG
```

# 3. ROLLAR: KOMPANIYA QAYERDA QANDAY ROLDA?

Kompaniyaning bitta global roli bo‘lmaydi.

```text
Company A
├─ Project A → CONTRACTOR
├─ Project B → OWNER
├─ Project C → DESIGNER
└─ Project D → SUPPLIER
```

Demak rol:

`Company → Project Participation → Contractual Role`

darajasida belgilanadi.

Bitta kompaniya bir vaqtning o‘zida turli loyihalarda turli rolga ega bo‘lishi mumkin.

# 4. KLIENT MODELI
## 4.1 Google Sheets

Sheets oddiy “export” emas.

U:
- o‘qiydi;
- ruxsatli maydonlarni tahrirlaydi;
- F2/Fakt bilan ishlaydi;
- Supabase orqali saqlaydi;
- sync oladi;
- Excel/print workflow beradi.

## 4.2 Cloudflare Frontend

Web:
- o‘qiydi;
- yozadi;
- dashboard;
- workflow;
- AI;
- hujjat;
- project control.

Sheets va frontend bir xil core operationlardan foydalanadi.

```text
Frontend → Worker → RPC → Postgres
Sheets → GAS adapter → RPC → Postgres
```

Business logic ikki joyda takrorlanmaydi.

# 5. GOOGLE DRIVE

Drive — original binary/document store:
- PDF
- Excel
- DWG
- RVT
- IFC
- F2
- Akt
- AOSR
- APPOK
- Invoice
- Shartnoma
- Scan

Supabase hujjat metadata'sini saqlaydi:

```text
document_id
entity_type
entity_id
drive_file_id
file_name
mime_type
hash
version
created_by
created_at
```

Drive faylining o‘zi ERP truth emas.

# 6. SUPABASE CORE

Canonical domain jadvallari:

```text
companies
users
memberships
projects
project_participants
objects

estimates
estimate_sections
estimate_rows
resources
materials
material_aliases
price_catalog
price_history

facts
fact_rows
f2_documents
f2_rows
acts

contracts
contract_items
purchase_orders
purchase_items

warehouse_documents
warehouse_rows
stock_balances

invoices
payments
bank_accounts
bank_transactions

sales_projects
buildings
units
reservations
sales_contracts
sales_payments

documents
document_links

audit_log
field_changes
sync_state
sync_conflicts
ai_query_log
ai_source_log
```

T2 jadvallari migration/canonical estimate layer sifatida ishlashi mumkin; keyinchalik domain-specific modelga evolyutsiya qilinadi.

# 7. IMMUTABLE ID

Sheets row number authoritative ID bo‘lmaydi.
Har entity `id` bilan aniqlanadi.

Sheets'da yashirin:
`SUPABASE_ID` va `VERSION` bo‘ladi.
Sort, filter, insert/delete identityni buzmasligi kerak.

# 8. VERSIONING VA CONCURRENCY

Canonical metadata:
- id
- version
- updated_at
- updated_by
- updated_source

Update:
```sql
UPDATE ...
SET version = version + 1
WHERE id = :id
  AND version = :expected_version;
```
Agar 0 row update bo‘lsa: `CONFLICT`

Moliyaviy ma'lumotlarda silent Last-Write-Wins ishlatilmaydi.

Conflict response:
- entity_id
- expected_version
- actual_version
- server_state
- client_attempt

# 9. AUDIT + IDEMPOTENCY

Har muhim mutation saqlaydi:
- who, when, source, operation, entity, entity_id, old_value, new_value, request_id, operation_id

Source bo‘lishi mumkin:
- frontend, sheets, gas, import, system, ai

Muhim mutationlarda `operation_id` duplicate requestni qayta transaction qilmaslik (idempotency) uchun ishlatiladi.

# 10. SMETA ENGINE

Target pipeline:
```text
ORIGINAL FILE
→ RAW IMPORT
→ NORMALIZATION
→ CLASSIFICATION
→ PRICING
→ ROLLUP
→ CANONICAL ESTIMATE
```
T2_Import.js poydevori saqlanadi.
Raw layer o‘zgarmas bo‘ladi.

# 11. PRICING ENGINE

Prioritet:
1. fayldagi tayyor narx;
2. exact code + unit;
3. normalized name + unit;
4. alias;
5. fuzzy/trigram;
6. manual review;
7. AI candidate.

AI production narxni ixtiro qilmaydi. AI faqat candidate beradi; final write deterministic rule/RPC orqali amalga oshadi.

# 12. 20 000+ QATOR PERFORMANCE

Quyidagidan qochiladi:
`20 000 rows × Sheets API × per-row formula/merge`

Target:
```text
20 000 rows
→ PostgreSQL
→ indexed JOIN
→ aggregation
→ RPC
→ result
```

Benchmarklar 1k, 5k, 20k, 50k uchun qilinadi. P50/P95 latency va concurrency yoziladi.

# 13. FAKT + F2 + NAKOPITELNIY

Canonical relation ID orqali bog'lanadi:
```text
Estimate Row
├─ Fact Row
└─ F2 Row
```
Server-side: `Smeta → Fakt → F2 → Qoldiq` hisoblanadi.
F2/Fakt mutationlari alohida domain transactionlar (f2_yarat, f2_yopish, fakt_yarat, fakt_tasdiqlash) bo‘ladi.
Sheets ichida katta smetani qayta-qayta scan qilish tugatiladi.

# 14. FINANCE

Bitta price hamma narsani anglatmasin. Alohida tushunchalar:
- estimate_price, contract_price, supplier_price, purchase_price, invoice_amount, actual_cost, market_price, sales_price, payment_amount

Zanjir: `Contract → Invoice → Payment` alohida kuzatiladi.

# 15. PROCUREMENT + WAREHOUSE

```text
Estimate
→ Material Requirement
→ Purchase
→ Supplier
→ Invoice
→ Warehouse Receipt
→ Stock
→ Issue/Consumption
→ Fact
```
Tizim quyidagi savolga bitta graphdan javob berishi kerak:
*Qancha kerak edi → qancha olindi → qancha keldi → qancha ishlatildi → qancha qoldi?*

# 16. PROJECT/BIM/TAKEOFF
Kelajakdagi integration:
DWG/PDF/IFC/Excel → Extraction → Normalization → Quantity Takeoff → Resource Mapping → Estimate Comparison.
Source/provenance saqlanadi.

# 17. DIDОX / EDO
Core integration interface: EDO Adapter. Uzbekistan implementation: Didox.
Import idempotent bo‘ladi.

# 18. BANK
Core: Bank Adapter Interface.
Bank transaction: account, transaction_id, date, amount, currency, counterparty, description, reference.
AI candidate match beradi, final accounting state deterministic rule/approval bilan yoziladi.

# 19. SALES / REAL ESTATE
Project → Building → Section → Floor → Unit → Reservation → Sales Contract → Payment Schedule → Payment.
Sales project profitability bilan bog‘lanadi.

# 20. AI DATA LAYER
`USER QUESTION → AI ORCHESTRATOR → INTENT → DATA TOOL / SQL TOOL / DOCUMENT TOOL → SUPABASE → VERIFIED EVIDENCE → AI ANSWER`
Butun database'ni promptga yuborish taqiqlanadi.

# 21. AI SEMANTIC LAYER
M200, M-200, М200, Бетон М200, Бетон марки 200 → bitta material entity.

# 22. AI SAVOLGA JAVOB
Javob faqat database daliliga asoslanadi. Agar exact topilmasa semantic/alias/documents orqali qidiriladi, keyin "topilmadi" deyiladi.

# 23. AI AGENTLAR
Orchestrator, Estimate Agent, F2/Fact Agent, Procurement Agent, Warehouse Agent, Finance Agent, Document Agent, Project/BIM Agent, Sales Agent, Audit Agent, Monitoring Agent, Performance Agent, Code/Architecture Agent.

# 24. AGENT TOOL MODEL
Read tools va Controlled write tools ajratilgan. Agentga generic SQL, generic DELETE, unrestricted filesystem berilmaydi.

# 25. AGENT AVTONOMIYASI
L1 (READ), L2 (CONTROLLED ACTION), L3 (AUTONOMOUS - Schedule).

# 26. SELF-IMPROVEMENT
OBSERVE → DETECT → ANALYZE → PROPOSE → SANDBOX → TEST → COMPARE → APPROVAL → DEPLOY → MONITOR.
Agent production kodini o‘zicha almashtirmaydi.

# 27. CONTROL CENTER
Mavjud frontend ichida `/admin`.

# 28. GLOBAL ARXITEKTURA
Core global. Uzbekistan Pack, UAE Pack, Saudi Pack va hokazo.
Uzbekistan-specific qoidalar core'ga hard-code qilinmaydi.

# 29. LOCALIZATION
Multi-language va terminology dictionary kerak (F2 = Payment Application/Progress Claim).

# 30. MULTI-CURRENCY
Exchange-rate tarixiy snapshot saqlanadi. Eski invoice keyingi kurs o‘zgargani uchun o‘zgarmaydi.

# 31. SECURITY — OXIRGI KATTA BOSQICH
Hozirdanoq faqat architecture-ready talablar (immutable ID, version, audit, operation_id) saqlanadi. Final security stage (RLS, RBAC, SSO, rate limit) oxirgi bosqichda bajariladi.

# 32. MIGRATION ROADMAP
- Phase 0 — Baseline
- Phase 1 — T2 Core
- Phase 2 — Real Data (Amfiteatr 4,937 qator)
- Phase 3 — Version/Conflict
- Phase 4 — Frontend Full Client
- Phase 5 — Sheets Full Client
- Phase 6 — F2/Fact/Nakopitelniy
- Phase 7 — Procurement/Warehouse
- Phase 8 — Documents/Drive
- Phase 9 — Didox/Bank
- Phase 10 — Sales
- Phase 11 — BIM/Takeoff
- Phase 12 — AI Data Layer
- Phase 13 — Agents
- Phase 14 — Self Improvement
- Phase 15 — Security Hardening
- Phase 16 — Global Country Packs
- Phase 17 — Production Cutover

# 33. GOLDEN TEST
Tizim_01 ↔ Tizim_02 reconciliation: row count, quantity, price, category, total, F2, Fact, remaining. Farq yopilmasdan keyingi critical stage yo‘q.

# 34. CLAUDE CODE PROTOCOL
Har task: BOSH_QONUN o'qish, dependency aniqlash, kod yozish, test, regression, reconciliation. Katta taskdan keyin report berish.

# 35. CLAUDE QILMASLIGI KERAK
- Tizim_01ni buzmaslik.
- Versionni chetlab o‘tmaslik.
- Financial LWW ishlatmaslik.
- Generic SQL endpoint yaratmaslik.
- AIga financial truth ixtiro qildirmaslik.
- Benchmark qilmasdan performance va’dasi bermaslik.

# 36. BIRINCHI ISHCHI TASKLAR
- **TASK 1:** Hozirgi T2/Supabase/Sheets bridge/F2/Fact/AI qatlamining dependency graphini chiqarish. Kod o‘zgartirilmasin.
- **TASK 2:** Amfiteatr 4,937 qator uchun golden import/reconciliation harness.
- **TASK 3:** Tizim_01 vs Tizim_02 differential report.

# 37. DEFINITION OF DONE
Tizim_02 barcha sub-tizimlar va benchmarklardan o'tmaguncha "final production platform" deyilmaydi.

# 38. NORTH STAR
Foydalanuvchi istalgan klientdan ishlaydi. Supabase bitta markaziy haqiqat.
Tizim foydalanuvchining "M200 qancha olingan?", "Qancha qoldi?" savollariga graph orqali aniq va yagona truth javob qaytaradi.
