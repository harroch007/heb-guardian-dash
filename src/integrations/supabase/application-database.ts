import type { Database as MainDatabase } from "./types";
import type { Database as LegacyDatabase } from "./legacy-types";

/**
 * Compile-only compatibility for retained legacy callers of the existing clients.
 * Canonical V2 declarations remain authoritative, including on name collisions.
 * This type does not establish that historical legacy endpoints are deployed.
 *
 * legacy-types.ts is the exact Git blob from:
 * Commit: 19a0199c992fdbbe8906944a7234fed0ef75cd16
 * Path: src/integrations/supabase/types.ts
 * SHA256: 0fa91d81dbc369f8fa81cb3af95fba54d2eaeb9873a40f926a533cde7db645c0
 * Import its declarations only as types; retain the existing runtime clients.
 */
type MainAuthoritative<Current, Legacy> = Current & Omit<Legacy, keyof Current>;

type MainPublic = MainDatabase["public"];
type LegacyPublic = LegacyDatabase["public"];

export type ApplicationDatabase = Omit<MainDatabase, "public"> & {
  public: {
    Tables: MainAuthoritative<MainPublic["Tables"], LegacyPublic["Tables"]>;
    Views: MainAuthoritative<MainPublic["Views"], LegacyPublic["Views"]>;
    Functions: MainAuthoritative<MainPublic["Functions"], LegacyPublic["Functions"]>;
    Enums: MainAuthoritative<MainPublic["Enums"], LegacyPublic["Enums"]>;
    CompositeTypes: MainAuthoritative<MainPublic["CompositeTypes"], LegacyPublic["CompositeTypes"]>;
  };
};
