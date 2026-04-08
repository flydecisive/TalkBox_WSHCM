import { SELECTORS } from "../selectors.js";

function hasFoldersInDOM() {
  return !!document.querySelector(SELECTORS.foldersRoot);
}

function hasHeader() {
  return !!document.querySelector(SELECTORS.header);
}

function hasChatListRoot() {
  return !!document.querySelector(SELECTORS.chatListRoot);
}

export function setupSPAWatchdog(state, app) {
  removeSPAWatchdog(state);

  state.periodUpdateInterval = setInterval(() => {
    if (!state.isEnabled) return;

    const headerExists = hasHeader();
    const foldersExist = hasFoldersInDOM();
    const chatListExists = hasChatListRoot();

    if (!headerExists) return;

    // Если header есть, а папок нет — сайт их потерял, надо вернуть
    if (!foldersExist) {
      console.warn("[spa-watchdog] folders missing, restoring UI");
      if (typeof app.reinitializeUI === "function") {
        app.reinitializeUI();
      }
      return;
    }

    // Если список чатов уже есть, но фильтр/бейджи могли устареть — освежаем
    if (chatListExists) {
      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder(state.selectedFolderId || "all");
      }

      if (typeof app.updateSelectedFolder === "function") {
        app.updateSelectedFolder();
      }

      if (typeof app.updateFolderBadges === "function") {
        app.updateFolderBadges();
      }

      if (typeof app.cleanupOrphanedChatsSoft === "function") {
        app.cleanupOrphanedChatsSoft();
      }

      if (typeof app.updatePinsBar === "function") {
        app.updatePinsBar();
      }

      if (typeof app.markVisiblePinnedChatsAsSeen === "function") {
        app.markVisiblePinnedChatsAsSeen();
      }

      if (typeof app.cleanupOldPinnedChats === "function") {
        app.cleanupOldPinnedChats();
      }
    }
  }, 3000);
}

export function removeSPAWatchdog(state) {
  if (state.periodUpdateInterval) {
    clearInterval(state.periodUpdateInterval);
    state.periodUpdateInterval = null;
  }
}

export function setupSPAObserver(state, app) {
  removeSPAObserver(state);

  state.spaObserver = new MutationObserver(() => {
    if (!state.isEnabled) return;

    const headerExists = hasHeader();
    if (!headerExists) return;

    const foldersExist = hasFoldersInDOM();

    if (!foldersExist) {
      if (typeof app.reinitializeUI === "function") {
        app.reinitializeUI();
      }

      if (typeof app.updatePinsBar === "function") {
        app.updatePinsBar();
      }
    }
  });

  if (document.body) {
    state.spaObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

export function removeSPAObserver(state) {
  if (state.spaObserver) {
    state.spaObserver.disconnect();
    state.spaObserver = null;
  }
}
