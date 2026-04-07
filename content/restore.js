import { SELECTORS } from "./selectors.js";

function hasRenderedChats() {
  const list = document.querySelector(SELECTORS.chatListRoot);
  if (!list) return false;

  const items = list.querySelectorAll("li");
  return items.length > 0;
}

function hasRenderedFolders() {
  const foldersRoot = document.querySelector(SELECTORS.foldersRoot);
  if (!foldersRoot) return false;

  const folders = foldersRoot.querySelectorAll(SELECTORS.folder);
  return folders.length > 0;
}

export function applySavedFolderQuick(state, app) {
  if (!state.isEnabled) return;

  const apply = () => {
    if (!hasRenderedFolders()) return false;

    const folderId = state.selectedFolderId || "all";
    const folderElement = document.querySelector(
      `.folder[data-id="${folderId}"]`,
    );

    if (!folderElement) {
      state.selectedFolderId = "all";

      if (typeof app.updateSelectedFolder === "function") {
        app.updateSelectedFolder();
      }

      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder("all");
      }

      return true;
    }

    if (typeof app.updateSelectedFolder === "function") {
      app.updateSelectedFolder();
    }

    if (typeof app.filterChatsByFolder === "function") {
      app.filterChatsByFolder(folderId);

      setTimeout(() => {
        app.filterChatsByFolder(folderId);
      }, 300);
    }

    return true;
  };

  if (hasRenderedChats()) {
    apply();
    return;
  }

  let attempts = 0;
  const maxAttempts = 40;

  const timer = setInterval(() => {
    attempts += 1;

    if (hasRenderedChats()) {
      clearInterval(timer);
      apply();
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);
      apply();
    }
  }, 250);

  const observer = new MutationObserver(() => {
    if (hasRenderedChats()) {
      clearInterval(timer);
      observer.disconnect();
      apply();
    }
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  setTimeout(() => {
    observer.disconnect();
  }, 15000);
}
