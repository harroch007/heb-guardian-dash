import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify admin via auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Verify caller is admin
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: claims, error: claimsErr } = await anonClient.auth.getUser()
    if (claimsErr || !claims?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: isAdmin } = await supabaseAdmin.rpc('is_admin_by_id', { _user_id: claims.user.id }).maybeSingle()
    
    // Fallback: check user_roles directly
    const { data: roleCheck } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', claims.user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { userId } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Prevent self-deletion
    if (userId === claims.user.id) {
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`Admin ${claims.user.id} deleting user ${userId}`)

    // Log activity before deletion
    await supabaseAdmin.from('admin_activity_log').insert({
      admin_user_id: claims.user.id,
      target_parent_id: userId,
      action_type: 'delete_user',
      action_details: { deleted_at: new Date().toISOString() },
    })

    // Get child IDs
    const { data: children } = await supabaseAdmin
      .from('children')
      .select('id')
      .eq('parent_id', userId)

    const childIds = children?.map(c => c.id) || []

    // Get device IDs
    const { data: devices } = childIds.length > 0
      ? await supabaseAdmin.from('devices').select('device_id').in('child_id', childIds)
      : { data: [] }

    const deviceIds = devices?.map(d => d.device_id) || []

    // Delete in dependency order
    if (childIds.length > 0) {
      await supabaseAdmin.from('child_daily_insights').delete().in('child_id', childIds)
      await supabaseAdmin.from('child_periodic_summaries').delete().in('child_id', childIds)
      await supabaseAdmin.from('child_model_override').delete().in('child_id', childIds)
      await supabaseAdmin.from('insight_logs').delete().in('child_id', childIds)
      await supabaseAdmin.from('alerts').delete().in('child_id', childIds)
      await supabaseAdmin.from('alert_feedback').delete().eq('parent_id', userId)
      await supabaseAdmin.from('app_usage').delete().in('child_id', childIds)
      await supabaseAdmin.from('app_alerts').delete().in('child_id', childIds)
      await supabaseAdmin.from('nightly_usage_reports').delete().in('child_id', childIds)
      await supabaseAdmin.from('device_events').delete().in('child_id', childIds)
      await supabaseAdmin.from('settings').delete().in('child_id', childIds)
      await supabaseAdmin.from('ai_stack_requests').delete().in('child_id', childIds)
    }

    if (deviceIds.length > 0) {
      await supabaseAdmin.from('device_commands').delete().in('device_id', deviceIds)
      await supabaseAdmin.from('device_daily_health').delete().in('device_id', deviceIds)
      await supabaseAdmin.from('device_daily_metrics').delete().in('device_id', deviceIds)
      await supabaseAdmin.from('daily_chat_stats').delete().in('device_id', deviceIds)
      await supabaseAdmin.from('devices').delete().in('device_id', deviceIds)
    }

    // Delete parent-level data
    if (childIds.length > 0) {
      await supabaseAdmin.from('children').delete().in('id', childIds)
    }
    await supabaseAdmin.from('settings').delete().eq('parent_id', userId)
    await supabaseAdmin.from('admin_notes').delete().eq('parent_id', userId)
    await supabaseAdmin.from('push_subscriptions').delete().eq('parent_id', userId)
    await supabaseAdmin.from('parents').delete().eq('id', userId)

    // Delete from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) {
      console.error('Auth delete error:', authError.message)
      return new Response(
        JSON.stringify({ error: `User data deleted but auth deletion failed: ${authError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully deleted user ${userId}`)
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Delete user error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
