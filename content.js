class Chats {
  constructor() {
    this.foldersData = [];
    this.selectedFolderId = "all";
    // this.contextMenuObserver = null;
    this.lastRightClickedChat = null;
    this.rightClickHandler = null;
    this.originalChatListDisplay = null;
    this.preparedMenu = null;
    this.extMenuClickHandler = null;
    this.chatListObserver = null;
    this.periodUpdateInterval = null;
    this.spaObserver = null;
    this.isInitialized = false;
    this.reinitTimeout = null;
    this.isReinitializing = false;
    this.init();
  }

  async init() {
    await this.loadCSS();

    this.state = await this.getEnabledState();
    this.foldersData = await this.getFoldersData();

    this.setupSPAObserver();

    this.applyState();
    this.setupStateListener();
    this.setupFoldersListener();

    setTimeout(() => this.waitForDOMAndUpdateBadges(), 1000);

    this.isInitialized = true;
  }

  // Получение данных папок
  async getFoldersData() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getFolders" }, (response) => {
        if (!response?.folders || response.folders.length === 0) {
          const defaultFolders = [
            { id: "all", name: "Все", chats: [] },
            { id: "private", name: "Личные", chats: [] },
            { id: "clients", name: "Клиенты", chats: [] },
            { id: "others", name: "Другое", chats: [] },
          ];

          chrome.runtime.sendMessage(
            {
              action: "updateFolders",
              folders: defaultFolders,
            },
            () => {
              resolve(defaultFolders);
            }
          );
        } else {
          resolve(response.folders);
        }
      });
    });
  }

  // Слушатель изменений папок
  setupFoldersListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) {
        return true;
      }

      if (request.action === "foldersChanged") {
        if (this.validateFoldersData(request.folders)) {
          this.foldersData = request.folders;
          this.updateFoldersDisplay();
        }
        sendResponse({ received: true });
      }
      return true;
    });
  }

  // Обновление отображения папок
  updateFoldersDisplay() {
    if (!this.state) return;
    const foldersDataEl = document.querySelector("[data-chat-folders]");
    if (foldersDataEl) {
      foldersDataEl.innerHTML = window.foldersDataComponent(
        this.foldersData.map((folder) => ({
          ...folder,
          unreadCount: this.getUnreadCountForFolder(folder.id),
        }))
      );
      this.addAtributesForFolders();
      this.setupFolderClickHandlers();
      this.updateSelectedFolder();

      setTimeout(() => this.updateFolderBadges(), 100);
    }
  }

  setupFolderClickHandlers() {
    const folders = document.querySelectorAll(".folder");
    folders.forEach((folder) => {
      folder.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectFolder(folder);
      });
    });
  }

  selectFolder(folderElement) {
    const folderId = folderElement.getAttribute("data-id");

    if (!folderId) {
      return;
    }

    this.selectedFolderId = folderId;
    this.updateSelectedFolder();

    // Логика фильтрации чатов
    this.filterChatsByFolder(folderId);
  }

  updateSelectedFolder() {
    const folders = document.querySelectorAll(".folder");

    folders.forEach((folder) => {
      const folderId = folder.getAttribute("data-id");

      folder.removeAttribute("data-clicked");

      if (folderId === this.selectedFolderId) {
        folder.setAttribute("data-clicked", "true");
      }
    });
  }

  getAllFolders() {
    const folders = document.querySelectorAll(".folder");
    return folders;
  }

  addAtributesForFolders() {
    const folders = this.getAllFolders();
    folders.forEach((folder, index) => {
      folder.setAttribute("data-id", this.foldersData[index].id);
    });
  }

  async getEnabledState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getState" }, (response) => {
        resolve(response?.isEnabled ?? true);
      });
    });
  }

  setupStateListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) {
        return true;
      }

      if (request.action === "stateChanged") {
        this.state = request.isEnabled;
        this.applyState();
        sendResponse({ received: true });
      }
      return true;
    });
  }

  applyState() {
    if (this.state) {
      this.injectFolders();
      this.setupRightClickHandler();

      setTimeout(() => {
        this.setupChatListObserver();
        this.setupPeriodicUpdate();
        setTimeout(() => this.updateFolderBadges(), 2000);
      }, 1000);

      if (!this.spaObserver) {
        this.setupSPAObserver();
      }
    } else {
      this.removeFolders();
      this.removeContextMenuItem();
      this.removeRightClickHandler();
      this.removeExtContextMenu();
      this.removeNoChatsMessage();
      this.removeChatListObserver();

      if (this.spaObserver) {
        this.spaObserver.disconnect();
        this.spaObserver = null;
      }

      if (this.reinitTimeout) {
        clearTimeout(this.reinitTimeout);
        this.reinitTimeout = null;
      }

      this.isReinitializing = false;

      if (this.periodUpdateInterval) {
        clearInterval(this.periodUpdateInterval);
        this.periodUpdateInterval = null;
      }
    }
  }

  injectFolders() {
    const existingFolders = document.querySelector("[data-chat-folders]");
    if (existingFolders) {
      return;
    }

    this.removeFolders();
    const maxAttempts = 10;
    let attempts = 0;

    const tryInject = () => {
      attempts++;
      const container = document.querySelector(".ws-conversations-header");

      if (container) {
        const existingInContainer = container.querySelector(
          "[data-chat-folders]"
        );
        if (existingInContainer) {
          return;
        }

        const folders = document.createElement("div");
        folders.setAttribute("data-chat-folders", "true");
        container.appendChild(folders);
        folders.innerHTML = window.foldersDataComponent(this.foldersData);
        this.addAtributesForFolders();
        this.setupFolderClickHandlers();
        this.updateSelectedFolder();
      } else if (attempts < maxAttempts) {
        setTimeout(tryInject, 500);
      } else {
        console.warn("Не удалось найти контейнер");
      }
    };

    setTimeout(tryInject, 100);
  }

  injectFoldersData() {
    const container = document.querySelector("[data-chat-folders]");

    if (container) {
      const foldersData = document.createElement("div");
      foldersData.innerHTML = window.foldersDataComponent(this.foldersData);
      container.appendChild(foldersData);
      this.attachFolderClickListener();
    }
  }

  removeFolders() {
    const folders = document.querySelectorAll("[data-chat-folders]");
    folders.forEach((el) => {
      if (el.getAttribute("data-chat-folders") === "true") {
        el.remove();
      }
    });
  }

  // Загрузка css
  async loadCSS() {
    return new Promise((resolve) => {
      if (document.getElementById("chat-extension-styles")) {
        resolve();
        return;
      }

      const link = document.createElement("link");
      link.id = "chat-extension-styles";
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = chrome.runtime.getURL("styles.css");

      link.onload = () => {
        console.log("CSS стили загружены");
        resolve();
      };

      link.onerror = (error) => {
        console.error("Ошибка загрузки CSS:", error);
        resolve(); // Продолжаем даже при ошибке
      };

      document.head.appendChild(link);
    });
  }

  // Валидация папок
  validateFoldersData(folders) {
    if (!Array.isArray(folders)) return false;

    return folders.every((folder) => {
      return (
        typeof folder?.id === "string" &&
        typeof folder?.name === "string" &&
        (Array.isArray(folder?.chats) || folder?.chats === undefined)
      );
    });
  }

  // Работа с контекстным меню
  injectContextMenuItem() {
    // Вставка нового пункта меню на страницу
    const rootContainer = document.querySelector("#cnv_context_menu");
    const container = rootContainer.querySelector(".p-contextmenu-root-list");

    if (container && !container.querySelector('[data-ext-menu="true"]')) {
      const oldMenuItem = container.querySelector('[data-ext-menu="true"]');
      if (oldMenuItem) {
        oldMenuItem.remove();
      }

      const menuItemHTML = window.contextMenuComponent();
      container.insertAdjacentHTML("beforeend", menuItemHTML);

      this.prepareExtContextMenu();
      this.addMenuItemListener();
    }
  }

  // Предварительная подготовка меню
  prepareExtContextMenu() {
    const existingMenu = document.querySelector(".context_menu");
    if (existingMenu) {
      existingMenu.remove();
    }

    const chatInfo = this.getSelectedChat();

    // Создание скрытого меню
    const menuHTML = window.extContextMenuComponent(
      this.foldersData.slice(1),
      chatInfo
    );
    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    tempDiv.innerHTML = menuHTML;
    document.body.appendChild(tempDiv);

    const menu = tempDiv.firstElementChild;
    menu.style.display = "none";

    this.preparedMenu = menu;

    this.setupExtContextMenuListeners(menu);
  }

  addMenuItemListener() {
    const menuItem = document.querySelector('[data-ext-menu="true"]');

    if (menuItem) {
      menuItem.addEventListener("mouseenter", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const allMenuItems = document.querySelectorAll(".p-menuitem");
        allMenuItems.forEach((menuItem) => {
          menuItem.classList.remove("p-focus");
        });
        menuItem.classList.add("p-focus");

        this.injectExtContextMenu();
      });

      menuItem.addEventListener("mouseleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // menuItem.classList.remove("p-focus");
        setTimeout(() => {
          const menuItem = document.querySelector('[data-ext-menu="true"]');
          const contextMenu = document.querySelector(".context_menu");

          if (
            menuItem &&
            !menuItem.matches(":hover") &&
            contextMenu &&
            !contextMenu.matches(":hover")
          ) {
            this.removeExtContextMenu();
            menuItem.classList.remove("p-focus");
          }
        }, 150);
      });
    }
  }

  removeContextMenuItem() {
    const menuItem = document.querySelector('[data-ext-menu="true"]');
    if (menuItem) {
      menuItem.remove();
    }
  }

  removeRightClickHandler() {
    if (this.rightClickHandler) {
      document.removeEventListener("contextmenu", this.rightClickHandler, true);
      this.rightClickHandler = null;
    }
  }

  injectExtContextMenu() {
    const container = document.body.querySelector('[data-ext-menu="true"]');
    // const menuHTML = window.extContextMenuComponent(this.foldersData.slice(1));

    if (!container || !this.preparedMenu) {
      return;
    }

    this.preparedMenu.style.display = "block";

    if (this.preparedMenu.parentNode !== container) {
      if (this.preparedMenu.parentNode) {
        this.preparedMenu.parentNode.removeChild(this.preparedMenu);
      }
      container.appendChild(this.preparedMenu);
    }

    setTimeout(() => {
      document.removeEventListener(
        "click",
        this.handleOutsideClick.bind(this),
        true
      );
      document.addEventListener(
        "click",
        this.handleOutsideClick.bind(this),
        true
      );
    }, 10);
  }

  removeExtContextMenu() {
    const menu = document.querySelector(".context_menu");
    if (menu) {
      document.removeEventListener(
        "click",
        this.handleOutsideClick.bind(this),
        true
      );

      if (this.extMenuClickHandler && this.preparedMenu) {
        const menuItems = this.preparedMenu.querySelectorAll(
          ".context_menu__item"
        );
        menuItems.forEach((item) => {
          item.removeEventListener("click", this.extMenuClickHandler);
        });
      }

      if (this.preparedMenu) {
        this.preparedMenu.style.display = "none";
      }
    }
  }

  // Удаление подготовленного меню
  removePreparedMenu() {
    if (this.preparedMenu && this.preparedMenu.parentNode) {
      this.preparedMenu.parentNode.removeChild(this.preparedMenu);
      this.preparedMenu = null;
    }
  }

  // Обработчик для подменю
  setupExtContextMenuListeners(menu) {
    if (!menu) menu = this.preparedMenu;
    if (!menu) return;

    menu.addEventListener("mouseenter", () => {});

    menu.addEventListener("mouseleave", () => {
      setTimeout(() => {
        const menuItem = document.querySelector('[data-ext-menu="true"]');
        const contextMenu = document.querySelector(".context_menu");

        if (
          menuItem &&
          !menuItem.matches(":hover") &&
          contextMenu &&
          !contextMenu.matches(":hover")
        ) {
          this.removeExtContextMenu();
          if (menuItem) menuItem.classList.remove("p-focus");
        }
      }, 150);
    });

    const menuItems = menu.querySelectorAll(".context_menu__item");

    menuItems.forEach((menuItem) => {
      menuItem.removeEventListener("click", this.handleMenuItemClick);

      this.handleExtMenuItemClick = this.handleMenuItemClick.bind(this);
      menuItem.addEventListener("click", this.handleMenuItemClick.bind(this));
    });
  }

  handleMenuItemClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const menuItem = e.currentTarget;
    const folderId = menuItem.getAttribute("data-folder-id");
    const action = menuItem.getAttribute("data-action");

    const chatInfo = this.getSelectedChat();
    if (chatInfo) {
      let success = false;
      let message = "";
      if (action === "add") {
        success = this.addChatToFolder(chatInfo, folderId);
        message = "Чат добавлен в папку";
      } else if (action === "remove") {
        success = this.removeChatFromFolder(chatInfo, folderId);
        message = "Чат удален из папки";
      }

      if (success) {
        this.showNotification(message);
        this.updateContextMenuAfterAction(chatInfo, folderId, action);
      }
    }

    this.closeAllMenus();
  }

  // Удаление чата из папки
  removeChatFromFolder(chatInfo, folderId) {
    if (!chatInfo || !chatInfo.name) {
      return false;
    }

    const folder = this.foldersData.find((f) => f.id === folderId);
    if (!folder || !folder.chats) return false;

    const initialLength = folder.chats.length;
    folder.chats = folder.chats.filter((chat) => chat.name !== chatInfo.name);

    const removed = folder.chats.length < initialLength;

    if (removed) {
      this.saveFoldersData();

      if (this.selectedFolderId === folderId) {
        this.filterChatsByFolder(folderId);
      }
    }

    return removed;
  }

  // Обновление контекстного меню
  updateContextMenuAfterAction() {
    this.prepareExtContextMenu();

    const container = document.querySelector('[data-ext-menu="true"]');
    if (container && this.preparedMenu) {
      const oldMenu = container.querySelector(".context_menu");
      if (oldMenu) {
        oldMenu.remove();
      }
    }

    this.preparedMenu.style.display = "block";
    if (this.preparedMenu.parentNode !== container) {
      if (this.preparedMenu.parentNode) {
        this.preparedMenu.parentNode.removeChild(this.preparedMenu);
      }
      container.appendChild(this.preparedMenu);
    }
  }

  handleOutsideClick(e) {
    const contextMenu = document.querySelector(".context_menu");
    const extMenuItem = document.querySelector('[data-ext-menu="true"]');

    if (
      contextMenu &&
      !contextMenu.contains(e.target) &&
      extMenuItem &&
      !extMenuItem.contains(e.target)
    ) {
      this.closeAllMenus();
    }
  }

  // Закрытие всех меню
  closeAllMenus() {
    this.removeExtContextMenu();
    this.removeContextMenuItem();
    this.closeSiteContextMenu();
  }

  closeSiteContextMenu() {
    document.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  // Получение выбранного чата
  getSelectedChat() {
    if (this.lastRightClickedChat) {
      return this.lastRightClickedChat;
    }

    return null;
  }

  setupRightClickHandler() {
    this.rightClickHandler = (e) => {
      const chatItem = e.target.closest(".ws-conversations-list-item");

      if (chatItem) {
        this.lastRightClickedChat = {
          element: chatItem,
          name: this.getChatName(chatItem),
        };

        this.prepareExtContextMenu();
      } else {
        this.lastRightClickedChat = null;
      }

      setTimeout(() => {
        this.injectContextMenuItem();
      }, 100);
    };

    document.addEventListener("contextmenu", this.rightClickHandler, true);
  }

  getChatName(chatElem) {
    const chatName = chatElem.querySelector(
      ".ws-conversations-list-item--info--name"
    );

    if (chatName) {
      return chatName.textContent.trim().replace(/[<>]/g, "").substring(0, 100);
    }

    return "Без названия";
  }

  // показ уведомления
  showNotification(message) {
    const notification = document.createElement("div");
    notification.textContent = message;
    notification.classList.add("ext-notification");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #6ef5d2;
      color: #232332;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      animation: fadeInOut 3s ease-in-out;
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes fadeInOut {
        0% {
          opacity: 0;
          transform: translateY(-20px);
        }
        10% {
          opacity: 1;
          transform: translateY(0);
        }
        90% {
          opacity: 1;
          transform: translateY(0);
        }
        100% {
          opacity: 0;
          transform: translateY(-20px);
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
      style.remove();
    }, 3000);
  }

  addChatToFolder(chatInfo, folderId) {
    if (!chatInfo || !chatInfo.name) {
      return false;
    }

    const folder = this.foldersData.find((f) => f.id === folderId);
    if (!folder) return false;

    if (!folder.chats) folder.chats = [];

    const chatExists = folder.chats.some((chat) => chat.name === chatInfo.name);

    if (!chatExists) {
      folder.chats.push({
        name: chatInfo.name,
        addedAt: new Date().toISOString(),
      });

      this.saveFoldersData();

      if (this.selectedFolderId === folderId) {
        this.filterChatsByFolder(folderId);
      }

      return true;
    } else {
      return false;
    }
  }

  // Сохранение данных
  saveFoldersData() {
    chrome.runtime.sendMessage(
      {
        action: "updateFolders",
        folders: this.foldersData,
      },
      (response) => {
        if (response?.success) {
          console.log("Данные папок сохранены");
        }
      }
    );
  }

  // фильтрация чатов
  filterChatsByFolder(folderId) {
    // контейнер с чатами
    const chatsContainer = document.querySelector(
      "#cnvs_root .ws-conversations-list--root"
    );
    if (!chatsContainer) {
      return;
    }

    // все чатики
    const chatList = chatsContainer.querySelectorAll("li");

    if (folderId === "all") {
      chatList.forEach((chat) => {
        chat.classList.remove("ext-hidden-chat");
        chat.removeAttribute("data-ext-hidden");
      });

      this.removeNoChatsMessage();
    } else {
      const folder = this.foldersData.find((f) => f.id === folderId);
      if (!folder) {
        return;
      }

      if (!folder.chats || folder.chats.length === 0) {
        chatList.forEach((chat) => {
          chat.classList.add("ext-hidden-chat");
          chat.setAttribute("data-ext-hidden", "true");
        });

        this.showNoChatsMessage(folder.name);
      } else {
        const chatNamesInFolder = folder.chats?.map((chat) => chat.name);

        let visibleCount = 0;

        chatList.forEach((chat) => {
          const chatName = this.getChatName(chat);

          if (chatNamesInFolder.includes(chatName)) {
            chat.classList.remove("ext-hidden-chat");
            chat.removeAttribute("data-ext-hidden");
            visibleCount++;
          } else {
            chat.classList.add("ext-hidden-chat");
            chat.setAttribute("data-ext-hidden", "true");
          }
        });

        if (visibleCount > 0) {
          this.removeNoChatsMessage();
        } else {
          this.showNoChatsMessage(folder.name);
        }
      }
    }
  }

  // Проверка чата в папке
  isChatInFolder(chatInfo, folderId) {
    if (!chatInfo || !chatInfo.name) return false;

    const folder = this.foldersData.find((f) => f.id === folderId);
    if (!folder || !folder.chats) return false;

    return folder.chats.some((chat) => chat.name === chatInfo.name);
  }

  // Показ сообщения нет чатов
  showNoChatsMessage(folderName) {
    this.removeNoChatsMessage();

    const messageContainer = document.createElement("div");
    messageContainer.className = "ext-no-chats-message";
    messageContainer.innerHTML = `
      <div class="ext-no-chats-content">
        <h3>В папке "${folderName}" нет чатов</h3>
      </div>
    `;

    const chatsList = document.querySelector(
      "#cnvs_root .ws-conversations-list--root"
    );
    if (chatsList && chatsList.parentNode) {
      chatsList.parentNode.insertBefore(
        messageContainer,
        chatsList.nextSibling
      );
    }

    this.noChatsMessage = messageContainer;
  }

  // Удаление сообщения об отсутствии чатов
  removeNoChatsMessage() {
    if (this.noChatsMessage && this.noChatsMessage.parentNode) {
      this.noChatsMessage.parentNode.removeChild(this.noChatsMessage);
      this.noChatsMessage = null;
    }
  }

  // Работа с бейджами
  getUnreadCountForFolder(folderId) {
    if (folderId === "all") {
      return this.getTotalUnreadCount();
    } else {
      const folder = this.foldersData.find((f) => f.id === folderId);
      if (!folder) return 0;
      return this.getUnreadCountForSpecificFolder(folder);
    }
  }

  // Счетчик непрочитанных для конкретной папки
  getUnreadCountForSpecificFolder(folder) {
    if (!folder || !folder.chats || folder.chats.length === 0) return 0;

    let unreadCount = 0;
    const allChats = document.querySelectorAll(".ws-conversations-list-item");

    folder.chats.forEach((chatData) => {
      allChats.forEach((chatElement) => {
        const chatName = this.getChatName(chatElement);
        if (chatName === chatData.name) {
          const badge = chatElement.querySelector(
            ".ws-conversations-list-item--badge"
          );
          if (badge) {
            unreadCount++;
          }
        }
      });
    });

    return unreadCount;
  }

  // Обновление счетчиков без полного обновления папок
  updateFolderBadges() {
    const folders = document.querySelectorAll(".folder");
    folders.forEach((folder) => {
      const folderId = folder.getAttribute("data-id");
      if (folderId) {
        const unreadCount = this.getUnreadCountForFolder(folderId);
        this.updateBadgeForFolderElement(folder, unreadCount);
      }
    });
  }

  updateBadgeForFolderElement(folderElement, unreadCount) {
    let badge = folderElement.querySelector(".folder__badge");

    if (unreadCount > 0) {
      const badgeText = unreadCount > 9 ? "9+" : unreadCount.toString();

      if (!badge) {
        // Создаем бейдж, если его нет
        badge = document.createElement("div");
        badge.className = "folder__badge";
        folderElement.insertBefore(badge, folderElement.firstChild);
      }

      badge.textContent = badgeText;
      badge.style.display = "flex";
    } else {
      // Удаляем бейдж, если нет непрочитанных
      if (badge) {
        badge.remove();
      }
    }
  }

  // все непрочитанные чаты
  getTotalUnreadCount() {
    let totalUnread = 0;
    const allChats = document.querySelectorAll(".ws-conversations-list-item");

    allChats.forEach((chatElement) => {
      const badge = chatElement.querySelector(
        ".ws-conversations-list-item--badge"
      );
      if (badge) {
        totalUnread++;
      }
    });

    return totalUnread;
  }

  // Обсервер изменений в чате
  setupChatListObserver() {
    const chatListObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          const addedBadges = mutation.addedNodes
            ? Array.from(mutation.addedNodes).some(
                (node) =>
                  node.classList &&
                  node.classList.contains("ws-conversations-list-item--badge")
              )
            : false;

          const removedBadges = mutation.removedNodes
            ? Array.from(mutation.removedNodes).some(
                (node) =>
                  node.classList &&
                  node.classList.contains("ws-conversations-list-item--badge")
              )
            : false;

          if (addedBadges || removedBadges) {
            shouldUpdate = true;
          }
        }
      });

      if (shouldUpdate) {
        this.updateFolderBadges();
      }
    });

    const chatList = document.querySelector(
      "#cnvs_root .ws-conversations-list--root"
    );
    if (chatList) {
      chatListObserver.observe(chatList, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });

      this.chatListObserver = chatListObserver;

      this.updateFolderBadges();
    }
  }

  // удаление обзервера
  removeChatListObserver() {
    if (this.chatListObserver) {
      this.chatListObserver.disconnect();
      this.chatListObserver = null;
    }
  }

  // Переодическое обновление счетчиков
  setupPeriodicUpdate() {
    if (this.periodUpdateInterval) {
      clearInterval(this.periodUpdateInterval);
    }

    this.periodUpdateInterval = setInterval(() => {
      if (this.state) {
        this.updateFolderBadges();
      }
    }, 5000);
  }

  // Проверка дом и принудительное обновление бейджей
  waitForDOMAndUpdateBadges() {
    const checkDom = () => {
      const chatList = document.querySelector(
        "#cnvs_root .ws-conversations-list--root"
      );

      if (chatList && chatList.children.length > 0) {
        this.updateFolderBadges();
        return true;
      }

      return false;
    };

    if (checkDom()) {
      return;
    }

    const maxAttempts = 10;
    let attempts = 0;

    const interval = setInterval(() => {
      attempts++;
      if (checkDom() || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500);
  }

  // Работа с spa
  setupSPAObserver() {
    const targetNode = document.body;

    if (!targetNode) return;

    const config = {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    };

    const callback = (mutationsList) => {
      if (this.isReinitializing) return;

      let shouldCheck = false;

      for (let mutation of mutationsList) {
        if (mutation.type === "childList") {
          const addedNodes = Array.from(mutation.addedNodes);
          const hasChatElements = addedNodes.some((node) => {
            if (node.nodeType === 1) {
              return (
                node.matches?.("#cnvs_root, .ws-conversations-header") ||
                node.querySelector?.("#cnvs_root, .ws-conversations-header")
              );
            }
            return false;
          });

          if (hasChatElements) {
            shouldCheck = true;
            break;
          }
        }
      }

      if (shouldCheck) {
        this.checkAndReinitialize();
      }
    };

    this.spaObserver = new MutationObserver(callback);
    this.spaObserver.observe(targetNode, config);
  }

  checkAndReinitialize() {
    const chatContainer = document.querySelector("#cnvs_root");
    const conversationsHeader = document.querySelector(
      ".ws-conversations-header"
    );
    const existingFolders = document.querySelector("[data-chat-folders]");

    if (
      chatContainer &&
      conversationsHeader &&
      !existingFolders &&
      this.state
    ) {
      this.removeFolders();
      this.removeNoChatsMessage();

      this.injectFolders();

      setTimeout(() => {
        this.updateFolderBadges();
        this.setupChatListObserver();
      }, 1000);
    }
  }

  checkAndReinitialize() {
    if (this.isReinitializing) return;

    if (this.reinitTimeout) {
      clearTimeout(this.reinitTimeout);
    }

    this.reinitTimeout = setTimeout(() => {
      this.performReinitialization();
    }, 500);
  }

  performReinitialization() {
    const chatContainer = document.querySelector("#cnvs_root");
    const conversationsHeader = document.querySelector(
      ".ws-conversations-header"
    );
    const existingFolders = document.querySelector("[data-chat-folders]");

    if (
      chatContainer &&
      conversationsHeader &&
      !existingFolders &&
      this.state
    ) {
      this.isReinitializing = true;

      this.removeAllFolders();
      this.removeNoChatsMessage();

      this.injectFolders();

      setTimeout(() => {
        this.updateFolderBadges();
        this.setupChatListObserver();
        this.isReinitializing = false;
      }, 1000);
    }
  }

  // Полная очистка папок
  removeAllFolders() {
    const mainContainer = document.querySelector("[data-chat-folders]");
    if (mainContainer) mainContainer.remove();

    const allFolders = document.querySelectorAll(".folder");
    allFolders.forEach((folder) => {
      if (folder.parentNode && folder.parentNode.nodeName !== "BODY") {
        folder.remove();
      }
    });
  }
}

// Инициализация
window.chatsInstance = new Chats();
