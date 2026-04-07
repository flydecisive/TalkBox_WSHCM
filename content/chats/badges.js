import { SELECTORS } from "../selectors.js";

function getFolderElements() {
  return document.querySelectorAll(SELECTORS.folder);
}

function getAllBadgeElements() {
  return document.querySelectorAll(SELECTORS.chatBadge);
}

function getVisibleBadgeElements() {
  return document.querySelectorAll(SELECTORS.visibleChatBadge);
}

export function getTotalUnreadCount() {
  const allBadges = getAllBadgeElements();
  let count = 0;

  allBadges.forEach((badge) => {
    if (
      badge &&
      badge.offsetParent !== null &&
      badge.style.display !== "none" &&
      !badge.hidden
    ) {
      count += 1;
    }
  });

  return count;
}

export function getUnreadCountForSpecificFolder(state, app, folder) {
  if (!folder || !folder.chats || folder.chats.length === 0) return 0;

  const allChatsWithBadges = getVisibleBadgeElements();
  if (allChatsWithBadges.length === 0) return 0;

  const chatsWithBadgesMap = new Map();

  for (let i = 0; i < allChatsWithBadges.length; i++) {
    const badge = allChatsWithBadges[i];

    if (
      badge.offsetParent !== null &&
      badge.style.display !== "none" &&
      !badge.hidden
    ) {
      const chatElement = badge.closest(SELECTORS.chatItem);

      if (chatElement) {
        const chatName =
          typeof app.getChatName === "function"
            ? app.getChatName(chatElement)
            : null;

        if (chatName) {
          chatsWithBadgesMap.set(chatName, true);
        }
      }
    }
  }

  let unreadCount = 0;

  for (let i = 0; i < folder.chats.length; i++) {
    if (chatsWithBadgesMap.has(folder.chats[i].name)) {
      unreadCount += 1;
    }
  }

  return unreadCount;
}

export function getUnreadCountForFolder(state, app, folderId) {
  if (folderId === "all") {
    return getTotalUnreadCount();
  }

  const folder = state.foldersData.find((f) => f.id === folderId);
  if (!folder || folder.hidden) return 0;

  return getUnreadCountForSpecificFolder(state, app, folder);
}

export function updateFolderBadges(state, app) {
  if (state.updateBadgesTimeout) {
    clearTimeout(state.updateBadgesTimeout);
  }

  state.updateBadgesTimeout = setTimeout(() => {
    const folders = getFolderElements();

    if (folders.length === 0) {
      state.updateBadgesTimeout = null;
      return;
    }

    folders.forEach((folderEl) => {
      const folderId = folderEl.getAttribute("data-id");
      if (!folderId) return;

      const unreadCount =
        typeof app.getUnreadCountForFolder === "function"
          ? app.getUnreadCountForFolder(folderId)
          : 0;

      let badgeEl = folderEl.querySelector(".folder__badge");

      if (unreadCount <= 0) {
        if (badgeEl) {
          badgeEl.remove();
        }
        return;
      }

      const badgeText = unreadCount > 9 ? "9+" : unreadCount.toString();

      if (!badgeEl) {
        badgeEl = document.createElement("div");
        badgeEl.className = "folder__badge";
        folderEl.insertAdjacentElement("afterbegin", badgeEl);
      }

      badgeEl.textContent = badgeText;
    });

    state.updateBadgesTimeout = null;
  }, 50);
}

export function waitForDOMAndUpdateBadges(state, app) {
  let attempts = 0;
  const maxAttempts = 30;

  const tryUpdate = () => {
    attempts += 1;

    const foldersExist = document.querySelectorAll(SELECTORS.folder).length > 0;
    const chatListExists = !!document.querySelector(SELECTORS.chatListRoot);

    if (foldersExist && chatListExists) {
      updateFolderBadges(state, app);
      return true;
    }

    if (attempts >= maxAttempts) {
      return true;
    }

    return false;
  };

  if (tryUpdate()) return;

  const timer = setInterval(() => {
    if (tryUpdate()) {
      clearInterval(timer);
    }
  }, 250);
}
