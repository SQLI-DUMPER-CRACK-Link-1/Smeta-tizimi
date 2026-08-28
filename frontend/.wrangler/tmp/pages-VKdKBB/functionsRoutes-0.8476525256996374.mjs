import { onRequestPost as __api_agent_call_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\agent\\call.ts"
import { onRequestGet as __api_agent_manifest_ts_onRequestGet } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\agent\\manifest.ts"
import { onRequestPost as __api_ai_parse_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\ai-parse.ts"
import { onRequestPost as __api_ai_savol_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\ai-savol.ts"
import { onRequestPost as __api_didox_webhook_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\didox-webhook.ts"
import { onRequestPost as __api_gas_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\gas.ts"
import { onRequestPost as __api_kirish_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\kirish.ts"
import { onRequestPost as __api_payment_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\payment.ts"
import { onRequestPost as __api_royxat_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\royxat.ts"
import { onRequestPost as __api_sb_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\sb.ts"
import { onRequestPost as __api_sb_yoz_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\sb-yoz.ts"
import { onRequestGet as __api_sessiya_ts_onRequestGet } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\sessiya.ts"
import { onRequestPost as __api_upload_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\upload.ts"
import { onRequestPost as __api_xato_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\api\\xato.ts"
import { onRequestPost as __tg_webhook_ts_onRequestPost } from "G:\\Другие компьютеры\\Компьютер\\GAS\\frontend\\functions\\tg\\webhook.ts"

export const routes = [
    {
      routePath: "/api/agent/call",
      mountPath: "/api/agent",
      method: "POST",
      middlewares: [],
      modules: [__api_agent_call_ts_onRequestPost],
    },
  {
      routePath: "/api/agent/manifest",
      mountPath: "/api/agent",
      method: "GET",
      middlewares: [],
      modules: [__api_agent_manifest_ts_onRequestGet],
    },
  {
      routePath: "/api/ai-parse",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_parse_ts_onRequestPost],
    },
  {
      routePath: "/api/ai-savol",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_ai_savol_ts_onRequestPost],
    },
  {
      routePath: "/api/didox-webhook",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_didox_webhook_ts_onRequestPost],
    },
  {
      routePath: "/api/gas",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_gas_ts_onRequestPost],
    },
  {
      routePath: "/api/kirish",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_kirish_ts_onRequestPost],
    },
  {
      routePath: "/api/payment",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_payment_ts_onRequestPost],
    },
  {
      routePath: "/api/royxat",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_royxat_ts_onRequestPost],
    },
  {
      routePath: "/api/sb",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sb_ts_onRequestPost],
    },
  {
      routePath: "/api/sb-yoz",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_sb_yoz_ts_onRequestPost],
    },
  {
      routePath: "/api/sessiya",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_sessiya_ts_onRequestGet],
    },
  {
      routePath: "/api/upload",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_upload_ts_onRequestPost],
    },
  {
      routePath: "/api/xato",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_xato_ts_onRequestPost],
    },
  {
      routePath: "/tg/webhook",
      mountPath: "/tg",
      method: "POST",
      middlewares: [],
      modules: [__tg_webhook_ts_onRequestPost],
    },
  ]