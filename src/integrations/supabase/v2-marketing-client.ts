import type { SupabaseClient } from "@supabase/supabase-js";
import type { WaitlistAttribution } from "@/lib/marketingAttribution";
import { v2Supabase } from "./v2-client";
import type { Database as V2Database, Json } from "./v2-types";

type V2MarketingDatabase = Omit<V2Database, "public"> & {
  public: Omit<V2Database["public"], "Functions"> & {
    Functions: V2Database["public"]["Functions"] & {
      v2_submit_marketing_waitlist: {
        Args: {
          target_parent_name: string;
          target_email: string;
          target_phone: string;
          target_child_age: number;
          target_device_os: string;
          target_region?: string | null;
          target_referral_source?: string | null;
          target_referral_other?: string | null;
          target_first_touch?: Json;
          target_submission_touch?: Json;
          target_landing_path?: string;
          target_referrer_host?: string | null;
          target_marketing_notice_version?: string;
        };
        Returns: string;
      };
    };
  };
};

const v2MarketingSupabase =
  v2Supabase as unknown as SupabaseClient<V2MarketingDatabase>;

export interface MarketingWaitlistSubmission {
  parentName: string;
  email: string;
  phone: string;
  childAge: number;
  deviceOs: "android" | "iphone";
  region: string | null;
  referralSource: string | null;
  referralOther: string | null;
  attribution: WaitlistAttribution;
}

/**
 * Narrow public write boundary for the V2 pre-launch waitlist.
 * The database RPC owns normalization, validation and duplicate enforcement.
 */
export function submitMarketingWaitlist(input: MarketingWaitlistSubmission) {
  return v2MarketingSupabase.rpc("v2_submit_marketing_waitlist", {
    target_parent_name: input.parentName,
    target_email: input.email,
    target_phone: input.phone,
    target_child_age: input.childAge,
    target_device_os: input.deviceOs,
    target_region: input.region,
    target_referral_source: input.referralSource,
    target_referral_other: input.referralOther,
    target_first_touch: input.attribution.first_touch,
    target_submission_touch: input.attribution.submission_touch,
    target_landing_path: input.attribution.landing_path,
    target_referrer_host: input.attribution.referrer_host,
    target_marketing_notice_version: input.attribution.marketing_notice_version,
  });
}
