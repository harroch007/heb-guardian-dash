

# Fix Push Notifications - Missing VAPID Authorization

## Problem Identified

The push notifications fail with a **401 Unauthorized** error because the edge function generates VAPID authentication but **never uses it**. The `generateVapidAuth` function exists but is not called when sending to the push endpoint.

## Root Cause

In `supabase/functions/send-push-notification/index.ts`:
- Lines 10-61: `generateVapidAuth()` function is defined correctly
- Lines 75-83: The fetch request does NOT include the Authorization header
- The VAPID parameters are passed to `sendPushToEndpoint` but never used

## Solution

### Step 1: Fix the sendPushToEndpoint function

Update the function to call `generateVapidAuth` and include the Authorization header:

```text
File: supabase/functions/send-push-notification/index.ts

REPLACE the sendPushToEndpoint function (lines 63-101) with:

async function sendPushToEndpoint(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ success: boolean; status?: number; expired?: boolean }> {
  try {
    const payloadStr = JSON.stringify(payload);
    
    // Generate VAPID authorization header
    const { authorization } = await generateVapidAuth(
      subscription.endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      subject
    );
    
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,  // <-- This was missing!
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: payloadStr,
    });
    
    if (response.status === 201 || response.status === 200) {
      return { success: true, status: response.status };
    }
    
    if (response.status === 404 || response.status === 410) {
      console.log(`Subscription expired: ${subscription.endpoint}`);
      return { success: false, status: response.status, expired: true };
    }
    
    console.error(`Push failed with status ${response.status}: ${await response.text()}`);
    return { success: false, status: response.status };
  } catch (error) {
    console.error('Push send error:', error);
    return { success: false };
  }
}
```

### Step 2: Deploy and Test

After deployment:
1. Go to Settings
2. Click "Send test notification" button
3. You should receive the push notification

## Technical Notes

- The VAPID keys are already configured in Supabase secrets
- The `generateVapidAuth` function correctly creates a signed JWT
- The push services (FCM for Chrome, Mozilla for Firefox) require this Authorization header
- Full payload encryption (RFC 8291) would be ideal but many push services accept unencrypted JSON with valid VAPID auth

## Expected Outcome

After this fix:
- Push notifications will be delivered successfully
- The logs will show "Push notification sent: 1/1 successful" instead of 0/1
- Both test notifications and real alert notifications will work

