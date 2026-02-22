import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all premium children with expired subscriptions
    const { data: expiredChildren, error: fetchError } = await supabase
      .from('children')
      .select('id, name, parent_id, subscription_expires_at')
      .eq('subscription_tier', 'premium')
      .not('subscription_expires_at', 'is', null)
      .lt('subscription_expires_at', new Date().toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredChildren || expiredChildren.length === 0) {
      console.log('No expired subscriptions found');
      return new Response(JSON.stringify({ expired: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${expiredChildren.length} expired subscriptions`);

    const expiredIds = expiredChildren.map((c: any) => c.id);

    // Downgrade all expired subscriptions
    const { error: updateError } = await supabase
      .from('children')
      .update({ subscription_tier: 'free', subscription_expires_at: null })
      .in('id', expiredIds);

    if (updateError) {
      throw updateError;
    }

    for (const child of expiredChildren) {
      console.log(`Downgraded child ${child.id} (${child.name}) — expired at ${child.subscription_expires_at}`);
    }

    return new Response(JSON.stringify({ expired: expiredChildren.length, ids: expiredIds }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error in expire-subscriptions:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
