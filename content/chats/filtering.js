import { SELECTORS } from "../selectors.js";
import * as chatUtils from "./chat-utils.js";
import * as folderActions from "./folder-actions.js";

export function showNoChatsMessage(state, folderName) {
  removeNoChatsMessage(state);

  const messageContainer = document.createElement("div");
  messageContainer.className = "ext-no-chats-message";
  messageContainer.innerHTML = `
    <div class="ext-no-chats-content">
      <h3>В папке "${folderName}" нет чатов</h3>
    </div>
  `;

  const chatsList = document.querySelector(SELECTORS.chatListRoot);
  if (chatsList && chatsList.parentNode) {
    chatsList.parentNode.insertBefore(messageContainer, chatsList.nextSibling);
  }

  state.noChatsMessage = messageContainer;
}

export function removeNoChatsMessage(state) {
  if (state.noChatsMessage && state.noChatsMessage.parentNode) {
    state.noChatsMessage.parentNode.removeChild(state.noChatsMessage);
    state.noChatsMessage = null;
    return;
  }

  const orphan = document.querySelector(SELECTORS.noChatsMessage);
  if (orphan && orphan.parentNode) {
    orphan.parentNode.removeChild(orphan);
  }
}

export function filterChatsByFolder(state, app, folderId) {
  const chatsContainer = document.querySelector(SELECTORS.chatListRoot);

  if (!chatsContainer) {
    setTimeout(() => {
      const retryContainer = document.querySelector(SELECTORS.chatListRoot);
      if (retryContainer) {
        filterChatsByFolder(state, app, folderId);
      }
    }, 20);
    return;
  }

  const existingHiddenChats =
    chatsContainer.querySelectorAll(".ext-hidden-chat");

  existingHiddenChats.forEach((chat) => {
    chat.classList.remove("ext-hidden-chat");
    chat.removeAttribute("data-ext-hidden");
  });

  const chatList = chatsContainer.querySelectorAll("li");
  const allChatNames = new Set();

  chatList.forEach((chat) => {
    const chatName = chatUtils.getChatName(chat);
    allChatNames.add(chatName);

    if (chatUtils.isClientChat(chatName)) {
      const chatInfo = {
        element: chat,
        name: chatName,
      };

      folderActions.autoAddClientChat(state, app, chatInfo);
    }
  });

  if (folderId === "all") {
    chatList.forEach((chat) => {
      chat.classList.remove("ext-hidden-chat");
      chat.removeAttribute("data-ext-hidden");
    });

    removeNoChatsMessage(state);
    return;
  }

  const folder = state.foldersData.find((f) => f.id === folderId);
  if (!folder) {
    return;
  }

  if (!folder.chats || folder.chats.length === 0) {
    chatList.forEach((chat) => {
      chat.classList.add("ext-hidden-chat");
      chat.setAttribute("data-ext-hidden", "true");
    });

    showNoChatsMessage(state, folder.name);
    return;
  }

  const chatNamesInFolder = new Set(folder.chats.map((chat) => chat.name));
  let visibleCount = 0;
  let existingChatsInFolder = 0;

  chatList.forEach((chat) => {
    const chatName = chatUtils.getChatName(chat);

    if (chatNamesInFolder.has(chatName)) {
      chat.classList.remove("ext-hidden-chat");
      chat.removeAttribute("data-ext-hidden");
      visibleCount++;
      existingChatsInFolder++;
    } else {
      chat.classList.add("ext-hidden-chat");
      chat.setAttribute("data-ext-hidden", "true");
    }
  });

  const totalChatsInFolder = folder.chats.length;

  if (existingChatsInFolder < totalChatsInFolder) {
    console.log(
      `Папка "${folder.name}": ${totalChatsInFolder - existingChatsInFolder} чатов отсутствуют на странице`,
    );
  }

  if (visibleCount > 0) {
    removeNoChatsMessage(state);
  } else {
    if (folder.chats.length > 0) {
      showNoChatsMessage(state, `${folder.name} (чаты отсутствуют на странице)`);
    } else {
      showNoChatsMessage(state, folder.name);
    }
  }
}