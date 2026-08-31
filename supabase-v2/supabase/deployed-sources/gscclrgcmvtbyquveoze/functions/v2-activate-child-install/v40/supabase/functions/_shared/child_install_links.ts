const CHILD_APP_PACKAGE = "com.kippy.safety.core";

export function childInstallActivationUrl(
  supabaseUrl: string,
  activationToken: string,
): string {
  const url = new URL(
    "/functions/v1/v2-activate-child-install",
    withTrailingSlash(supabaseUrl),
  );
  url.searchParams.set("activation_token", activationToken);
  return url.toString();
}

export function childAppLaunchIntent(playStoreUrl: string): string {
  const fallback = encodeURIComponent(playStoreUrl);
  return "intent://open-child-app#Intent;" +
    "scheme=kippy;" +
    `package=${CHILD_APP_PACKAGE};` +
    `S.browser_fallback_url=${fallback};` +
    "end";
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
