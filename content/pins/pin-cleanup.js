import * as pinStorage from "./pin-storage.js";

const SIDEBAR_CHAT_SELECTOR = ".ws-conversations-list-item--info--name";

function parseChatDescriptorFromTitle(fullTitle) {
  const value = String(fullTitle || "").trim();
  if (!value) return null;

  const match = value.match(/^(\d+)\s+(.+)$/);

  const chatNumber = match ? match[1] : null;
  const chatTitle = match ? match[2].trim() : value;
  const normalizedTitle = value.toLowerCase().replace(/\s+/g, " ").trim();

  return {
    fullTitle: value,
    chatNumber,
    chatTitle,
    normalizedTitle,
    chatKey: chatNumber || normalizedTitle,
  };
}

function getSidebarChats() {
  const nodes = document.querySelectorAll(SIDEBAR_CHAT_SELECTOR);
  const chats = [];

  nodes.forEach((node) => {
    const descriptor = parseChatDescriptorFromTitle(node.textContent);
    if (descriptor) {
      chats.push(descriptor);
    }
  });

  return chats;
}

export async function markVisibleChatsAsSeen() {
  const chats = getSidebarChats();
  if (!chats.length) return false;

  await pinStorage.markChatsAsSeen(chats);
  return true;
}

export async function cleanupOldPinnedChats() {
  return pinStorage.cleanupOldPinnedChats();
}
