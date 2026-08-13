import {
  assertIncidentContextBinding,
  buildOpenAIRequest,
  deriveExpertPolicy,
  ExpertAnalysisError,
  openAIRequestRejectionCode,
  parseOpenAIResponse,
  parseSanitizedIncidentContext,
} from "./incident_expert.ts";
import type {
  ExpertAnalysis,
  SanitizedIncidentContext,
} from "./incident_expert.ts";
import {
  canonicalIncidentAadBytes,
  decryptIncidentContext,
  IncidentCryptoError,
} from "./incident_crypto.ts";
import type { ClaimedIncidentEnvelope } from "./incident_crypto.ts";

Deno.test("AAD v3 has byte-stable Android field order", () => {
  const claim = encryptedClaim();
  const actual = new TextDecoder().decode(
    canonicalIncidentAadBytes(claim),
  );
  const expected = '{"aad_version":3,"schema_version":2,' +
    '"privacy_contract_version":1,"privacy_identity_version":7,' +
    '"client_incident_id":"11111111-1111-8111-8111-111111111111",' +
    '"device_id":"22222222-2222-4222-8222-222222222222",' +
    '"key_version":1,' +
    '"algorithm":"RSA-OAEP-3072-SHA256+AES-256-GCM",' +
    '"context_expires_at":"2026-07-30T00:00:00.000Z",' +
    '"category":"bullying","severity":"high","child_role":"target",' +
    '"confidence":"0.900000","capture_quality":"0.800000",' +
    '"occurred_at":"2026-07-29T00:00:00.000Z","message_count":2}';
  assertEquals(actual, expected);
});

Deno.test("claim header requires model contract 2 and canonical UUID", async () => {
  const wrongContract = encryptedClaim();
  wrongContract.model_contract_version = 3;
  await assertRejectsCryptoCode(
    () => decryptIncidentContext(wrongContract, "unused"),
    "invalid_claim_header",
  );

  const uppercaseUuid = encryptedClaim();
  uppercaseUuid.client_incident_id = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
  await assertRejectsCryptoCode(
    () => decryptIncidentContext(uppercaseUuid, "unused"),
    "invalid_claim_header",
  );
});

Deno.test("hybrid envelope decrypts with canonical AAD v3", async () => {
  const claim = encryptedClaim();
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 3_072,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );
  const contentKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(
    '{"schema_version":2}',
  );
  const aad = canonicalIncidentAadBytes(claim);
  try {
    const contentKey = await crypto.subtle.importKey(
      "raw",
      contentKeyBytes,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          additionalData: aad as Uint8Array<ArrayBuffer>,
          tagLength: 128,
        },
        contentKey,
        plaintext,
      ),
    );
    const wrappedKey = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        keyPair.publicKey,
        contentKeyBytes,
      ),
    );
    const envelopeBytes = new TextEncoder().encode(JSON.stringify({
      envelope_version: 2,
      aad_version: 3,
      privacy_contract_version: 1,
      privacy_identity_version: 7,
      key_version: 1,
      algorithm: "RSA-OAEP-3072-SHA256+AES-256-GCM",
      nonce_base64: base64(nonce),
      wrapped_key_base64: base64(wrappedKey),
      ciphertext_base64: base64(ciphertext),
    }));
    const privateKeyDer = new Uint8Array(
      await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
    );
    try {
      claim.encrypted_payload_base64 = base64(envelopeBytes);
      const decrypted = await decryptIncidentContext(
        claim,
        privateKeyPem(privateKeyDer),
      );
      try {
        assertEquals(
          new TextDecoder().decode(decrypted),
          new TextDecoder().decode(plaintext),
        );
      } finally {
        decrypted.fill(0);
      }
      const mismatchedAad = {
        ...claim,
        severity: "critical",
      };
      await assertRejectsCryptoCode(
        () =>
          decryptIncidentContext(
            mismatchedAad,
            privateKeyPem(privateKeyDer),
          ),
        "incident_payload_auth_failed",
      );

      const wrongKeyPair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 3_072,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );
      const wrongPrivateKeyDer = new Uint8Array(
        await crypto.subtle.exportKey("pkcs8", wrongKeyPair.privateKey),
      );
      try {
        await assertRejectsCryptoCode(
          () =>
            decryptIncidentContext(
              claim,
              privateKeyPem(wrongPrivateKeyDer),
            ),
          "incident_key_unwrap_failed",
        );
      } finally {
        wrongPrivateKeyDer.fill(0);
      }
    } finally {
      privateKeyDer.fill(0);
      envelopeBytes.fill(0);
      wrappedKey.fill(0);
      ciphertext.fill(0);
    }
  } finally {
    contentKeyBytes.fill(0);
    nonce.fill(0);
    plaintext.fill(0);
    aad.fill(0);
  }
});

Deno.test("OpenAI request is stateless, tool-free and strict", () => {
  const context = sanitizedContext();
  const safetyIdentifier =
    "kippy_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const request = buildOpenAIRequest(context, safetyIdentifier);
  assertEquals(request.model, "gpt-5.6-luna");
  assertEquals(request.safety_identifier, safetyIdentifier);
  assertEquals(request.store, false);
  assertEquals(request.background, false);
  assertEquals((request.tools as unknown[]).length, 0);
  const text = request.text as Record<string, unknown>;
  const format = text.format as Record<string, unknown>;
  assertEquals(format.type, "json_schema");
  assertEquals(format.strict, true);
  const serializedFormat = JSON.stringify(format);
  assertEquals(serializedFormat.includes("outcome"), true);
  assertEquals(serializedFormat.includes("primary_category"), true);
  assertEquals(serializedFormat.includes("secondary_categories"), true);
  assertEquals(serializedFormat.includes("urgency"), true);
  assertEquals(serializedFormat.includes("pattern"), true);
  assertEquals(serializedFormat.includes("reason_code"), false);
  assertEquals(serializedFormat.includes("action_code"), false);
  assertEquals(serializedFormat.includes("safe_summary"), false);
});

Deno.test("OpenAI request rejection keeps only safe diagnostics", () => {
  const code = openAIRequestRejectionCode(400, {
    error: {
      message: "must never be persisted",
      type: "invalid_request_error",
      param: "text.format.schema",
      code: "invalid_json_schema",
    },
  });
  assertEquals(
    code,
    "openai_rejected_400_invalid_json_schema_text_format_schema",
  );
  assertEquals(code.includes("persisted"), false);
  assertEquals(code.length <= 80, true);
});

Deno.test("OpenAI request projects only analysis-needed context", () => {
  const request = buildOpenAIRequest(
    sanitizedContext(),
    "kippy_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  const input = request.input as Array<Record<string, unknown>>;
  const user = input.find((item) => item.role === "user");
  const content = user?.content as Array<Record<string, unknown>>;
  const projected = JSON.parse(String(content[0].text)) as Record<
    string,
    unknown
  >;

  assertEquals(Object.keys(projected).sort(), [
    "conversation_type",
    "evidence_segment_refs",
    "messages",
    "trigger_segment_ref",
  ]);
  assertEquals("schema_version" in projected, false);
  assertEquals("privacy_contract_version" in projected, false);
  assertEquals("privacy_identity_version" in projected, false);
  assertEquals("conversation_ref" in projected, false);
  assertEquals("redaction_manifest" in projected, false);
  assertEquals(projected.conversation_type, "private");
  assertEquals(projected.trigger_segment_ref, "AAAAAAAAAAAAAAAAAAAAAA");
  assertEquals(
    projected.evidence_segment_refs,
    ["AAAAAAAAAAAAAAAAAAAAAA"],
  );
  assertEquals((projected.messages as unknown[]).length, 2);
});

Deno.test("maximum group cartridge reaches OpenAI projection without truncation", () => {
  const context = maximumGroupContext();
  const plaintext = new TextEncoder().encode(JSON.stringify(context));
  try {
    const parsed = parseSanitizedIncidentContext(plaintext, 60);
    const request = buildOpenAIRequest(
      parsed,
      "kippy_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    const input = request.input as Array<Record<string, unknown>>;
    const user = input.find((item) => item.role === "user");
    const content = user?.content as Array<Record<string, unknown>>;
    const projected = JSON.parse(String(content[0].text)) as {
      messages: SanitizedIncidentContext["messages"];
    };

    assertEquals(parsed.messages.length, 60);
    assertEquals(projected.messages.length, 60);
    assertEquals(
      projected.messages.reduce(
        (total, message) =>
          total + message.text.length +
          (message.reply_context?.quoted_text.length ?? 0),
        0,
      ),
      540_000,
    );
    projected.messages.forEach((message, sequence) => {
      assertEquals(message.sequence, sequence);
      assertEquals(message.text.length, 8_000);
      assertEquals(message.reply_context?.quoted_text.length, 1_000);
    });
  } finally {
    plaintext.fill(0);
  }
});

Deno.test("context parser enforces Android per-message limits", () => {
  const overlongText = maximumGroupContext();
  overlongText.messages[0].text += "x";
  assertThrowsCode(
    () =>
      parseSanitizedIncidentContext(
        new TextEncoder().encode(JSON.stringify(overlongText)),
        60,
      ),
    "invalid_context_message",
  );

  const overlongReply = maximumGroupContext();
  overlongReply.messages[0].reply_context!.quoted_text += "x";
  assertThrowsCode(
    () =>
      parseSanitizedIncidentContext(
        new TextEncoder().encode(JSON.stringify(overlongReply)),
        60,
      ),
    "invalid_context_message",
  );
});

Deno.test("OpenAI request rejects malformed safety identifier", () => {
  assertThrowsCode(
    () =>
      buildOpenAIRequest(
        sanitizedContext(),
        "33000000-0000-4000-8000-000000000001",
      ),
    "invalid_openai_safety_identifier",
  );
  assertThrowsDisposition(
    () =>
      buildOpenAIRequest(
        sanitizedContext(),
        "33000000-0000-4000-8000-000000000001",
      ),
    "invalid_openai_safety_identifier",
    true,
    "configuration",
  );
});

Deno.test("expert result requires existing evidence references", () => {
  const context = sanitizedContext();
  const body = {
    status: "completed",
    model: "gpt-5.6-luna",
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify({
          outcome: "confirmed",
          primary_category: "bullying",
          secondary_categories: ["exclusion"],
          severity: "high",
          urgency: "elevated",
          child_role: "target",
          pattern: "repeated",
          confidence: 0.94,
          evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
        }),
      }],
    }],
  };
  const result = parseOpenAIResponse(body, context);
  assertEquals(result.analysis.outcome, "confirmed");

  for (
    const transitionalModel of [
      "gpt-5.4-nano",
      "gpt-5.4-nano-2026-03-17",
    ]
  ) {
    body.model = transitionalModel;
    assertEquals(
      parseOpenAIResponse(body, context).analysis.outcome,
      "confirmed",
    );
  }
  body.model = "gpt-5.6-luna";

  const invalid = structuredClone(body);
  const content = invalid.output[0].content[0];
  const parsed = JSON.parse(content.text);
  parsed.evidence_segment_refs = ["CCCCCCCCCCCCCCCCCCCCCC"];
  content.text = JSON.stringify(parsed);
  assertThrowsCode(
    () => parseOpenAIResponse(invalid, context),
    "invalid_expert_output",
  );
  assertThrowsDisposition(
    () => parseOpenAIResponse(invalid, context),
    "invalid_expert_output",
    true,
    "analysis",
  );
});

Deno.test("expert result rejects model prefix and free prose", () => {
  const context = sanitizedContext();
  const output = {
    outcome: "dismissed",
    primary_category: null,
    secondary_categories: [],
    severity: null,
    urgency: "routine",
    child_role: "unknown",
    pattern: "isolated",
    confidence: 0.6,
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };
  const body = {
    status: "completed",
    model: "gpt-5.6-luna-unapproved",
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify(output),
      }],
    }],
  };
  assertThrowsCode(
    () => parseOpenAIResponse(body, context),
    "openai_contract_mismatch",
  );
  assertThrowsDisposition(
    () => parseOpenAIResponse(body, context),
    "openai_contract_mismatch",
    true,
    "analysis",
  );

  body.model = "gpt-5.6-luna";
  body.output[0].content[0].text = JSON.stringify({
    ...output,
    safe_summary: "model-generated prose must never cross",
  });
  assertThrowsCode(
    () => parseOpenAIResponse(body, context),
    "invalid_expert_output",
  );
});

Deno.test("expert result rejects model-owned policy projection fields", () => {
  const context = sanitizedContext();
  const output = {
    outcome: "confirmed",
    primary_category: "bullying",
    secondary_categories: [],
    severity: "high",
    urgency: "elevated",
    child_role: "target",
    pattern: "repeated",
    confidence: 0.94,
    reason_code: "violence_risk",
    action_code: "professional_support",
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };
  const body = {
    status: "completed",
    model: "gpt-5.6-luna",
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify(output),
      }],
    }],
  };
  assertThrowsCode(
    () => parseOpenAIResponse(body, context),
    "invalid_expert_output",
  );
});

Deno.test("server policy derives confirmed action and channels", () => {
  const analysis: ExpertAnalysis = {
    outcome: "confirmed",
    primary_category: "grooming",
    secondary_categories: ["manipulation"],
    severity: "high",
    urgency: "immediate",
    child_role: "target",
    pattern: "escalating",
    confidence: 0.97,
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };

  assertEquals(deriveExpertPolicy(analysis), {
    finalizable: true,
    outcome: "confirmed",
    reason_code: "grooming_risk",
    action_code: "urgent_intervention",
    channels: ["in_app", "push"],
    needs_fallback: false,
  });
});

Deno.test("server policy dismisses without parent delivery", () => {
  const analysis: ExpertAnalysis = {
    outcome: "dismissed",
    primary_category: null,
    secondary_categories: [],
    severity: null,
    urgency: "routine",
    child_role: "unknown",
    pattern: "isolated",
    confidence: 0.82,
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };

  assertEquals(deriveExpertPolicy(analysis), {
    finalizable: true,
    outcome: "dismissed",
    reason_code: "no_actionable_risk",
    action_code: "no_action",
    channels: [],
    needs_fallback: false,
  });
});

Deno.test("low-confidence dismissal is rejected and never finalizable", () => {
  const analysis: ExpertAnalysis = {
    outcome: "dismissed",
    primary_category: null,
    secondary_categories: [],
    severity: null,
    urgency: "routine",
    child_role: "unknown",
    pattern: "isolated",
    confidence: 0.79,
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };
  const body = {
    status: "completed",
    model: "gpt-5.6-luna",
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: JSON.stringify(analysis),
      }],
    }],
  };

  assertThrowsCode(
    () => parseOpenAIResponse(body, sanitizedContext()),
    "invalid_dismissed_inference",
  );
  assertThrowsDisposition(
    () => deriveExpertPolicy(analysis),
    "invalid_dismissed_inference",
    true,
    "analysis",
  );
});

Deno.test("server policy keeps inconclusive non-finalizable", () => {
  const analysis: ExpertAnalysis = {
    outcome: "inconclusive",
    primary_category: "violence",
    secondary_categories: [],
    severity: "high",
    urgency: "elevated",
    child_role: "unknown",
    pattern: "unknown",
    confidence: 0.51,
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
  };

  assertEquals(deriveExpertPolicy(analysis), {
    finalizable: false,
    outcome: null,
    reason_code: null,
    action_code: null,
    channels: [],
    needs_fallback: true,
  });
});

Deno.test("cloud boundary rejects residual direct identifiers", () => {
  const context = sanitizedContext();
  context.messages[0].text = "send to child@example.com";
  const bytes = new TextEncoder().encode(JSON.stringify(context));
  try {
    assertThrowsCode(
      () => parseSanitizedIncidentContext(bytes, 2),
      "context_privacy_verification_failed",
    );
  } finally {
    bytes.fill(0);
  }
});

Deno.test("cloud boundary mirrors device DLP for domain handle and coordinates", () => {
  for (
    const directIdentifier of [
      "example.com",
      "(@private_handle)",
      "32.0853, 34.7818",
    ]
  ) {
    const context = sanitizedContext();
    context.messages[0].text = directIdentifier;
    const bytes = new TextEncoder().encode(JSON.stringify(context));
    try {
      assertThrowsCode(
        () => parseSanitizedIncidentContext(bytes, 2),
        "context_privacy_verification_failed",
      );
    } finally {
      bytes.fill(0);
    }
  }
});

Deno.test("privacy v3 accepts redacted text and a typed safety context", () => {
  const context = sanitizedContext();
  context.privacy_contract_version = 3;
  context.safety_context = {
    child_age_band: "age_9_11",
    child_age_confidence: 0.7,
    child_age_evidence: "birth_year_calendar_estimate",
    relationship_type: "unsaved",
    relationship_confidence: 0.98,
    relationship_evidence: "whatsapp_unsaved_number",
    conversation_setting: "private",
    conversation_setting_confidence: 0.95,
    conversation_setting_evidence: "capture_private_chat",
    active_trend_counts: { grooming: 1 },
  };
  context.redaction_manifest = { person: 1, phone: 1, email: 1, url: 1 };
  context.messages[0].text = "[PERSON] [PHONE] [EMAIL] [URL]";
  context.messages[1].source_kind = "text";
  context.messages[1].capture_sources = ["notification"];
  const bytes = new TextEncoder().encode(JSON.stringify(context));
  try {
    const parsed = parseSanitizedIncidentContext(bytes, 2);
    assertEquals(parsed.messages[0].text, context.messages[0].text);
    const request = buildOpenAIRequest(
      parsed,
      "kippy_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    const input = request.input as Array<Record<string, unknown>>;
    const user = input.find((item) => item.role === "user");
    const content = user?.content as Array<Record<string, unknown>>;
    const projected = JSON.parse(String(content[0].text));
    assertEquals(projected.messages[0].text, context.messages[0].text);
  } finally {
    bytes.fill(0);
  }
});

Deno.test("privacy v3 rejects invalid redaction manifest values", () => {
  const context = sanitizedContext();
  context.privacy_contract_version = 3;
  context.safety_context = {
    child_age_band: "unknown",
    child_age_confidence: 0,
    child_age_evidence: "child_age_unavailable",
    relationship_type: "unknown",
    relationship_confidence: 0,
    relationship_evidence: "relationship_capture_unknown",
    conversation_setting: "private",
    conversation_setting_confidence: 1,
    conversation_setting_evidence: "capture_private_chat",
    active_trend_counts: {},
  };
  context.messages[1].source_kind = "text";
  context.messages[1].capture_sources = ["notification"];
  context.redaction_manifest = { person: -1 };

  assertThrowsCode(
    () =>
      parseSanitizedIncidentContext(
        new TextEncoder().encode(JSON.stringify(context)),
        2,
      ),
    "invalid_redaction_manifest",
  );
});

Deno.test("privacy v3 rejects unrecognized safety evidence codes", () => {
  const context = sanitizedContext();
  context.privacy_contract_version = 3;
  context.safety_context = {
    child_age_band: "unknown",
    child_age_confidence: 0,
    child_age_evidence: "child_age_unavailable",
    relationship_type: "unknown",
    relationship_confidence: 0,
    relationship_evidence: "identifier_shaped_but_untrusted",
    conversation_setting: "private",
    conversation_setting_confidence: 1,
    conversation_setting_evidence: "capture_private_chat",
    active_trend_counts: {},
  };

  assertThrowsCode(
    () =>
      parseSanitizedIncidentContext(
        new TextEncoder().encode(JSON.stringify(context)),
        2,
      ),
    "invalid_safety_context",
  );
});

Deno.test("privacy v3 rejects non-text and voice-pipeline messages", () => {
  for (
    const mutate of [
      (context: SanitizedIncidentContext) => {
        context.messages[0].source_kind = "voice_transcript" as "text";
      },
      (context: SanitizedIncidentContext) => {
        context.messages[0].capture_sources = ["voice_pipeline"];
      },
    ]
  ) {
    const context = sanitizedContext();
    context.privacy_contract_version = 3;
    context.safety_context = {
      child_age_band: "unknown",
      child_age_confidence: 0,
      child_age_evidence: "child_age_unavailable",
      relationship_type: "unknown",
      relationship_confidence: 0,
      relationship_evidence: "relationship_capture_unknown",
      conversation_setting: "private",
      conversation_setting_confidence: 1,
      conversation_setting_evidence: "capture_private_chat",
      active_trend_counts: {},
    };
    context.messages[1].source_kind = "text";
    context.messages[1].capture_sources = ["notification"];
    mutate(context);
    assertThrowsCode(
      () =>
        parseSanitizedIncidentContext(
          new TextEncoder().encode(JSON.stringify(context)),
          2,
        ),
      "invalid_context_message",
    );
  }
});

Deno.test("privacy v3 binds decrypted identity to the authenticated envelope", () => {
  const context = sanitizedContext();
  context.privacy_contract_version = 3;

  assertThrowsCode(
    () => assertIncidentContextBinding(context, 3, 8),
    "privacy_identity_mismatch",
  );
  assertThrowsCode(
    () => assertIncidentContextBinding(context, 2, 7),
    "invalid_context_contract",
  );
  assertIncidentContextBinding(context, 3, 7);
});

Deno.test("privacy v2 requires and preserves typed safety context", () => {
  const context = sanitizedContext();
  context.privacy_contract_version = 2;
  context.safety_context = {
    child_age_band: "age_9_11",
    child_age_confidence: 0.7,
    child_age_evidence: "birth_year_calendar_estimate",
    relationship_type: "unsaved",
    relationship_confidence: 0.98,
    relationship_evidence: "whatsapp_unsaved_number",
    conversation_setting: "private",
    conversation_setting_confidence: 0.95,
    conversation_setting_evidence: "capture_private_chat",
    active_trend_counts: { bullying: 2 },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(context));
  try {
    const parsed = parseSanitizedIncidentContext(bytes, 2);
    assertEquals(parsed.safety_context, context.safety_context);
    const request = buildOpenAIRequest(
      parsed,
      "kippy_v1_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    const input = request.input as Array<Record<string, unknown>>;
    const user = input.find((item) => item.role === "user");
    const content = user?.content as Array<Record<string, unknown>>;
    const projected = JSON.parse(String(content[0].text));
    assertEquals(projected.safety_context, context.safety_context);
  } finally {
    bytes.fill(0);
  }
});

function sanitizedContext(): SanitizedIncidentContext {
  return {
    schema_version: 2,
    privacy_contract_version: 1,
    privacy_identity_version: 7,
    conversation_ref: "ZZZZZZZZZZZZZZZZZZZZZZ",
    conversation_type: "private",
    trigger_segment_ref: "AAAAAAAAAAAAAAAAAAAAAA",
    evidence_segment_refs: ["AAAAAAAAAAAAAAAAAAAAAA"],
    messages: [
      {
        segment_ref: "AAAAAAAAAAAAAAAAAAAAAA",
        participant_ref: "PPPPPPPPPPPPPPPPPPPPPP",
        sequence: 0,
        relative_time_seconds: 0,
        sender_role: "peer",
        source_kind: "text",
        capture_sources: ["accessibility"],
        capture_confidence: {
          conversation: 0.9,
          message: 0.9,
          sender: 0.9,
          direction: 0.9,
        },
        text: "טקסט שעבר הסרת פרטים מזהים",
      },
      {
        segment_ref: "BBBBBBBBBBBBBBBBBBBBBB",
        participant_ref: "QQQQQQQQQQQQQQQQQQQQQQ",
        sequence: 1,
        relative_time_seconds: 3,
        sender_role: "child",
        source_kind: "text",
        capture_sources: ["notification"],
        capture_confidence: {
          conversation: 0.8,
          message: 0.8,
          sender: 0.8,
          direction: 0.8,
        },
        text: "תמלול מקומי ללא זהות ישירה",
      },
    ],
    redaction_manifest: { child_identity: 1 },
  };
}

function maximumGroupContext(): SanitizedIncidentContext {
  const messages = Array.from({ length: 60 }, (_, sequence) => ({
    segment_ref: `S${String(sequence).padStart(21, "0")}`,
    participant_ref: `P${String(sequence).padStart(21, "0")}`,
    sequence,
    relative_time_seconds: sequence,
    sender_role: sequence % 2 === 0 ? "peer" as const : "child" as const,
    source_kind: "text" as const,
    capture_sources: ["accessibility"],
    capture_confidence: {
      conversation: 0.9,
      message: 0.9,
      sender: 0.9,
      direction: 0.9,
    },
    reply_context: {
      quoted_sender_role: "peer" as const,
      quoted_text: "y".repeat(1_000),
    },
    text: "x".repeat(8_000),
  }));
  return {
    schema_version: 2,
    privacy_contract_version: 1,
    privacy_identity_version: 7,
    conversation_ref: "C".repeat(22),
    conversation_type: "group",
    trigger_segment_ref: messages[59].segment_ref,
    evidence_segment_refs: [messages[59].segment_ref],
    messages,
    redaction_manifest: {},
  };
}

function encryptedClaim(): ClaimedIncidentEnvelope {
  return {
    client_incident_id: "11111111-1111-8111-8111-111111111111",
    device_id: "22222222-2222-4222-8222-222222222222",
    category: "bullying",
    severity: "high",
    child_role: "target",
    confidence_canonical: "0.900000",
    capture_quality_canonical: "0.800000",
    occurred_at_canonical: "2026-07-29T00:00:00.000Z",
    model_contract_version: 2,
    privacy_contract_version: 1,
    privacy_identity_version: 7,
    aad_version: 3,
    encryption_algorithm: "RSA-OAEP-3072-SHA256+AES-256-GCM",
    key_version: 1,
    message_count: 2,
    context_expires_at_canonical: "2026-07-30T00:00:00.000Z",
    encrypted_payload_base64: "unused",
  };
}

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `assertEquals failed: ${JSON.stringify(actual)} !== ${
        JSON.stringify(expected)
      }`,
    );
  }
}

function assertThrowsCode(
  action: () => unknown,
  expectedCode: string,
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof ExpertAnalysisError &&
      error.code === expectedCode
    ) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}`);
}

function assertThrowsDisposition(
  action: () => unknown,
  expectedCode: string,
  expectedRetryable: boolean,
  expectedFailureClass: string,
): void {
  try {
    action();
  } catch (error) {
    if (
      error instanceof ExpertAnalysisError &&
      error.code === expectedCode &&
      error.retryable === expectedRetryable &&
      error.failureClass === expectedFailureClass
    ) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}`);
}

async function assertRejectsCryptoCode(
  action: () => Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (
      error instanceof IncidentCryptoError &&
      error.code === expectedCode
    ) return;
    throw error;
  }
  throw new Error(`Expected ${expectedCode}`);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function privateKeyPem(bytes: Uint8Array): string {
  const body = base64(bytes).match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
}
