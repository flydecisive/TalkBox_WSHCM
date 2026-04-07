const DEFAULT_FOLDERS = [
  { id: "all", name: "Все", chats: [], hidden: false },
  { id: "private", name: "Личные", chats: [], hidden: false },
  { id: "clients", name: "Клиенты", chats: [], hidden: false },
  { id: "others", name: "Другое", chats: [], hidden: false },
  { id: "archive", name: "Архив", chats: [], hidden: false },
  { id: "favorites", name: "Избранное", chats: [], hidden: false },
];

export function getDefaultFolders() {
  return structuredClone(DEFAULT_FOLDERS);
}

export async function getEnabledState() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getState" }, (response) => {
      resolve(response?.isEnabled ?? true);
    });
  });
}

export async function getFoldersData() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "getFolders" }, (response) => {
      if (!response?.folders || response.folders.length === 0) {
        const defaultFolders = getDefaultFolders();

        chrome.runtime.sendMessage(
          {
            action: "updateFolders",
            folders: defaultFolders,
          },
          () => resolve(defaultFolders),
        );
        return;
      }

      resolve(response.folders);
    });
  });
}

export async function saveFoldersData(foldersData) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: "updateFolders",
        folders: foldersData,
      },
      (response) => resolve(response),
    );
  });
}

export async function loadSelectedFolder() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["selected_folder_id"], (result) => {
      resolve(result?.selected_folder_id ?? "all");
    });
  });
}

export async function saveSelectedFolder(folderId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ selected_folder_id: folderId }, () => {
      resolve(true);
    });
  });
}

export function validateFoldersData(folders) {
  if (!Array.isArray(folders)) return false;

  return folders.every((folder) => {
    return (
      typeof folder?.id === "string" &&
      typeof folder?.name === "string" &&
      (Array.isArray(folder?.chats) || folder?.chats === undefined)
    );
  });
}

export function isValidFolderId(folderId, foldersData) {
  return foldersData.some((folder) => folder.id === folderId);
}
