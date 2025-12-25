chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isEnabled: true });
});

chrome.storage.local.get(["folders_data"], (result) => {
  if (!result.folders_data || result.folders_data.length === 0) {
    const defaultFolders = [
      { id: "all", name: "Все", chats: [] },
      { id: "private", name: "Личные", chats: [] },
      { id: "clients", name: "Клиенты", chats: [] },
      { id: "others", name: "Другое", chats: [] },
    ];

    chrome.storage.local.set({ folders_data: defaultFolders });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getState") {
    chrome.storage.sync.get("isEnabled", (data) => {
      sendResponse({ isEnabled: data.isEnabled ?? true });
    });
    return true;
  }

  if (request.action === "setState") {
    chrome.storage.sync.set({ isEnabled: request.isEnabled }, () => {
      // Уведомляем все вкладки об изменении состояния
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "stateChanged",
              isEnabled: request.isEnabled,
            })
            .catch(() => {}); // Игнорируем ошибки для вкладок без content script
        });
      });

      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "getFolders") {
    chrome.storage.local.get(["folders_data"], (data) => {
      sendResponse({ folders: data.folders_data });
    });

    return true;
  }

  if (request.action === "updateFolders") {
    chrome.storage.local.set({ folders_data: request.folders }, () => {
      // Уведомляем все вкладки об изменении папок
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "foldersChanged",
              folders: request.folders,
            })
            .catch(() => {});
        });
      });

      sendResponse({ success: true });
    });
    return true;
  }
});
