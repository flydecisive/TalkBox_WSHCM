class Chats {
  constructor() {
    this.foldersData = [];
    this.selectedFolderId = "all";
    // this.contextMenuObserver = null;
    this.lastRightClickedChat = null;
    this.rightClickHandler = null;
    this.originalChatListDisplay = null;
    this.init();
  }

  async init() {
    await this.loadCSS();

    this.state = await this.getEnabledState();
    this.foldersData = await this.getFoldersData();
    this.applyState();
    this.setupStateListener();
    this.setupFoldersListener();
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
      if (request.action === "foldersChanged") {
        this.foldersData = request.folders;
        this.updateFoldersDisplay();
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
      foldersDataEl.innerHTML = window.foldersDataComponent(this.foldersData);
      this.addAtributesForFolders();
      this.setupFolderClickHandlers();
      this.updateSelectedFolder();
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
    } else {
      this.removeFolders();
      this.removeContextMenuItem();
      this.removeRightClickHandler();
      this.removeExtContextMenu();
    }
  }

  injectFolders() {
    // Сначала удаляем старые папки
    this.removeFolders();

    const tryInject = () => {
      const container = document.querySelector(".ws-conversations-header");

      if (container) {
        const folders = document.createElement("div");
        folders.setAttribute("data-chat-folders", "true");
        container.appendChild(folders);
        folders.innerHTML = window.foldersDataComponent(this.foldersData);
        this.addAtributesForFolders();
        this.setupFolderClickHandlers();
        this.updateSelectedFolder();
      } else {
        setTimeout(tryInject, 500);
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
    folders.forEach((el) => el.remove());
  }

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

  // Работа с контекстным меню
  injectContextMenuItem() {
    // Вставка нового пункта меню на страницу
    const container = document.querySelector(".p-contextmenu-root-list");

    if (container && !container.querySelector('[data-ext-menu="true"]')) {
      const menuItemHTML = window.contextMenuComponent();
      container.insertAdjacentHTML("beforeend", menuItemHTML);
      this.addMenuItemListener();
    }
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

        const extContextMenu = document.querySelector(".context_menu");
        if (!extContextMenu) {
          this.injectExtContextMenu();
        }
      });

      menuItem.addEventListener("mouseleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        menuItem.classList.remove("p-focus");
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
    const menuHTML = window.extContextMenuComponent(this.foldersData.slice(1));
    container.insertAdjacentHTML("beforeend", menuHTML);

    this.setupExtContextMenuListeners();
  }

  removeExtContextMenu() {
    const menu = document.querySelector(".context_menu");
    if (menu) {
      menu.remove();
    }
  }

  // Обработчик для подменю
  setupExtContextMenuListeners() {
    const menuItems = document.querySelectorAll(".context_menu__item");

    menuItems.forEach((menuItem) => {
      menuItem.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const folderId = menuItem.getAttribute("data-folder-id");

        // получение выбранного чата
        const chatInfo = this.getSelectedChat();
        if (chatInfo) {
          this.addChatToFolder(chatInfo, folderId);
        }

        this.removeExtContextMenu();
      });
    });
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
          // id: this.getRealChatId(chatItem),
        };
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
      return chatName.textContent.trim();
    }

    return "Без названия";
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
      }
    }
  }
}

// Инициализация
window.chatsInstance = new Chats();
