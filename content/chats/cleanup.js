import { SELECTORS } from "../selectors.js";

const MISS_THRESHOLD = 5;

function makeChatKey(folderId, chatName) {
  return `${folderId}::${chatName}`;
}

function hasStableChatList() {
  const root = document.querySelector(SELECTORS.chatListRoot);
  if (!root) return false;

  const items = root.querySelectorAll("li");
  return items.length > 0;
}

export function cleanupOrphanedChatsSoft(state, app) {
  if (!state.isEnabled) {
    return { removed: 0, foldersChanged: 0 };
  }

  if (!hasStableChatList()) {
    return { removed: 0, foldersChanged: 0 };
  }

  if (typeof app.isUserActive === "function" && app.isUserActive()) {
    return { removed: 0, foldersChanged: 0 };
  }

  const allChatElements = document.querySelectorAll(SELECTORS.chatItem);
  const existingChatNames = new Set();

  allChatElements.forEach((chatElement) => {
    const chatName =
      typeof app.getChatName === "function"
        ? app.getChatName(chatElement)
        : null;

    if (chatName) {
      existingChatNames.add(chatName);
    }
  });

  let removed = 0;
  let foldersChanged = 0;

  const nextFolders = state.foldersData.map((folder) => {
    if (folder.id === "all") {
      return folder;
    }

    if (!Array.isArray(folder.chats) || folder.chats.length === 0) {
      return folder;
    }

    let changed = false;

    const nextChats = folder.chats.filter((chat) => {
      const key = makeChatKey(folder.id, chat.name);

      if (existingChatNames.has(chat.name)) {
        state.orphanMissCounts.delete(key);
        return true;
      }

      const nextMissCount = (state.orphanMissCounts.get(key) || 0) + 1;
      state.orphanMissCounts.set(key, nextMissCount);

      if (nextMissCount >= MISS_THRESHOLD) {
        removed += 1;
        changed = true;
        state.orphanMissCounts.delete(key);
        return false;
      }

      return true;
    });

    if (changed) {
      foldersChanged += 1;
      return {
        ...folder,
        chats: nextChats,
      };
    }

    return folder;
  });

  if (removed > 0) {
    state.foldersData = nextFolders;

    if (typeof app.saveFoldersData === "function") {
      app.saveFoldersData();
    }

    if (typeof app.updateFoldersDisplay === "function") {
      app.updateFoldersDisplay();
    }

    if (typeof app.filterChatsByFolder === "function") {
      app.filterChatsByFolder(state.selectedFolderId || "all");
    }

    if (typeof app.updateFolderBadges === "function") {
      app.updateFolderBadges();
    }

    console.log(
      `[cleanup] removed ${removed} chats from ${foldersChanged} folders`,
    );
  }

  return { removed, foldersChanged };
}

export function resetOrphanTracking(state) {
  if (state.orphanMissCounts) {
    state.orphanMissCounts.clear();
  }
}
