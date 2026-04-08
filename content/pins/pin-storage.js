const STORAGE_KEY = "pinned_messages";
const CHAT_LAST_SEEN_KEY = "pinned_messages_chat_last_seen";
const PIN_RETENTION_DAYS = 30;

function getRetentionMs() {
  return PIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export async function getAllPinnedMessages() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result?.[STORAGE_KEY] || {});
    });
  });
}

export async function getPinnedMessagesByChat(chatKey) {
  const allPins = await getAllPinnedMessages();
  return allPins[chatKey] || [];
}

export async function savePinnedMessagesByChat(chatKey, pins) {
  const allPins = await getAllPinnedMessages();

  if (!pins || pins.length === 0) {
    delete allPins[chatKey];
  } else {
    allPins[chatKey] = pins;
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: allPins }, () => {
      resolve(true);
    });
  });
}

export async function addPinnedMessage(chatKey, pin) {
  const pins = await getPinnedMessagesByChat(chatKey);

  const exists = pins.some((item) => item.messageId === pin.messageId);
  if (exists) return false;

  pins.push(pin);
  await savePinnedMessagesByChat(chatKey, pins);
  return true;
}

export async function removePinnedMessage(chatKey, messageId) {
  const pins = await getPinnedMessagesByChat(chatKey);
  const nextPins = pins.filter((item) => item.messageId !== messageId);

  await savePinnedMessagesByChat(chatKey, nextPins);
  return true;
}

export async function isPinnedMessage(chatKey, messageId) {
  const pins = await getPinnedMessagesByChat(chatKey);
  return pins.some((item) => item.messageId === messageId);
}

export async function getAllChatsLastSeen() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CHAT_LAST_SEEN_KEY], (result) => {
      resolve(result?.[CHAT_LAST_SEEN_KEY] || {});
    });
  });
}

export async function saveAllChatsLastSeen(lastSeenMap) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CHAT_LAST_SEEN_KEY]: lastSeenMap }, () => {
      resolve(true);
    });
  });
}

export async function markChatsAsSeen(chatDescriptors) {
  if (!Array.isArray(chatDescriptors) || chatDescriptors.length === 0) {
    return false;
  }

  const now = new Date().toISOString();
  const lastSeenMap = await getAllChatsLastSeen();

  chatDescriptors.forEach((chat) => {
    if (!chat?.chatKey) return;

    lastSeenMap[chat.chatKey] = {
      chatKey: chat.chatKey,
      chatNumber: chat.chatNumber || null,
      chatTitle: chat.chatTitle || null,
      fullTitle: chat.fullTitle || null,
      lastSeenAt: now,
    };
  });

  await saveAllChatsLastSeen(lastSeenMap);
  return true;
}

export async function cleanupOldPinnedChats() {
  const allPins = await getAllPinnedMessages();
  const lastSeenMap = await getAllChatsLastSeen();

  const now = Date.now();
  const retentionMs = getRetentionMs();

  let removedChats = 0;
  let changed = false;

  Object.keys(allPins).forEach((chatKey) => {
    const pins = allPins[chatKey];
    if (!Array.isArray(pins) || pins.length === 0) {
      delete allPins[chatKey];
      changed = true;
      return;
    }

    const isLocked = pins.some((pin) => pin.isLocked === true);
    if (isLocked) {
      return;
    }

    const lastSeen = lastSeenMap[chatKey]?.lastSeenAt;
    if (!lastSeen) {
      return;
    }

    const lastSeenTs = new Date(lastSeen).getTime();
    if (Number.isNaN(lastSeenTs)) {
      return;
    }

    if (now - lastSeenTs > retentionMs) {
      delete allPins[chatKey];
      delete lastSeenMap[chatKey];
      removedChats += 1;
      changed = true;
    }
  });

  if (!changed) {
    return { removedChats: 0 };
  }

  await new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEY]: allPins,
        [CHAT_LAST_SEEN_KEY]: lastSeenMap,
      },
      () => resolve(true),
    );
  });

  return { removedChats };
}

export async function lockPinnedChat(chatKey) {
  const allPins = await getAllPinnedMessages();
  const pins = allPins[chatKey] || [];

  if (!pins.length) return false;

  const nextPins = pins.map((pin) => ({
    ...pin,
    isLocked: true,
  }));

  await savePinnedMessagesByChat(chatKey, nextPins);
  return true;
}

export async function unlockPinnedChat(chatKey) {
  const allPins = await getAllPinnedMessages();
  const pins = allPins[chatKey] || [];

  if (!pins.length) return false;

  const nextPins = pins.map((pin) => ({
    ...pin,
    isLocked: false,
  }));

  await savePinnedMessagesByChat(chatKey, nextPins);
  return true;
}

export async function isPinnedChatLocked(chatKey) {
  const pins = await getPinnedMessagesByChat(chatKey);
  return pins.some((pin) => pin.isLocked === true);
}
