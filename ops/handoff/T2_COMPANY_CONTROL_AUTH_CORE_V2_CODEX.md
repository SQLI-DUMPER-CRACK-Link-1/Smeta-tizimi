# T2-COMPANY-CONTROL-AUTH-CORE-002 — Codex yakuniy handoff

## BASE / BRANCH / HEAD

- Base: `ccd5423e017cbea1f4aac9cf372d59c9ced2ac6a`
- Branch: `codex/t2-company-control-auth-core-v2`
- Old checkpoint: `f463b769fab85637bbde1da1bfa35b9bfcadd514`
- Ushbu handoff yozilgan paytda yangi commit hali yaratilmagan; final SHA commitdan keyin beriladi.

## Claude kontrakti bilan reconciliation

`origin/integration/next-main-release-v1`dagi
`T2_COMPANY_CONTROL_FOUNDATION_001_CONTRACT.md` authoritative qabul qilindi.

- Alohida `t2_platforma_rol` va platform-company-context jadvallari olib
  tashlandi: parallel truth qolmadi.
- Platform signal DBda actorning istalgan faol `t2_azolik` yozuvidagi
  `superadmin` yoki `admin` rolidan olinadi.
- Active company membership roli esa target `p_kompaniya_id` bo‘yicha alohida
  qayta o‘qiladi. Shu sabab A=boss, B=pto switch eski rolni olib yurmaydi.
- `superadmin` global routega kira oladi va explicit `p_kompaniya_id` context
  bilan synthetic membershipsiz company operationga ruxsat oladi. Domain
  write command actor+targetni `t2_audit_yoz` orqali audit qilishi shart.
- Oddiy `boss` yoki `pto` global System Control ruxsatini olmaydi.

## Authorization shared core

`frontend/src/lib/company-authorization/effective-authorization.ts` yangi,
pure va network-free modul bo‘lib, quyidagilarni beradi:

- `resolveAuthorizationContext()`;
- `authorize()` / `effectiveAuthorization()`;
- `hasCapability()`;
- `canAccessProject()` / `canAccessObject()`;
- `companyChoice()`.

Frontend bu natijani nav va direct-URL affordance uchun ishlatadi, lekin bu
security boundary emas. Cloudflare BFF verified cookie’dan actorni oladi,
client role/actor/companyga ishonmaydi va named
`t2_effective_authorization_v1` RPC natijasi rad bo‘lsa 403 qaytaradi.

## Migration va project/object scope

`20260915120000_t2_effective_authorization_core_v1` source-only, additive:

- `t2_loyiha_foydalanuvchi_ruxsat`;
- `t2_obyekt_foydalanuvchi_ruxsat`;
- `t2_effective_authorization_v1` BFF-only SECURITY DEFINER read model.

Scope jadvallarida `kompaniya_id` qasddan yo‘q: tenant project/objectning
kanonik owneridan hosil qilinadi, shuning uchun forged company relation yoki
ikkinchi tenant truth paydo bo‘lmaydi. `t2_loyiha_qatnashchi` company-level
participant model bo‘lib qoladi; bu yangi bridge user-level visibility uchun.
Yozish commandlari bu taskda yaratilmagan va anonymous/public/authenticated
uchun jadval/RPC ochilmagan. Claude keyingi owner commandda operation_id,
expected version va auditni qo‘llaydi.

## Migration acceptance va rollback

Disposable branch yo‘q edi. Shu sabab live productionda **bitta** xavfsiz
`BEGIN … ROLLBACK` transaction ichida forward migration va acceptance birga
sinovdan o‘tdi. `AUTH_CORE_ACCEPTANCE_PASS` qaytdi. Keyingi katalog tekshiruvi
yangi function va ikkala jadval `null` ekanini tasdiqladi: productionga schema,
test useri yoki business data saqlanmadi.

Acceptance qamrovi:

1. normal member;
2. revoked member;
3. role changed;
4. forged company;
5. platform superadmin;
6. non-platform boss;
7. project denied;
8. object denied;
9. unknown role;
10. capability disabled.

Rollback script pre-use only; u function va ikki yangi scope jadvalini olib
tashlaydi. Real scope authority yozilgach rollback ishlatilmaydi.

## Testlar

- Focused authorization test: 16/16 PASS.
- To‘liq Vitest memory-stable sequential guruhlar: 25 fayl, 128/128 PASS.
- TypeScript: PASS.
- Legacy/core static regression oracle: PASS kutiladi; final gate oldidan
  qayta ishga tushiriladi.

Windows parallel full Vitest avval worker memory crash bergan. Bu run mahsulot
testi emas: 1-worker uch guruhli run barcha fayl/testlarni yakuniy PASS bilan
berdi. `INFRA_FAILURE=old parallel worker only`, `PRODUCT_FAILURE=0`.

## Claude-owned fayllar tegilmagan

- `frontend/functions/api/company.ts`
- `frontend/functions/api/system-control.ts`
- `frontend/src/umumiy/kontekst/**`
- `frontend/src/api/t2-men.ts`, `frontend/src/api/t2-control.ts`
- Company profile va System Control migrations.

## Integration sharti

`READY_FOR_CLAUDE_INTEGRATION=YES` faqat source integration ma’nosida:
Claude mavjud company-context contractini oldin reconcile qiladi, keyin ushbu
branchdagi yangi modullar/migrationni ko‘rib merge qiladi. Production/mainga
hech narsa qo‘llanmagan yoki push qilinmagan.
