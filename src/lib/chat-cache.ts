export const CHAT_CACHE_INVALIDATED_EVENT = "sales_arcaffo_chat_cache_invalidated";

export function clearChatCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sales_arcaffo_conversations");
  localStorage.removeItem("sales_arcaffo_last_sync_time");
}

export function invalidateChatCache() {
  if (typeof window === "undefined") return;
  clearChatCache();
  window.dispatchEvent(new CustomEvent(CHAT_CACHE_INVALIDATED_EVENT));
}
