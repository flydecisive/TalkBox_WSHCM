import * as chatUtils from "./chat-utils.js";

export function addChatToFolder(state, app, chatInfo, folderId) {
  if (!chatInfo || !chatInfo.name) {
    return false;
  }

  const folder = state.foldersData.find((f) => f.id === folderId);
  if (!folder) return false;

  if (!folder.chats) folder.chats = [];

  const chatExists = folder.chats.some((chat) => chat.name === chatInfo.name);

  if (!chatExists) {
    folder.chats.push({
      name: chatInfo.name,
      addedAt: new Date().toISOString(),
      autoAdded: folderId === "clients",
    });

    app.saveFoldersData();

    if (state.selectedFolderId === folderId) {
      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder(folderId);
      }
    }

    return true;
  }

  return false;
}

export function autoAddClientChat(state, app, chatInfo) {
  if (!chatInfo || !chatInfo.name) return false;

  if (chatUtils.isClientChat(chatInfo.name)) {
    const clientsFolder = state.foldersData.find((f) => f.id === "clients");

    if (clientsFolder) {
      const alreadyAdded = clientsFolder.chats?.some(
        (chat) => chat.name === chatInfo.name,
      );

      if (!alreadyAdded) {
        const added = addChatToFolder(state, app, chatInfo, "clients");

        if (added) {
          if (state.selectedFolderId === "clients") {
            setTimeout(() => {
              if (typeof app.filterChatsByFolder === "function") {
                app.filterChatsByFolder("clients");
              }
            }, 100);
          }

          return true;
        }
      }
    }
  }

  return false;
}

export function removeChatFromFolder(state, app, chatInfo, folderId) {
  if (!chatInfo || !chatInfo.name) {
    return false;
  }

  const folder = state.foldersData.find((f) => f.id === folderId);
  if (!folder || !folder.chats) return false;

  const initialLength = folder.chats.length;
  folder.chats = folder.chats.filter((chat) => chat.name !== chatInfo.name);

  const removed = folder.chats.length < initialLength;

  if (removed) {
    app.saveFoldersData();

    if (state.selectedFolderId === folderId) {
      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder(folderId);
      }
    }
  }

  return removed;
}

export function isChatInFolder(state, chatInfo, folderId) {
  if (!chatInfo || !chatInfo.name) return false;

  const folder = state.foldersData.find((f) => f.id === folderId);
  if (!folder || !folder.chats) return false;

  return folder.chats.some((chat) => chat.name === chatInfo.name);
}
