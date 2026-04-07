import { SELECTORS } from "../selectors.js";

export async function loadCSS() {
  return new Promise((resolve) => {
    const existingStyles = document.querySelector(SELECTORS.stylesId);
    if (existingStyles) {
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.id = "chat-extension-styles";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = chrome.runtime.getURL("styles.css");

    link.onload = () => {
      console.log("[folders-ui] CSS styles loaded");
      resolve();
    };

    link.onerror = (error) => {
      console.error("[folders-ui] CSS load error:", error);
      resolve();
    };

    document.head.appendChild(link);
  });
}

export function getAllFolders() {
  return document.querySelectorAll(SELECTORS.folder);
}

export function addAtributesForFolders(state) {
  const folders = getAllFolders();

  folders.forEach((folder, index) => {
    if (state.foldersData[index]) {
      folder.setAttribute("data-id", state.foldersData[index].id);
    }
  });
}

export function updateSelectedFolder(state) {
  const folders = document.querySelectorAll(SELECTORS.folder);

  folders.forEach((folder) => {
    const folderId = folder.getAttribute("data-id");

    folder.removeAttribute("data-clicked");

    if (folderId === state.selectedFolderId) {
      folder.setAttribute("data-clicked", "true");
    }
  });
}

export function setupFolderClickHandlers(state, app) {
  const folders = document.querySelectorAll(SELECTORS.folder);

  folders.forEach((folder) => {
    folder.addEventListener("click", async (e) => {
      e.stopPropagation();
      await selectFolder(folder, state, app);
    });
  });
}

export async function selectFolder(folderElement, state, app) {
  const folderId = folderElement.getAttribute("data-id");

  if (!folderId) return;

  state.selectedFolderId = folderId;

  await app.saveSelectedFolder(folderId);
  updateSelectedFolder(state);

  if (typeof app.filterChatsByFolder === "function") {
    app.filterChatsByFolder(folderId);
  }
}

export function updateFoldersDisplay(state, app) {
  if (!state.isEnabled) return;

  const foldersDataEl = document.querySelector(SELECTORS.foldersRoot);
  if (!foldersDataEl) return;

  if (typeof window.foldersDataComponent !== "function") {
    console.error("[folders-ui] window.foldersDataComponent is not available");
    return;
  }

  const visibleFolders = state.foldersData.filter((folder) => !folder.hidden);

  foldersDataEl.innerHTML = window.foldersDataComponent(
    visibleFolders.map((folder) => ({
      ...folder,
      unreadCount:
        typeof app.getUnreadCountForFolder === "function"
          ? app.getUnreadCountForFolder(folder.id)
          : 0,
    })),
  );

  addAtributesForFolders({
    ...state,
    foldersData: visibleFolders,
  });

  setupFolderClickHandlers(state, app);
  updateSelectedFolder(state);

  if (typeof app.updateFolderBadges === "function") {
    setTimeout(() => app.updateFolderBadges(), 100);
  }
}

export function removeFolders(state) {
  const folders = document.querySelectorAll(SELECTORS.foldersRoot);
  let removed = false;

  folders.forEach((el) => {
    if (el.getAttribute("data-chat-folders") === "true") {
      el.remove();
      removed = true;
    }
  });

  if (removed) {
    state.foldersInjected = false;
  }
}

function renderFoldersIntoContainer(container, state, app) {
  if (!container) return false;

  const existingInContainer = container.querySelector(SELECTORS.foldersRoot);
  if (existingInContainer) {
    state.foldersInjected = true;
    return true;
  }

  if (typeof window.foldersDataComponent !== "function") {
    console.error("[folders-ui] window.foldersDataComponent is not available");
    return false;
  }

  const visibleFolders = state.foldersData.filter((folder) => !folder.hidden);

  const folders = document.createElement("div");
  folders.setAttribute("data-chat-folders", "true");
  folders.style.marginTop = "10px";
  folders.innerHTML = window.foldersDataComponent(visibleFolders);

  container.appendChild(folders);

  addAtributesForFolders({
    ...state,
    foldersData: visibleFolders,
  });

  setupFolderClickHandlers(state, app);
  updateSelectedFolder(state);

  state.foldersInjected = true;

  setTimeout(() => {
    if (typeof app.updateFolderBadges === "function") {
      app.updateFolderBadges();
    }

    if (typeof app.applySavedFolderQuick === "function") {
      app.applySavedFolderQuick();
    } else if (typeof app.filterChatsByFolder === "function") {
      app.filterChatsByFolder(state.selectedFolderId);
    }
  }, 100);

  console.log("[folders-ui] folders injected");
  return true;
}

export function injectFolders(state, app) {
  const existingFolders = document.querySelector(SELECTORS.foldersRoot);
  if (existingFolders) {
    state.foldersInjected = true;
    return;
  }

  removeFolders(state);

  const tryNow = () => {
    const container = document.querySelector(SELECTORS.header);
    if (!container) return false;
    return renderFoldersIntoContainer(container, state, app);
  };

  if (tryNow()) return;

  let attempts = 0;
  const maxAttempts = 30;

  const retryTimer = setInterval(() => {
    attempts += 1;

    if (state.foldersInjected) {
      clearInterval(retryTimer);
      return;
    }

    if (tryNow()) {
      clearInterval(retryTimer);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(retryTimer);
      console.warn("[folders-ui] header not found after retries");
    }
  }, 500);

  const observer = new MutationObserver(() => {
    if (state.foldersInjected) {
      observer.disconnect();
      return;
    }

    if (tryNow()) {
      clearInterval(retryTimer);
      observer.disconnect();
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
  }, 20000);
}
