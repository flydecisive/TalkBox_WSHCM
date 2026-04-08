export function getCurrentChatDescriptor() {
  const titleCandidates = [
    '.ws-conversation-header--title span[data-p-tooltip="true"]',
    ".ws-conversation-header--title",
    ".ws-conversation-header--title-part",
  ];

  let titleEl = null;

  for (const selector of titleCandidates) {
    const found = document.querySelector(selector);
    if (found && found.textContent?.trim()) {
      titleEl = found;
      break;
    }
  }

  const fullTitle = titleEl?.textContent?.trim() || "";
  if (!fullTitle) {
    return null;
  }

  const normalizedSource = fullTitle.replace(/\s+/g, " ").trim();
  const match = normalizedSource.match(/^(\d+)\s+(.+)$/);

  const chatNumber = match ? match[1] : null;
  const chatTitle = match ? match[2].trim() : normalizedSource;
  const normalizedTitle = normalizedSource.toLowerCase();

  return {
    fullTitle: normalizedSource,
    chatNumber,
    chatTitle,
    normalizedTitle,
    chatKey: chatNumber || normalizedTitle,
  };
}

export function getCurrentChatKey() {
  return getCurrentChatDescriptor()?.chatKey || null;
}

export function getMessageElementFromTarget(target) {
  const msgRoot = target.closest('div[id^="message_"]');
  if (!msgRoot) return null;

  const listItem = msgRoot.closest("li.ws-msg-item");
  if (!listItem) return null;

  return {
    listItem,
    msgRoot,
    messageId: msgRoot.id,
  };
}

export function getMessageId(messageRoot) {
  if (!messageRoot) return null;
  return messageRoot.id || null;
}

export function getMessageText(messageRoot) {
  if (!messageRoot) return "";

  const text = messageRoot.innerText || messageRoot.textContent || "";
  return text.trim().replace(/\s+/g, " ").slice(0, 500);
}

export function buildPinFromMessage(messageRoot) {
  const messageId = getMessageId(messageRoot);
  if (!messageId) return null;

  const chat = getCurrentChatDescriptor();

  return {
    messageId,
    text: getMessageText(messageRoot),
    createdAt: new Date().toISOString(),
    chatMeta: chat
      ? {
          chatKey: chat.chatKey,
          chatNumber: chat.chatNumber,
          chatTitle: chat.chatTitle,
          fullTitle: chat.fullTitle,
        }
      : null,
  };
}
