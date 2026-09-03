# T2-COMPANY-CONTROL-AUTH-CORE-001 — Codex authorization core contract

## Maqsad va chegaralar

Bu kontrakt Company Control uchun yagona effective authorization modelini
belgilaydi. U UI menyuni xavfsizlik chegarasi deb hisoblamaydi. Qaror har
security-sensitive server requestda, joriy DB holatidan olinadi.

Bu task Claude-owned gateway, Company UI, capability registry migration yoki
existing RPC fayllarini tahrirlamaydi. Codex faqat yangi shared authorization
core, test oracle va additive source-only migration yaratadi.

## AuthorizationContext input

```ts
type AuthorizationContext = {
  actorId: number;                 // imzolangan cookie'dan, clientdan emas
  companyId: number | null;        // target kompaniya, globalda null
  projectId?: number | null;
  objectId?: number | null;
  permission: PermissionCode;
  capability?: string | null;
};
```

`actorId`, `companyId`, `projectId`, `objectId` faqat serverda normalizatsiya
qilinadi. `projectId` target kompaniyaga, `objectId` esa target loyiha va
kompaniyaga tegishli bo‘lishi shart. Noto‘g‘ri yoki yetishmaydigan anchor —
fail-closed.

## EffectiveAuthorization output

```ts
type EffectiveAuthorization = {
  allowed: boolean;
  reason: 'ALLOW' | 'AUTH_REQUIRED' | 'UNKNOWN_ROLE' |
          'COMPANY_MEMBERSHIP_REQUIRED' | 'PLATFORM_ROLE_REQUIRED' |
          'CAPABILITY_DISABLED' | 'PROJECT_SCOPE_DENIED' |
          'OBJECT_SCOPE_DENIED' | 'TARGET_SCOPE_INVALID';
  platformRole: 'platform_superadmin' | 'platform_operator' | 'none';
  membershipRole: CompanyMembershipRole | null;
  effectiveCapabilities: Record<string, boolean>;
  permissions: PermissionCode[];
  companyId: number | null;
  projectId: number | null;
  objectId: number | null;
};
```

## Permission vocabulary

- `company.read`, `company.profile.update`, `company.member.manage`
- `control.company.read`, `control.company.write`, `control.global.read`,
  `control.global.write`
- `project.read`, `project.write`, `object.read`, `object.write`
- `document.read`, `document.write`, `financial.read`, `financial.write`

Permission vocabulary rolning o‘zi emas. Membership role baseline permissionni
beradi; capability entitlement uni module darajasida yoqadi/o‘chiradi;
project/object scope esa targetga kirishni toraytiradi. Unknown role hech
qachon default ruxsat olmaydi.

## Capability evaluation

Mavjud `t2_capability`, `t2_capability_override` va
`t2_capability_effective_v1` qayta ishlatiladi. Precedence o‘zgarmaydi:
project > company > global > default; global kill-switch hard stop.

Authorization core yangi capability truth yaratmaydi. Server BFF capability
kodi kerak bo‘lgan amalda mavjud resolverni target company/project bilan
chaqiradi va `off` bo‘lsa `CAPABILITY_DISABLED` qaytaradi.

## Platform, membership va scope truth

- `t2_platforma_rol` — platform vakolati. `platform_superadmin` company
  membershipdan hosil qilinmaydi.
- `t2_azolik` — faqat company membership role.
- `t2_loyiha_foydalanuvchi_ruxsat` — project scope uchun natural bridge.
- `t2_obyekt_foydalanuvchi_ruxsat` — object scope uchun natural bridge.

Platform superadmin global controlga kirishi mumkin, ammo company contextga
o‘tganda company audit targeti saqlanadi. Oddiy company membership project
yoki object uchun avtomatik ruxsat bermaydi: explicit scope bo‘lmasa rad
etiladi. Migration rollout davrida bu toraytirish faqat newly-wired
permissionlarda faollashadi; barcha legacy endpointlarni birdan bloklash
taqiqlanadi.

## Server enforcement point

Cloudflare BFF:

1. cookie -> actor IDni tekshiradi;
2. client yuborgan role/permissionga ishonmaydi;
3. named `t2_effective_authorization_v1` RPC’ini chaqiradi;
4. `allowed=false` bo‘lsa stable public code bilan 403 qaytaradi;
5. faqat `allowed=true` bo‘lsa domain RPC’iga actor + validated target bilan
   o'tadi.

DB RPC barcha source-of-truth relationlarni o‘qiydi. U `service_role` uchun
ochiq, `PUBLIC/anon/authenticated` uchun revoke qilingan. Write commandlar
yana target entity tenant/scope tekshiruvini bajaradi; authorization read
modeli yagona himoya qatlami emas.

## CONTRACT_CONFLICT

`fix/company-context-p0`dagi `20260914120000_t2_platforma_superadmin_context_v1.sql`
platform superadminni `t2_azolik.rol='superadmin'`dan hosil qiladi. Bu yuqoridagi
platform role va company membership role ajralishi bilan mos emas. Ushbu task
o‘sha Claude-owned migrationni tahrirlamaydi yoki merge qilmaydi. Claude
integratsiyada ikki kontraktdan bittasini tanlashi kerak; tavsiya — ushbu
taskdagi alohida `t2_platforma_rol` truthiga o‘tish.

## Reconciliation va finding klassifikatsiyasi

| Finding | Holat | Dalil |
| --- | --- | --- |
| `25006` System Control xatosi | `ALREADY_FIXED` | `t2_actor_kompaniya_azo_tekshir` live katalogda `FOR SHARE`siz; `20260903050000` P0 migrationi mavjud. |
| Legacy membership/company write RPC'larining public ishlatilishi | `ALREADY_FIXED` | Eski RPC grantlari faqat `postgres, service_role`; public/anon/authenticated grant yo‘q. |
| Company context UI va membership selector | `STILL_VALID` main uchun, `ALREADY_FIXED` source branch uchun | `fix/company-context-p0`da provider/selector bor, ammo `ccd5423` mainga hali integratsiya qilinmagan. |
| Global `sess.data.rol`ga tayanish | `STILL_VALID` | `fix/company-context-p0` ham platform vakolatini `t2_azolik.rol='superadmin'`dan hosil qiladi; alohida platform truth yo‘q. |
| Har requestda membership qayta tekshirish | `STILL_VALID` | Shared core DB RPC bilan fail-closed revalidationni beradi; BFF wiring Claude laneida qoladi. |
| Project/object user scope | `STILL_VALID` | Live katalogda natural project/object user access relationlari topilmadi. |
| Legacy company profile update DB-actor himoyasi | `NEEDS_PROOF` | Gateway membership tekshiruvi bor, ammo legacy `t2_kompaniya_yangila` canonical actor-aware command emas; uni public deb tasniflash noto‘g‘ri. |
| Raw PGRST xatosining UIga chiqishi | `ALREADY_FIXED` source branch uchun, `STALE_BASELINE` main uchun | `fix/company-context-p0` safe UI mappingni olib keladi; main hali eski. |

## Tekshiruv natijalari

- Focused authorization oracle: 15/15 PASS.
- TypeScript build: PASS.
- Lint: PASS; faqat avvaldan mavjud warninglar qoldi.
- `npm run tekshir`: PASS.
- Mustaqil legacy/core regression oracle: PASS.
- Vite production build: PASS.
- `git diff --check`: PASS.
- Governance check: PASS.
- To‘liq Vitest parallel rejimi Windows worker xotira chekloviga urildi: 24
  fayl/125 test o‘tdi, biroq bitta worker yiqilgani uchun bu run final PASS
  hisoblanmaydi. Focused yangi test va barcha boshqa gate natijalari yuqorida.

## Qo‘llanmagan ishlar

Bu branch mainga merge qilinmadi, production migration apply qilinmadi va
Cloudflare production deploy qilinmadi. SQL package source-only: disposable DB
qabul sinovi va Claude contract qaroridan keyingina keyingi bosqichga o‘tadi.

## Claude-owned fayllar tegilmagan

- `frontend/functions/api/company.ts`
- `frontend/src/umumiy/kontekst/**`
- `frontend/src/test02/KompaniyaTanlov.tsx`
- `frontend/src/test02/AdminShell.tsx`
- `frontend/src/api/t2-men.ts`
- `20260914120000_t2_platforma_superadmin_context_v1.sql`
