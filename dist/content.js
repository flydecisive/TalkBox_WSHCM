(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // content/state.js
  function createState() {
    return {
      isEnabled: true,
      foldersData: [],
      selectedFolderId: "all",
      lastRightClickedChat: null,
      preparedMenu: null,
      rightClickHandler: null,
      chatClickHandler: null,
      outsideClickHandler: null,
      handleExtMenuItemClick: null,
      runtimeMessageHandler: null,
      chatListObserver: null,
      spaObserver: null,
      periodUpdateInterval: null,
      foldersInjected: false,
      updateBadgesTimeout: null,
      lastUserActivity: Date.now(),
      noChatsMessage: null,
      orphanMissCounts: /* @__PURE__ */ new Map()
    };
  }
  var init_state = __esm({
    "content/state.js"() {
    }
  });

  // content/storage.js
  function getDefaultFolders() {
    return structuredClone(DEFAULT_FOLDERS);
  }
  async function getEnabledState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getState" }, (response) => {
        resolve(response?.isEnabled ?? true);
      });
    });
  }
  async function getFoldersData() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getFolders" }, (response) => {
        if (!response?.folders || response.folders.length === 0) {
          const defaultFolders = getDefaultFolders();
          chrome.runtime.sendMessage(
            {
              action: "updateFolders",
              folders: defaultFolders
            },
            () => resolve(defaultFolders)
          );
          return;
        }
        resolve(response.folders);
      });
    });
  }
  async function saveFoldersData(foldersData) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "updateFolders",
          folders: foldersData
        },
        (response) => resolve(response)
      );
    });
  }
  async function loadSelectedFolder() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["selected_folder_id"], (result) => {
        resolve(result?.selected_folder_id ?? "all");
      });
    });
  }
  async function saveSelectedFolder(folderId) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ selected_folder_id: folderId }, () => {
        resolve(true);
      });
    });
  }
  function validateFoldersData(folders) {
    if (!Array.isArray(folders)) return false;
    return folders.every((folder) => {
      return typeof folder?.id === "string" && typeof folder?.name === "string" && (Array.isArray(folder?.chats) || folder?.chats === void 0);
    });
  }
  function isValidFolderId(folderId, foldersData) {
    return foldersData.some((folder) => folder.id === folderId);
  }
  var DEFAULT_FOLDERS;
  var init_storage = __esm({
    "content/storage.js"() {
      DEFAULT_FOLDERS = [
        { id: "all", name: "\u0412\u0441\u0435", chats: [], hidden: false },
        { id: "private", name: "\u041B\u0438\u0447\u043D\u044B\u0435", chats: [], hidden: false },
        { id: "clients", name: "\u041A\u043B\u0438\u0435\u043D\u0442\u044B", chats: [], hidden: false },
        { id: "others", name: "\u0414\u0440\u0443\u0433\u043E\u0435", chats: [], hidden: false },
        { id: "archive", name: "\u0410\u0440\u0445\u0438\u0432", chats: [], hidden: false },
        { id: "favorites", name: "\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435", chats: [], hidden: false }
      ];
    }
  });

  // content/selectors.js
  var SELECTORS;
  var init_selectors = __esm({
    "content/selectors.js"() {
      SELECTORS = {
        header: ".ws-conversations-header",
        chatListRoot: "#cnvs_root .ws-conversations-list--root",
        chatItem: ".ws-conversations-list-item",
        chatItemListElement: "#cnvs_root .ws-conversations-list--root li",
        chatItemName: ".ws-conversations-list-item--info--name",
        chatBadge: ".ws-conversations-list-item .ws-conversations-list-item--badge",
        visibleChatBadge: ".ws-conversations-list-item .ws-conversations-list-item--badge:not([style*='display: none']), .ws-conversations-list-item .ws-conversations-list-item--badge:not([hidden])",
        siteContextMenuRoot: "#cnv_context_menu",
        siteContextMenuList: ".p-contextmenu-root-list",
        foldersRoot: "[data-chat-folders]",
        extMenuItem: '[data-ext-menu="true"]',
        extContextMenu: ".context_menu",
        folder: ".folder",
        noChatsMessage: ".ext-no-chats-message",
        stylesId: "#chat-extension-styles"
      };
    }
  });

  // content/ui/folders-ui.js
  async function loadCSS() {
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
  function getAllFolders() {
    return document.querySelectorAll(SELECTORS.folder);
  }
  function addAtributesForFolders(state) {
    const folders = getAllFolders();
    folders.forEach((folder, index) => {
      if (state.foldersData[index]) {
        folder.setAttribute("data-id", state.foldersData[index].id);
      }
    });
  }
  function updateSelectedFolder(state) {
    const folders = document.querySelectorAll(SELECTORS.folder);
    folders.forEach((folder) => {
      const folderId = folder.getAttribute("data-id");
      folder.removeAttribute("data-clicked");
      if (folderId === state.selectedFolderId) {
        folder.setAttribute("data-clicked", "true");
      }
    });
  }
  function setupFolderClickHandlers(state, app) {
    const folders = document.querySelectorAll(SELECTORS.folder);
    folders.forEach((folder) => {
      folder.addEventListener("click", async (e) => {
        e.stopPropagation();
        await selectFolder(folder, state, app);
      });
    });
  }
  async function selectFolder(folderElement, state, app) {
    const folderId = folderElement.getAttribute("data-id");
    if (!folderId) return;
    state.selectedFolderId = folderId;
    await app.saveSelectedFolder(folderId);
    updateSelectedFolder(state);
    if (typeof app.filterChatsByFolder === "function") {
      app.filterChatsByFolder(folderId);
    }
  }
  function updateFoldersDisplay(state, app) {
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
        unreadCount: typeof app.getUnreadCountForFolder === "function" ? app.getUnreadCountForFolder(folder.id) : 0
      }))
    );
    addAtributesForFolders({
      ...state,
      foldersData: visibleFolders
    });
    setupFolderClickHandlers(state, app);
    updateSelectedFolder(state);
    if (typeof app.updateFolderBadges === "function") {
      setTimeout(() => app.updateFolderBadges(), 100);
    }
  }
  function removeFolders(state) {
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
      foldersData: visibleFolders
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
  function injectFolders(state, app) {
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
        subtree: true
      });
    }
    setTimeout(() => {
      observer.disconnect();
    }, 2e4);
  }
  var init_folders_ui = __esm({
    "content/ui/folders-ui.js"() {
      init_selectors();
    }
  });

  // content/chats/chat-utils.js
  function getSelectedChat(state) {
    if (state.lastRightClickedChat) {
      return state.lastRightClickedChat;
    }
    return null;
  }
  function getChatName(chatElem) {
    const chatName = chatElem.querySelector(SELECTORS.chatItemName);
    if (chatName) {
      return chatName.textContent.trim().replace(/[<>]/g, "").substring(0, 100);
    }
    return "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
  }
  function isClientChat(chatName) {
    if (!chatName || typeof chatName !== "string") return false;
    const clientPattern = /^\d{6}\s+.+/;
    const sixDigitPattern = /\b\d{6}\b/;
    return clientPattern.test(chatName) || sixDigitPattern.test(chatName);
  }
  function isUserActive(state) {
    const now = Date.now();
    return now - state.lastUserActivity < 5e3;
  }
  var init_chat_utils = __esm({
    "content/chats/chat-utils.js"() {
      init_selectors();
    }
  });

  // content/chats/folder-actions.js
  function addChatToFolder(state, app, chatInfo, folderId) {
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
        addedAt: (/* @__PURE__ */ new Date()).toISOString(),
        autoAdded: folderId === "clients"
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
  function autoAddClientChat(state, app, chatInfo) {
    if (!chatInfo || !chatInfo.name) return false;
    if (isClientChat(chatInfo.name)) {
      const clientsFolder = state.foldersData.find((f) => f.id === "clients");
      if (clientsFolder) {
        const alreadyAdded = clientsFolder.chats?.some(
          (chat) => chat.name === chatInfo.name
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
  function removeChatFromFolder(state, app, chatInfo, folderId) {
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
  function isChatInFolder(state, chatInfo, folderId) {
    if (!chatInfo || !chatInfo.name) return false;
    const folder = state.foldersData.find((f) => f.id === folderId);
    if (!folder || !folder.chats) return false;
    return folder.chats.some((chat) => chat.name === chatInfo.name);
  }
  var init_folder_actions = __esm({
    "content/chats/folder-actions.js"() {
      init_chat_utils();
    }
  });

  // content/chats/filtering.js
  function showNoChatsMessage(state, folderName) {
    removeNoChatsMessage(state);
    const messageContainer = document.createElement("div");
    messageContainer.className = "ext-no-chats-message";
    messageContainer.innerHTML = `
    <div class="ext-no-chats-content">
      <h3>\u0412 \u043F\u0430\u043F\u043A\u0435 "${folderName}" \u043D\u0435\u0442 \u0447\u0430\u0442\u043E\u0432</h3>
    </div>
  `;
    const chatsList = document.querySelector(SELECTORS.chatListRoot);
    if (chatsList && chatsList.parentNode) {
      chatsList.parentNode.insertBefore(messageContainer, chatsList.nextSibling);
    }
    state.noChatsMessage = messageContainer;
  }
  function removeNoChatsMessage(state) {
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
  function filterChatsByFolder(state, app, folderId) {
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
    const existingHiddenChats = chatsContainer.querySelectorAll(".ext-hidden-chat");
    existingHiddenChats.forEach((chat) => {
      chat.classList.remove("ext-hidden-chat");
      chat.removeAttribute("data-ext-hidden");
    });
    const chatList = chatsContainer.querySelectorAll("li");
    const allChatNames = /* @__PURE__ */ new Set();
    chatList.forEach((chat) => {
      const chatName = getChatName(chat);
      allChatNames.add(chatName);
      if (isClientChat(chatName)) {
        const chatInfo = {
          element: chat,
          name: chatName
        };
        autoAddClientChat(state, app, chatInfo);
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
      const chatName = getChatName(chat);
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
        `\u041F\u0430\u043F\u043A\u0430 "${folder.name}": ${totalChatsInFolder - existingChatsInFolder} \u0447\u0430\u0442\u043E\u0432 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435`
      );
    }
    if (visibleCount > 0) {
      removeNoChatsMessage(state);
    } else {
      if (folder.chats.length > 0) {
        showNoChatsMessage(state, `${folder.name} (\u0447\u0430\u0442\u044B \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435)`);
      } else {
        showNoChatsMessage(state, folder.name);
      }
    }
  }
  var init_filtering = __esm({
    "content/chats/filtering.js"() {
      init_selectors();
      init_chat_utils();
      init_folder_actions();
    }
  });

  // content/restore.js
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
  function applySavedFolderQuick(state, app) {
    if (!state.isEnabled) return;
    const apply = () => {
      if (!hasRenderedFolders()) return false;
      const folderId = state.selectedFolderId || "all";
      const folderElement = document.querySelector(
        `.folder[data-id="${folderId}"]`
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
        subtree: true
      });
    }
    setTimeout(() => {
      observer.disconnect();
    }, 15e3);
  }
  var init_restore = __esm({
    "content/restore.js"() {
      init_selectors();
    }
  });

  // content/observers/chat-list-observer.js
  function getChatListRoot() {
    return document.querySelector(SELECTORS.chatListRoot);
  }
  function removeChatListObserver(state) {
    if (state.chatListObserver) {
      state.chatListObserver.disconnect();
      state.chatListObserver = null;
    }
  }
  function setupChatListObserver(state, app) {
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
        subtree: true
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
  var init_chat_list_observer = __esm({
    "content/observers/chat-list-observer.js"() {
      init_selectors();
    }
  });

  // content/ui/notifications.js
  function showNotification(message) {
    const existing = document.querySelector(".ext-hotification");
    if (existing) {
      existing.remove();
    }
    const notification = document.createElement("div");
    notification.className = "ext-hotification";
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.classList.add("show");
    }, 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2e3);
  }
  var init_notifications = __esm({
    "content/ui/notifications.js"() {
    }
  });

  // content/ui/context-menu.js
  function getExtMenuItem() {
    return document.querySelector(SELECTORS.extMenuItem);
  }
  function getExtContextMenu() {
    return document.querySelector(SELECTORS.extContextMenu);
  }
  function removeContextMenuItem() {
    const menuItem = getExtMenuItem();
    if (menuItem) {
      menuItem.remove();
    }
  }
  function removeExtContextMenu(state) {
    const menu = getExtContextMenu();
    if (menu) {
      if (state.outsideClickHandler) {
        document.removeEventListener("click", state.outsideClickHandler, true);
        state.outsideClickHandler = null;
      }
      if (state.handleExtMenuItemClick && state.preparedMenu) {
        const menuItems = state.preparedMenu.querySelectorAll(".context_menu__item");
        menuItems.forEach((item) => {
          item.removeEventListener("click", state.handleExtMenuItemClick);
        });
      }
      if (state.preparedMenu) {
        state.preparedMenu.style.display = "none";
      }
    }
  }
  function closeSiteContextMenu() {
    document.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true
      })
    );
  }
  function closeAllMenus(state) {
    removeExtContextMenu(state);
    removeContextMenuItem();
    closeSiteContextMenu();
  }
  function handleOutsideClick(state, e) {
    const contextMenu = getExtContextMenu();
    const extMenuItem = getExtMenuItem();
    if (contextMenu && !contextMenu.contains(e.target) && extMenuItem && !extMenuItem.contains(e.target)) {
      closeAllMenus(state);
    }
  }
  function injectContextMenuItem(state, app) {
    const rootContainer = document.querySelector(SELECTORS.siteContextMenuRoot);
    if (!rootContainer) {
      setTimeout(() => injectContextMenuItem(state, app), 100);
      return;
    }
    const container = rootContainer.querySelector(SELECTORS.siteContextMenuList);
    if (!container) {
      setTimeout(() => injectContextMenuItem(state, app), 100);
      return;
    }
    if (!container.querySelector(SELECTORS.extMenuItem)) {
      const oldMenuItem = container.querySelector(SELECTORS.extMenuItem);
      if (oldMenuItem) {
        oldMenuItem.remove();
      }
      if (typeof window.contextMenuComponent !== "function") {
        console.error("[context-menu] window.contextMenuComponent is not available");
        return;
      }
      const menuItemHTML = window.contextMenuComponent();
      container.insertAdjacentHTML("beforeend", menuItemHTML);
      prepareExtContextMenu(state, app);
      addMenuItemListener(state, app);
    }
  }
  function addMenuItemListener(state, app) {
    const menuItem = getExtMenuItem();
    if (!menuItem) return;
    menuItem.addEventListener("mouseenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const allMenuItems = document.querySelectorAll(".p-menuitem");
      allMenuItems.forEach((item) => {
        item.classList?.remove("p-focus");
      });
      menuItem.classList?.add("p-focus");
      injectExtContextMenu(state, app);
    });
    menuItem.addEventListener("mouseleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setTimeout(() => {
        const currentMenuItem = getExtMenuItem();
        const contextMenu = getExtContextMenu();
        if (currentMenuItem && !currentMenuItem.matches(":hover") && contextMenu && !contextMenu.matches(":hover")) {
          removeExtContextMenu(state);
          currentMenuItem.classList?.remove("p-focus");
        }
      }, 150);
    });
  }
  function prepareExtContextMenu(state, app) {
    const existingMenu = getExtContextMenu();
    if (existingMenu) {
      existingMenu.remove();
    }
    const chatInfo = typeof app.getSelectedChat === "function" ? app.getSelectedChat() : null;
    const visibleFolders = state.foldersData.slice(1).filter((folder) => !folder.hidden);
    if (typeof window.extContextMenuComponent !== "function") {
      console.error("[context-menu] window.extContextMenuComponent is not available");
      return;
    }
    const menuHTML = window.extContextMenuComponent(
      visibleFolders,
      chatInfo,
      state.foldersData
    );
    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    tempDiv.innerHTML = menuHTML;
    document.body.appendChild(tempDiv);
    const menu = tempDiv.firstElementChild;
    if (!menu) {
      tempDiv.remove();
      return;
    }
    menu.style.display = "none";
    state.preparedMenu = menu;
    setupExtContextMenuListeners(state, app, menu);
  }
  function injectExtContextMenu(state, app) {
    const container = document.body.querySelector(SELECTORS.extMenuItem);
    if (!container || !state.preparedMenu) {
      return;
    }
    state.preparedMenu.style.display = "block";
    if (state.preparedMenu.parentNode !== container) {
      if (state.preparedMenu.parentNode) {
        state.preparedMenu.parentNode.removeChild(state.preparedMenu);
      }
      container.appendChild(state.preparedMenu);
    }
    setTimeout(() => {
      if (state.outsideClickHandler) {
        document.removeEventListener("click", state.outsideClickHandler, true);
      }
      state.outsideClickHandler = (e) => handleOutsideClick(state, e);
      document.addEventListener("click", state.outsideClickHandler, true);
    }, 10);
  }
  function updateContextMenuAfterAction(state, app) {
    prepareExtContextMenu(state, app);
    const container = getExtMenuItem();
    if (container && state.preparedMenu) {
      const oldMenu = container.querySelector(SELECTORS.extContextMenu);
      if (oldMenu) {
        oldMenu.remove();
      }
      state.preparedMenu.style.display = "block";
      if (state.preparedMenu.parentNode !== container) {
        if (state.preparedMenu.parentNode) {
          state.preparedMenu.parentNode.removeChild(state.preparedMenu);
        }
        container.appendChild(state.preparedMenu);
      }
    }
  }
  function handleMenuItemClick(state, app, e) {
    e.preventDefault();
    e.stopPropagation();
    const menuItem = e.currentTarget;
    const folderId = menuItem.getAttribute("data-folder-id");
    const action = menuItem.getAttribute("data-action");
    const chatInfo = typeof app.getSelectedChat === "function" ? app.getSelectedChat() : null;
    if (chatInfo) {
      let success = false;
      let message = "";
      if (action === "add") {
        success = typeof app.addChatToFolder === "function" ? app.addChatToFolder(chatInfo, folderId) : false;
        message = "\u0427\u0430\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0432 \u043F\u0430\u043F\u043A\u0443";
      } else if (action === "remove") {
        success = typeof app.removeChatFromFolder === "function" ? app.removeChatFromFolder(chatInfo, folderId) : false;
        message = "\u0427\u0430\u0442 \u0443\u0434\u0430\u043B\u0435\u043D \u0438\u0437 \u043F\u0430\u043F\u043A\u0438";
      }
      if (success) {
        showNotification(message);
        if (typeof app.updateFoldersDisplay === "function") {
          app.updateFoldersDisplay();
        }
        updateContextMenuAfterAction(state, app);
      }
    }
    closeAllMenus(state);
  }
  function setupExtContextMenuListeners(state, app, menu = state.preparedMenu) {
    if (!menu) return;
    menu.addEventListener("mouseenter", () => {
    });
    menu.addEventListener("mouseleave", () => {
      setTimeout(() => {
        const menuItem = getExtMenuItem();
        const contextMenu = getExtContextMenu();
        if (menuItem && !menuItem.matches(":hover") && contextMenu && !contextMenu.matches(":hover")) {
          removeExtContextMenu(state);
          menuItem.classList?.remove("p-focus");
        }
      }, 150);
    });
    const menuItems = menu.querySelectorAll(".context_menu__item");
    if (!state.handleExtMenuItemClick) {
      state.handleExtMenuItemClick = (e) => handleMenuItemClick(state, app, e);
    }
    menuItems.forEach((menuItem) => {
      menuItem.removeEventListener("click", state.handleExtMenuItemClick);
      menuItem.addEventListener("click", state.handleExtMenuItemClick);
    });
  }
  function setupRightClickHandler(state, app) {
    state.rightClickHandler = (e) => {
      const chatItem = e.target.closest(SELECTORS.chatItem);
      if (chatItem) {
        state.lastRightClickedChat = {
          element: chatItem,
          name: typeof app.getChatName === "function" ? app.getChatName(chatItem) : "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F"
        };
        prepareExtContextMenu(state, app);
      } else {
        state.lastRightClickedChat = null;
      }
      setTimeout(() => {
        injectContextMenuItem(state, app);
      }, 100);
    };
    document.addEventListener("contextmenu", state.rightClickHandler, true);
    state.chatClickHandler = (e) => {
      const chatItem = e.target.closest(SELECTORS.chatItem);
      if (chatItem) {
        setTimeout(() => {
          if (typeof app.updateFolderBadges === "function") {
            app.updateFolderBadges();
          }
        }, 100);
      }
    };
    document.addEventListener("click", state.chatClickHandler, true);
  }
  function removeRightClickHandler(state) {
    if (state.rightClickHandler) {
      document.removeEventListener("contextmenu", state.rightClickHandler, true);
      state.rightClickHandler = null;
    }
    if (state.chatClickHandler) {
      document.removeEventListener("click", state.chatClickHandler, true);
      state.chatClickHandler = null;
    }
    if (state.outsideClickHandler) {
      document.removeEventListener("click", state.outsideClickHandler, true);
      state.outsideClickHandler = null;
    }
  }
  var init_context_menu = __esm({
    "content/ui/context-menu.js"() {
      init_selectors();
      init_notifications();
    }
  });

  // content/chats/badges.js
  function getFolderElements() {
    return document.querySelectorAll(SELECTORS.folder);
  }
  function getAllBadgeElements() {
    return document.querySelectorAll(SELECTORS.chatBadge);
  }
  function getVisibleBadgeElements() {
    return document.querySelectorAll(SELECTORS.visibleChatBadge);
  }
  function getTotalUnreadCount() {
    const allBadges = getAllBadgeElements();
    let count = 0;
    allBadges.forEach((badge) => {
      if (badge && badge.offsetParent !== null && badge.style.display !== "none" && !badge.hidden) {
        count += 1;
      }
    });
    return count;
  }
  function getUnreadCountForSpecificFolder(state, app, folder) {
    if (!folder || !folder.chats || folder.chats.length === 0) return 0;
    const allChatsWithBadges = getVisibleBadgeElements();
    if (allChatsWithBadges.length === 0) return 0;
    const chatsWithBadgesMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < allChatsWithBadges.length; i++) {
      const badge = allChatsWithBadges[i];
      if (badge.offsetParent !== null && badge.style.display !== "none" && !badge.hidden) {
        const chatElement = badge.closest(SELECTORS.chatItem);
        if (chatElement) {
          const chatName = typeof app.getChatName === "function" ? app.getChatName(chatElement) : null;
          if (chatName) {
            chatsWithBadgesMap.set(chatName, true);
          }
        }
      }
    }
    let unreadCount = 0;
    for (let i = 0; i < folder.chats.length; i++) {
      if (chatsWithBadgesMap.has(folder.chats[i].name)) {
        unreadCount += 1;
      }
    }
    return unreadCount;
  }
  function getUnreadCountForFolder(state, app, folderId) {
    if (folderId === "all") {
      return getTotalUnreadCount();
    }
    const folder = state.foldersData.find((f) => f.id === folderId);
    if (!folder || folder.hidden) return 0;
    return getUnreadCountForSpecificFolder(state, app, folder);
  }
  function updateFolderBadges(state, app) {
    if (state.updateBadgesTimeout) {
      clearTimeout(state.updateBadgesTimeout);
    }
    state.updateBadgesTimeout = setTimeout(() => {
      const folders = getFolderElements();
      if (folders.length === 0) {
        state.updateBadgesTimeout = null;
        return;
      }
      folders.forEach((folderEl) => {
        const folderId = folderEl.getAttribute("data-id");
        if (!folderId) return;
        const unreadCount = typeof app.getUnreadCountForFolder === "function" ? app.getUnreadCountForFolder(folderId) : 0;
        let badgeEl = folderEl.querySelector(".folder__badge");
        if (unreadCount <= 0) {
          if (badgeEl) {
            badgeEl.remove();
          }
          return;
        }
        const badgeText = unreadCount > 9 ? "9+" : unreadCount.toString();
        if (!badgeEl) {
          badgeEl = document.createElement("div");
          badgeEl.className = "folder__badge";
          folderEl.insertAdjacentElement("afterbegin", badgeEl);
        }
        badgeEl.textContent = badgeText;
      });
      state.updateBadgesTimeout = null;
    }, 50);
  }
  function waitForDOMAndUpdateBadges(state, app) {
    let attempts = 0;
    const maxAttempts = 30;
    const tryUpdate = () => {
      attempts += 1;
      const foldersExist = document.querySelectorAll(SELECTORS.folder).length > 0;
      const chatListExists = !!document.querySelector(SELECTORS.chatListRoot);
      if (foldersExist && chatListExists) {
        updateFolderBadges(state, app);
        return true;
      }
      if (attempts >= maxAttempts) {
        return true;
      }
      return false;
    };
    if (tryUpdate()) return;
    const timer = setInterval(() => {
      if (tryUpdate()) {
        clearInterval(timer);
      }
    }, 250);
  }
  var init_badges = __esm({
    "content/chats/badges.js"() {
      init_selectors();
    }
  });

  // content/runtime-listeners.js
  function setupRuntimeListeners(state, app) {
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
        if (!validateFoldersData(request.folders)) {
          sendResponse?.({ received: false });
          return true;
        }
        state.foldersData = request.folders;
        const stillValid = isValidFolderId(
          state.selectedFolderId,
          state.foldersData
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
  function removeRuntimeListeners(state) {
    if (state.runtimeMessageHandler) {
      chrome.runtime.onMessage.removeListener(state.runtimeMessageHandler);
      state.runtimeMessageHandler = null;
    }
  }
  var init_runtime_listeners = __esm({
    "content/runtime-listeners.js"() {
      init_storage();
    }
  });

  // content/observers/spa-watchdog.js
  function hasFoldersInDOM() {
    return !!document.querySelector(SELECTORS.foldersRoot);
  }
  function hasHeader() {
    return !!document.querySelector(SELECTORS.header);
  }
  function hasChatListRoot() {
    return !!document.querySelector(SELECTORS.chatListRoot);
  }
  function setupSPAWatchdog(state, app) {
    removeSPAWatchdog(state);
    state.periodUpdateInterval = setInterval(() => {
      if (!state.isEnabled) return;
      const headerExists = hasHeader();
      const foldersExist = hasFoldersInDOM();
      const chatListExists = hasChatListRoot();
      if (!headerExists) return;
      if (!foldersExist) {
        console.warn("[spa-watchdog] folders missing, restoring UI");
        if (typeof app.reinitializeUI === "function") {
          app.reinitializeUI();
        }
        return;
      }
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
      }
    }, 3e3);
  }
  function removeSPAWatchdog(state) {
    if (state.periodUpdateInterval) {
      clearInterval(state.periodUpdateInterval);
      state.periodUpdateInterval = null;
    }
  }
  function setupSPAObserver(state, app) {
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
      }
    });
    if (document.body) {
      state.spaObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }
  function removeSPAObserver(state) {
    if (state.spaObserver) {
      state.spaObserver.disconnect();
      state.spaObserver = null;
    }
  }
  var init_spa_watchdog = __esm({
    "content/observers/spa-watchdog.js"() {
      init_selectors();
    }
  });

  // content/chats/cleanup.js
  function makeChatKey(folderId, chatName) {
    return `${folderId}::${chatName}`;
  }
  function hasStableChatList() {
    const root = document.querySelector(SELECTORS.chatListRoot);
    if (!root) return false;
    const items = root.querySelectorAll("li");
    return items.length > 0;
  }
  function cleanupOrphanedChatsSoft(state, app) {
    if (!state.isEnabled) {
      return { removed: 0, foldersChanged: 0 };
    }
    if (!hasStableChatList()) {
      return { removed: 0, foldersChanged: 0 };
    }
    if (typeof app.isUserActive === "function" && app.isUserActive()) {
      return { removed: 0, foldersChanged: 0 };
    }
    const allChatElements = document.querySelectorAll(SELECTORS.chatItem);
    const existingChatNames = /* @__PURE__ */ new Set();
    allChatElements.forEach((chatElement) => {
      const chatName = typeof app.getChatName === "function" ? app.getChatName(chatElement) : null;
      if (chatName) {
        existingChatNames.add(chatName);
      }
    });
    let removed = 0;
    let foldersChanged = 0;
    const nextFolders = state.foldersData.map((folder) => {
      if (folder.id === "all") {
        return folder;
      }
      if (!Array.isArray(folder.chats) || folder.chats.length === 0) {
        return folder;
      }
      let changed = false;
      const nextChats = folder.chats.filter((chat) => {
        const key = makeChatKey(folder.id, chat.name);
        if (existingChatNames.has(chat.name)) {
          state.orphanMissCounts.delete(key);
          return true;
        }
        const nextMissCount = (state.orphanMissCounts.get(key) || 0) + 1;
        state.orphanMissCounts.set(key, nextMissCount);
        if (nextMissCount >= MISS_THRESHOLD) {
          removed += 1;
          changed = true;
          state.orphanMissCounts.delete(key);
          return false;
        }
        return true;
      });
      if (changed) {
        foldersChanged += 1;
        return {
          ...folder,
          chats: nextChats
        };
      }
      return folder;
    });
    if (removed > 0) {
      state.foldersData = nextFolders;
      if (typeof app.saveFoldersData === "function") {
        app.saveFoldersData();
      }
      if (typeof app.updateFoldersDisplay === "function") {
        app.updateFoldersDisplay();
      }
      if (typeof app.filterChatsByFolder === "function") {
        app.filterChatsByFolder(state.selectedFolderId || "all");
      }
      if (typeof app.updateFolderBadges === "function") {
        app.updateFolderBadges();
      }
      console.log(
        `[cleanup] removed ${removed} chats from ${foldersChanged} folders`
      );
    }
    return { removed, foldersChanged };
  }
  function resetOrphanTracking(state) {
    if (state.orphanMissCounts) {
      state.orphanMissCounts.clear();
    }
  }
  var MISS_THRESHOLD;
  var init_cleanup = __esm({
    "content/chats/cleanup.js"() {
      init_selectors();
      MISS_THRESHOLD = 5;
    }
  });

  // content/app.js
  var ChatsApp;
  var init_app = __esm({
    "content/app.js"() {
      init_state();
      init_storage();
      init_folders_ui();
      init_chat_utils();
      init_folder_actions();
      init_filtering();
      init_restore();
      init_chat_list_observer();
      init_context_menu();
      init_badges();
      init_runtime_listeners();
      init_spa_watchdog();
      init_cleanup();
      ChatsApp = class {
        constructor() {
          this.state = createState();
          this.initUserActivityTracking();
        }
        initUserActivityTracking() {
          const updateActivity = () => {
            this.state.lastUserActivity = Date.now();
          };
          document.addEventListener("mousemove", updateActivity);
          document.addEventListener("click", updateActivity);
          document.addEventListener("keydown", updateActivity);
        }
        async init() {
          try {
            await loadCSS();
            this.state.isEnabled = await getEnabledState();
            this.state.foldersData = await getFoldersData();
            const savedFolderId = await loadSelectedFolder();
            this.state.selectedFolderId = isValidFolderId(
              savedFolderId,
              this.state.foldersData
            ) ? savedFolderId : "all";
            this.setupRuntimeListeners();
            this.applyState();
            console.log("[ChatsApp] initialized", {
              isEnabled: this.state.isEnabled,
              foldersCount: this.state.foldersData.length,
              selectedFolderId: this.state.selectedFolderId
            });
          } catch (error) {
            console.error("[ChatsApp] init error:", error);
          }
        }
        applyState() {
          if (this.state.isEnabled) {
            this.injectFolders();
            setTimeout(() => {
              this.applySavedFolderQuick();
              this.setupChatListObserver();
              this.setupRightClickHandler();
              this.waitForDOMAndUpdateBadges();
              this.setupSPAObserver();
              this.setupSPAWatchdog();
            }, 150);
          } else {
            this.cleanup();
          }
        }
        cleanup() {
          this.removeChatListObserver();
          this.removeRightClickHandler();
          this.removeExtContextMenu();
          this.removeContextMenuItem();
          this.removeNoChatsMessage();
          this.removeFolders();
          this.removeSPAObserver();
          this.removeSPAWatchdog();
          this.state.foldersInjected = false;
          this.resetOrphanTracking();
          if (this.state.updateBadgesTimeout) {
            clearTimeout(this.state.updateBadgesTimeout);
            this.state.updateBadgesTimeout = null;
          }
        }
        setupRuntimeListeners() {
          setupRuntimeListeners(this.state, this);
        }
        removeRuntimeListeners() {
          removeRuntimeListeners(this.state);
        }
        async saveSelectedFolder(folderId) {
          this.state.selectedFolderId = folderId;
          await saveSelectedFolder(folderId);
        }
        async saveFoldersData() {
          return saveFoldersData(this.state.foldersData);
        }
        validateFoldersData(folders) {
          return validateFoldersData(folders);
        }
        removeFolders() {
          removeFolders(this.state);
        }
        injectFolders() {
          injectFolders(this.state, this);
        }
        updateFoldersDisplay() {
          updateFoldersDisplay(this.state, this);
        }
        updateSelectedFolder() {
          updateSelectedFolder(this.state);
        }
        applySavedFolderQuick() {
          applySavedFolderQuick(this.state, this);
        }
        setupChatListObserver() {
          setupChatListObserver(this.state, this);
        }
        removeChatListObserver() {
          removeChatListObserver(this.state);
        }
        setupRightClickHandler() {
          setupRightClickHandler(this.state, this);
        }
        removeRightClickHandler() {
          removeRightClickHandler(this.state);
        }
        removeContextMenuItem() {
          removeContextMenuItem();
        }
        removeExtContextMenu() {
          removeExtContextMenu(this.state);
        }
        closeAllMenus() {
          closeAllMenus(this.state);
        }
        getSelectedChat() {
          return getSelectedChat(this.state);
        }
        getChatName(chatElem) {
          return getChatName(chatElem);
        }
        isClientChat(chatName) {
          return isClientChat(chatName);
        }
        isUserActive() {
          return isUserActive(this.state);
        }
        addChatToFolder(chatInfo, folderId) {
          return addChatToFolder(this.state, this, chatInfo, folderId);
        }
        autoAddClientChat(chatInfo) {
          return autoAddClientChat(this.state, this, chatInfo);
        }
        removeChatFromFolder(chatInfo, folderId) {
          return removeChatFromFolder(
            this.state,
            this,
            chatInfo,
            folderId
          );
        }
        isChatInFolder(chatInfo, folderId) {
          return isChatInFolder(this.state, chatInfo, folderId);
        }
        filterChatsByFolder(folderId) {
          return filterChatsByFolder(this.state, this, folderId);
        }
        showNoChatsMessage(folderName) {
          return showNoChatsMessage(this.state, folderName);
        }
        removeNoChatsMessage() {
          return removeNoChatsMessage(this.state);
        }
        getTotalUnreadCount() {
          return getTotalUnreadCount();
        }
        getUnreadCountForSpecificFolder(folder) {
          return getUnreadCountForSpecificFolder(this.state, this, folder);
        }
        getUnreadCountForFolder(folderId) {
          return getUnreadCountForFolder(this.state, this, folderId);
        }
        updateFolderBadges() {
          return updateFolderBadges(this.state, this);
        }
        waitForDOMAndUpdateBadges() {
          return waitForDOMAndUpdateBadges(this.state, this);
        }
        setupSPAObserver() {
          setupSPAObserver(this.state, this);
        }
        removeSPAObserver() {
          removeSPAObserver(this.state);
        }
        setupSPAWatchdog() {
          setupSPAWatchdog(this.state, this);
        }
        removeSPAWatchdog() {
          removeSPAWatchdog(this.state);
        }
        reinitializeUI() {
          if (!this.state.isEnabled) return;
          this.removeExtContextMenu();
          this.removeContextMenuItem();
          this.removeChatListObserver();
          this.removeRightClickHandler();
          this.removeFolders();
          this.state.foldersInjected = false;
          this.injectFolders();
          setTimeout(() => {
            this.applySavedFolderQuick();
            this.setupChatListObserver();
            this.setupRightClickHandler();
            this.waitForDOMAndUpdateBadges();
          }, 150);
        }
        cleanupOrphanedChatsSoft() {
          return cleanupOrphanedChatsSoft(this.state, this);
        }
        resetOrphanTracking() {
          return resetOrphanTracking(this.state);
        }
      };
    }
  });

  // content/index.js
  var require_content = __commonJS({
    "content/index.js"() {
      init_app();
      var app = new ChatsApp();
      app.init();
      window.__CHAT_FOLDERS_APP__ = app;
    }
  });
  require_content();
})();
//# sourceMappingURL=content.js.map
