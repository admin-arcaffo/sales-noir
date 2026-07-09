export const CHAT_CACHE_INVALIDATED_EVENT = "sales_arcaffo_chat_cache_invalidated";
export const CHAT_CONVERSATIONS_CACHE_KEY = "sales_arcaffo_conversations";
export const CHAT_LAST_SYNC_TIME_KEY = "sales_arcaffo_last_sync_time";
export const FLOATING_CHAT_CONVERSATIONS_CACHE_KEY = "sales_arcaffo_floating_conversations";
export const FLOATING_CHAT_LAST_SYNC_TIME_KEY = "sales_arcaffo_floating_last_sync_time";

export function clearChatCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CHAT_CONVERSATIONS_CACHE_KEY);
  localStorage.removeItem(CHAT_LAST_SYNC_TIME_KEY);
  localStorage.removeItem(FLOATING_CHAT_CONVERSATIONS_CACHE_KEY);
  localStorage.removeItem(FLOATING_CHAT_LAST_SYNC_TIME_KEY);
}

export function invalidateChatCache() {
  if (typeof window === "undefined") return;
  clearChatCache();
  window.dispatchEvent(new CustomEvent(CHAT_CACHE_INVALIDATED_EVENT));
}
