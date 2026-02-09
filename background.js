chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    const defaultFolders = [
      { id: "all", name: "Все", chats: [], hidden: false },
      { id: "private", name: "Личные", chats: [], hidden: false },
      { id: "clients", name: "Клиенты", chats: [], hidden: false },
      { id: "others", name: "Другое", chats: [], hidden: false },
      { id: "archive", name: "Архив", chats: [], hidden: false },
      { id: "favorites", name: "Избранное", chats: [], hidden: false },
    ];

    chrome.storage.local.set({ folders_data: defaultFolders });
    chrome.storage.sync.set({ isEnabled: true });
  } else if (details.reason === "update") {
    chrome.storage.local.get(["folders_data"], (result) => {
      const existingFolders = result.folders_data || [];
      const updatedFolders = ensureSystemFolders(existingFolders);

      if (JSON.stringify(existingFolders) !== JSON.stringify(updatedFolders)) {
        chrome.storage.local.set({ folders_data: updatedFolders }, () => {
          console.log("Folders updated after extension update");
        });
      }
    });
  }
});

function ensureSystemFolders(existingFolders) {
  const systemFolders = [
    { id: "all", name: "Все", chats: [], hidden: false },
    { id: "private", name: "Личные", chats: [], hidden: false },
    { id: "clients", name: "Клиенты", chats: [], hidden: false },
    { id: "others", name: "Другое", chats: [], hidden: false },
    { id: "archive", name: "Архив", chats: [], hidden: false },
    { id: "favorites", name: "Избранное", chats: [], hidden: false },
  ];

  if (!existingFolders || existingFolders.length === 0) {
    return systemFolders;
  }

  const result = [...existingFolders];
  let hasChanges = false;

  systemFolders.forEach((systemFolder) => {
    const folderIndex = result.findIndex((f) => f.id === systemFolder.id);

    if (folderIndex === -1) {
      result.push({ ...systemFolder });
      hasChanges = true;
    } else {
      const existingFolder = result[folderIndex];
      if (existingFolder.hidden === undefined) {
        existingFolder.hidden = false;
        hasChanges = true;
      }
    }
  });

  const allFolderIndex = result.findIndex((f) => f.id === "all");
  if (allFolderIndex > 0) {
    const allFolder = result.splice(allFolderIndex, 1)[0];
    result.unshift(allFolder);
    hasChanges = true;
  }

  return hasChanges ? result : existingFolders;
}

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["folders_data"], (result) => {
    const existingFolders = result.folders_data || [];
    const updatedFolders = ensureSystemFolders(existingFolders);

    if (JSON.stringify(existingFolders) !== JSON.stringify(updatedFolders)) {
      chrome.storage.local.set({ folders_data: updatedFolders });
    }
  });
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

      chrome.storage.local.get(["selectedFolderId"], (result) => {
        if (result.selectedFolderId) {
          const folderExists = request.folders.some(
            (f) => f.id === result.selectedFolderId,
          );
          if (!folderExists) {
            chrome.storage.local.set({ selectedFolderId: "all" });
          }
        }
      });

      sendResponse({ success: true });
    });
    return true;
  }
});
