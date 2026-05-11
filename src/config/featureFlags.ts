// Feature flags for controlling app behavior
// Set WAITLIST_MODE to false to restore full app functionality

export const WAITLIST_MODE = true;

// Hide all WhatsApp monitoring / alerts / premium upgrade UI.
// Set to true to restore alerts tab, upgrade CTAs, smart protection cards, etc.
// All underlying logic, tables, edge functions, and routes remain intact.
export const WHATSAPP_MONITORING_ENABLED = false;

// Hide all chat UI (parent↔child and parent↔others) from the parent app.
// Set to true to restore the chat tab, badges, and entry points.
// All underlying code, hooks, routes, RPCs, and tables remain intact.
export const CHAT_ENABLED = false;
