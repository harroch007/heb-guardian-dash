import { z } from "zod";

export type CtR0JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CtR0JsonValue[]
  | { readonly [key: string]: CtR0JsonValue };

export interface CtR0DecodeIssue {
  readonly path: string;
  readonly code: string;
}

export type CtR0DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly CtR0DecodeIssue[] };

const FORBIDDEN_SAFE_JSON_KEYS = new Set([
  "wa_id",
  "phone",
  "phone_number",
  "email",
  "text",
  "body",
  "password",
  "otp",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "activation_token",
  "credential",
  "credential_hash",
  "auth_secret",
  "p256dh",
  "raw",
  "raw_text",
  "raw_message",
  "raw_payload",
  "encrypted_payload",
]);

const safeJsonObjectSchema: z.ZodType<CtR0JsonValue> = z.lazy(() =>
  z.record(safeJsonValueSchema).superRefine((value, context) => {
    const keys = Object.keys(value);
    if (keys.length > 512) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "too_many_keys" });
    }
    for (const key of keys) {
      if (FORBIDDEN_SAFE_JSON_KEYS.has(key.toLowerCase())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "forbidden_safe_json_key",
          path: [key],
        });
      }
    }
  }),
);

export const safeJsonValueSchema: z.ZodType<CtR0JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string().max(131_072),
    z.array(safeJsonValueSchema).max(1_000),
    safeJsonObjectSchema,
  ]),
);

export const uuidSchema = z.string().uuid();

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, precision: 3 })
  .or(z.string().datetime({ offset: true, precision: 6 }))
  .or(z.string().datetime({ offset: true }));

export const safeKeySchema = z.string().min(2).max(160).regex(/^[a-z0-9_.:-]+$/);
export const boundedTextSchema = z.string().min(1).max(4_000);
export const nullableUuidSchema = uuidSchema.nullable();
export const nullableDateTimeSchema = isoDateTimeSchema.nullable();
export const nullableBoundedTextSchema = boundedTextSchema.nullable();

export const bigintIdSchema = z
  .union([z.number().int().safe().nonnegative(), z.string().regex(/^\d+$/)])
  .transform((value) => String(value));

export const nullableBigintIdSchema = bigintIdSchema.nullable();

function pathToString(path: readonly (string | number)[]): string {
  if (path.length === 0) return "$";
  return path.reduce<string>((result, segment) => {
    if (typeof segment === "number") return `${result}[${segment}]`;
    return `${result}.${segment}`;
  }, "$" );
}

export function decodeWithSchema<TOutput, TInput>(
  schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>,
  value: unknown,
): CtR0DecodeResult<TOutput> {
  const decoded = schema.safeParse(value);
  if (decoded.success) return { ok: true, value: decoded.data };

  return {
    ok: false,
    issues: decoded.error.issues.map((issue) => ({
      path: pathToString(issue.path),
      code: issue.code,
    })),
  };
}
