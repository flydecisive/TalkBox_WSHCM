import * as storage from "./storage.js";

export function setupRuntimeListeners(state, app) {
  if (state.runtimeMessageHandler) {
    chrome.runtime.onMessage.removeListener(state.runtimeMessageHandler);
  }

  state.runtimeMessageHandler = (request, sender, sendResponse) => {
    if (sender.id && sender.id !== chrome.runtime.id) {
      return false;
    }

    if (request.action === "stateChanged") {
      state.isEnabled = request.isEnabled;

      if (typeof app.applyState === "function") {
        app.applyState();
      }

      sendResponse?.({ received: true });
      return true;
    }

    if (request.action === "foldersChanged") {
      if (!storage.validateFoldersData(request.folders)) {
        sendResponse?.({ received: false });
        return true;
      }

      state.foldersData = request.folders;

      const stillValid = storage.isValidFolderId(
        state.selectedFolderId,
        state.foldersData,
      );

      if (!stillValid) {
        state.selectedFolderId = "all";

        if (typeof app.saveSelectedFolder === "function") {
          app.saveSelectedFolder("all");
        }
      }

      if (typeof app.updateFoldersDisplay === "function") {
        app.updateFoldersDisplay();
      }

      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder(state.selectedFolderId || "all");
      }

      if (typeof app.updateSelectedFolder === "function") {
        app.updateSelectedFolder();
      }

      if (typeof app.updateFolderBadges === "function") {
        app.updateFolderBadges();
      }

      sendResponse?.({ received: true });
      return true;
    }

    return false;
  };

  chrome.runtime.onMessage.addListener(state.runtimeMessageHandler);
}

export function removeRuntimeListeners(state) {
  if (state.runtimeMessageHandler) {
    chrome.runtime.onMessage.removeListener(state.runtimeMessageHandler);
    state.runtimeMessageHandler = null;
  }
}
