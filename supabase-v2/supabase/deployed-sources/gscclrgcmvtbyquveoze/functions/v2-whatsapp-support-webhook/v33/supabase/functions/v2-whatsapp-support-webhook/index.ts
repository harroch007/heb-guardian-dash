import { serviceClient } from "../_shared/auth.ts";
import {
  handleWhatsAppSupportWebhook,
  type WhatsAppIngestRpcArguments,
} from "../_shared/whatsapp_support.ts";

Deno.serve((request) =>
  handleWhatsAppSupportWebhook(request, {
    getEnv: (name) => Deno.env.get(name),
    ingest: async (
      arguments_: WhatsAppIngestRpcArguments,
      signal: AbortSignal,
    ) => {
      const client = serviceClient();
      const { data, error } = await client
        .rpc(
          "v2_admin_ingest_whatsapp_webhook_service",
          arguments_,
        )
        .abortSignal(signal);
      return { data, error };
    },
  })
);
