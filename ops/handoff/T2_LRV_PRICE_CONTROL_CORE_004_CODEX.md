# T2-LRV-PRICE-CONTROL-CORE-004
BASE: `63f759f1ae61dd532881bc6c78f17caf3c1c70a1`.

PRICE_CORE: `effectiveReferencePrice` ustuvorligi tasdiqlangan price basis, so'ng frozen baseline, aks holda unknown. Procurement/market narxi hech qachon reference emas.

FROZEN: faqat approved F2 uchun `max(reference-certified,0)*quantity`.

AT_RISK: faqat draft/not-certified potensial farq; tarixiy frozen jamiga kirmaydi.

PRICE_BASIS: `t2_price_basis` + natural `t2_price_basis_line`, document ID, holat, versiya, audit actor va operation ID bilan.

CHANGE_COMMANDS: mavjud `t2_qator_qosh`/`t2_smeta_ozgarish_*` canonical yo'li qayta ishlatiladi; duplicate qator entity yo'q. API/UI wiring Claude lane.

TESTS: matrix pure test: below 100/80×500=10000, normal, approved protocol, missing basis, exceeded basis, additional no-basis.

READY_FOR_CLAUDE_INTEGRATION: YES, source-only. Production/main: NONE.
