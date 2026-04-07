import { SELECTORS } from "../selectors.js";

function getChatListRoot() {
  return document.querySelector(SELECTORS.chatListRoot);
}

export function removeChatListObserver(state) {
  if (state.chatListObserver) {
    state.chatListObserver.disconnect();
    state.chatListObserver = null;
  }
}

export function setupChatListObserver(state, app) {
  removeChatListObserver(state);

  const tryAttach = () => {
    const chatListRoot = getChatListRoot();

    if (!chatListRoot) {
      return false;
    }

    let debounceTimer = null;

    state.chatListObserver = new MutationObserver(() => {
      if (!state.isEnabled) return;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        const folderId = state.selectedFolderId || "all";

        if (typeof app.filterChatsByFolder === "function") {
          app.filterChatsByFolder(folderId);
        }

        if (typeof app.updateSelectedFolder === "function") {
          app.updateSelectedFolder();
        }

        if (typeof app.updateFolderBadges === "function") {
          app.updateFolderBadges();
        }
      }, 120);
    });

    state.chatListObserver.observe(chatListRoot, {
      childList: true,
      subtree: true,
    });

    console.log("[chat-list-observer] attached");
    return true;
  };

  if (tryAttach()) return;

  let attempts = 0;
  const maxAttempts = 40;

  const timer = setInterval(() => {
    attempts += 1;

    if (tryAttach()) {
      clearInterval(timer);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);
      console.warn("[chat-list-observer] root not found after retries");
    }
  }, 250);
}
