import ChildControlV2 from "./ChildControlV2";

/**
 * Canonical Guardian child route.
 *
 * WhatsApp safety and parental controls intentionally share one screen and
 * one V2 data contract. Keeping this small route boundary prevents the
 * monitoring-only page and the parental-controls donor page from diverging.
 */
export default function GuardianChildV2() {
  return <ChildControlV2 />;
}
