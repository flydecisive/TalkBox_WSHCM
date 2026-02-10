// ==============================
// ОСНОВНОЙ КЛАСС И ИНИЦИАЛИЗАЦИЯ
// ==============================
class Chats {
  constructor() {
    this.foldersData = [];
    this.selectedFolderId = "all";
    this.lastRightClickedChat = null;
    this.rightClickHandler = null;
    this.preparedMenu = null;
    this.chatListObserver = null;
    this.periodUpdateInterval = null;
    this.spaObserver = null;
    this.foldersInjected = false;

    this.updateBadgesTimeout = null;
    this.lastUserActivity = Date.now();

    document.addEventListener(
      "mousemove",
      () => (this.lastUserActivity = Date.now()),
    );
    document.addEventListener(
      "click",
      () => (this.lastUserActivity = Date.now()),
    );
    document.addEventListener(
      "keydown",
      () => (this.lastUserActivity = Date.now()),
    );

    this.init();
  }

  async init() {
    await this.loadCSS();

    const [state, foldersData] = await Promise.all([
      this.getEnabledState(),
      this.getFoldersData(),
      this.loadSelectedFolder(),
    ]);

    this.state = state;
    this.foldersData = foldersData;

    this.applyState();
    this.setupStateListener();
    this.setupFoldersListener();
    setTimeout(() => {
      this.setupSPAObserver();
    }, 3000);

    setTimeout(() => this.waitForDOMAndUpdateBadges(), 1000);
  }

  // ==============================
  // РАБОТА С ДАННЫМИ ПАПОК
  // ==============================

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
            },
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
      },
    );
  }

  // ==============================
  // УПРАВЛЕНИЕ СОСТОЯНИЕМ РАСШИРЕНИЯ
  // ==============================

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
      this.foldersInjected = false;

      this.injectFolders();
      this.setupRightClickHandler();

      setTimeout(() => {
        this.setupChatListObserver();
        this.setupPeriodicUpdate();
        this.applySavedFolderQuick();

        setTimeout(() => this.updateFolderBadges(), 500);
      }, 300);
    } else {
      this.cleanup();
      this.cleanupOrphanedChats();
    }
  }

  // ==============================
  // ОЧИСТКА И УДАЛЕНИЕ РЕСУРСОВ
  // ==============================

  cleanup() {
    this.removeFolders();
    this.removeContextMenuItem();
    this.removeRightClickHandler();
    this.removeExtContextMenu();
    this.removeNoChatsMessage();
    this.removeChatListObserver();

    this.foldersInjected = false;

    if (this.spaObserver) {
      this.spaObserver.disconnect();
      this.spaObserver = null;
    }

    if (this.periodUpdateInterval) {
      clearInterval(this.periodUpdateInterval);
      this.periodUpdateInterval = null;
    }
  }

  // ==============================
  // ОТОБРАЖЕНИЕ И УПРАВЛЕНИЕ ПАПКАМИ В UI
  // ==============================

  // Обновление отображения папок
  updateFoldersDisplay() {
    if (!this.state) return;
    const foldersDataEl = document.querySelector("[data-chat-folders]");
    if (foldersDataEl) {
      const visibleFolders = this.foldersData.filter(
        (folder) => !folder.hidden,
      );

      foldersDataEl.innerHTML = window.foldersDataComponent(
        visibleFolders.map((folder) => ({
          ...folder,
          unreadCount: this.getUnreadCountForFolder(folder.id),
        })),
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

    this.saveSelectedFolder();
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

  // ==============================
  // ВСТАВКА И УДАЛЕНИЕ ПАПОК В DOM
  // ==============================

  injectFolders() {
    const existingFolders = document.querySelector("[data-chat-folders]");
    if (existingFolders) {
      this.foldersInjected = true;
      return;
    }

    this.removeFolders();

    const maxAttempts = 5;
    let attempts = 0;

    const tryInject = () => {
      attempts++;

      const container = document.querySelector(".ws-conversations-header");

      if (container) {
        const existingInContainer = container.querySelector(
          "[data-chat-folders]",
        );
        if (existingInContainer) {
          this.foldersInjected = true;
          return;
        }

        const folders = document.createElement("div");
        folders.setAttribute("data-chat-folders", "true");
        container.appendChild(folders);
        folders.innerHTML = window.foldersDataComponent(this.foldersData);

        folders.style.marginTop = "10px";

        const folderElements = folders.querySelectorAll(".folder");
        folderElements.forEach((folder, index) => {
          if (this.foldersData[index]) {
            folder.setAttribute("data-id", this.foldersData[index].id);
            folder.addEventListener("click", (e) => {
              e.stopPropagation();
              this.selectFolder(folder);
            });
          }
        });

        this.updateSelectedFolder();
        this.foldersInjected = true;

        setTimeout(() => {
          this.updateFolderBadges();
          this.applySavedFolderQuick();
        }, 100);
      } else if (attempts < maxAttempts) {
        setTimeout(tryInject, 200);
      } else {
        this.foldersInjected = false;
      }
    };

    setTimeout(tryInject, 50);
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
    let removed = false;

    folders.forEach((el) => {
      if (el.getAttribute("data-chat-folders") === "true") {
        el.remove();
        removed = true;
      }
    });

    if (removed) {
      this.foldersInjected = false;
    }
  }

  // ==============================
  // CSS И СТИЛИ
  // ==============================

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
        resolve();
      };

      document.head.appendChild(link);
    });
  }

  // ==============================
  // КОНТЕКСТНОЕ МЕНЮ - ОСНОВНОЕ
  // ==============================

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

  // ==============================
  // КОНТЕКСТНОЕ МЕНЮ - РАСШИРЕННОЕ
  // ==============================

  // Предварительная подготовка меню
  prepareExtContextMenu() {
    const existingMenu = document.querySelector(".context_menu");
    if (existingMenu) {
      existingMenu.remove();
    }

    const chatInfo = this.getSelectedChat();

    const visibleFolders = this.foldersData
      .slice(1)
      .filter((folder) => !folder.hidden);

    const menuHTML = window.extContextMenuComponent(visibleFolders, chatInfo);

    const tempDiv = document.createElement("div");
    tempDiv.style.display = "none";
    tempDiv.innerHTML = menuHTML;
    document.body.appendChild(tempDiv);

    const menu = tempDiv.firstElementChild;
    menu.style.display = "none";

    this.preparedMenu = menu;

    this.setupExtContextMenuListeners(menu);
  }

  injectExtContextMenu() {
    const container = document.body.querySelector('[data-ext-menu="true"]');

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
        true,
      );
      document.addEventListener(
        "click",
        this.handleOutsideClick.bind(this),
        true,
      );
    }, 10);
  }

  removeExtContextMenu() {
    const menu = document.querySelector(".context_menu");
    if (menu) {
      document.removeEventListener(
        "click",
        this.handleOutsideClick.bind(this),
        true,
      );

      if (this.extMenuClickHandler && this.preparedMenu) {
        const menuItems = this.preparedMenu.querySelectorAll(
          ".context_menu__item",
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

  // ==============================
  // УПРАВЛЕНИЕ КОНТЕКСТНЫМИ МЕНЮ
  // ==============================

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

    setTimeout(() => {
      this.updateFolderBadges();
    }, 50);
  }

  closeSiteContextMenu() {
    document.dispatchEvent(
      new MouseEvent("click", {
        view: window,
        bubbles: true,
        cancelable: true,
      }),
    );
  }

  // ==============================
  // РАБОТА С ПРАВОЙ КНОПКОЙ МЫШИ
  // ==============================

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

    this.chatClickHandler = (e) => {
      const chatItem = e.target.closest(".ws-conversations-list-item");
      if (chatItem) {
        setTimeout(() => {
          this.updateFolderBadges();
        }, 100);
      }
    };

    document.addEventListener("click", this.chatClickHandler, true);
  }

  removeRightClickHandler() {
    if (this.rightClickHandler) {
      document.removeEventListener("contextmenu", this.rightClickHandler, true);
      this.rightClickHandler = null;
    }

    // ДОБАВЛЕНО: Удаляем обработчик кликов
    if (this.chatClickHandler) {
      document.removeEventListener("click", this.chatClickHandler, true);
      this.chatClickHandler = null;
    }
  }

  // ==============================
  // РАБОТА С ЧАТАМИ
  // ==============================

  // Получение выбранного чата
  getSelectedChat() {
    if (this.lastRightClickedChat) {
      return this.lastRightClickedChat;
    }

    return null;
  }

  getChatName(chatElem) {
    const chatName = chatElem.querySelector(
      ".ws-conversations-list-item--info--name",
    );

    if (chatName) {
      return chatName.textContent.trim().replace(/[<>]/g, "").substring(0, 100);
    }

    return "Без названия";
  }

  // ==============================
  // ДОБАВЛЕНИЕ И УДАЛЕНИЕ ЧАТОВ ИЗ ПАПОК
  // ==============================

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
        autoAdded: folderId === "clients", // Флаг, что добавлен автоматически
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

  // Автоматическое добавление клиентских чатов
  autoAddClientChat(chatInfo) {
    if (!chatInfo || !chatInfo.name) return false;

    if (this.isClientChat(chatInfo.name)) {
      const clientsFolder = this.foldersData.find((f) => f.id === "clients");

      if (clientsFolder) {
        const alreadyAdded = clientsFolder.chats?.some(
          (chat) => chat.name === chatInfo.name,
        );

        if (!alreadyAdded) {
          const added = this.addChatToFolder(chatInfo, "clients");

          if (added) {
            if (this.selectedFolderId === "clients") {
              setTimeout(() => {
                this.filterChatsByFolder("clients");
              }, 100);
            }

            return true;
          }
        }
      }
    }

    return false;
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

  // Проверка чата в папке
  isChatInFolder(chatInfo, folderId) {
    if (!chatInfo || !chatInfo.name) return false;

    const folder = this.foldersData.find((f) => f.id === folderId);
    if (!folder || !folder.chats) return false;

    return folder.chats.some((chat) => chat.name === chatInfo.name);
  }

  // ==============================
  // ФИЛЬТРАЦИЯ ЧАТОВ
  // ==============================

  // фильтрация чатов
  filterChatsByFolder(folderId) {
    // контейнер с чатами
    const chatsContainer = document.querySelector(
      "#cnvs_root .ws-conversations-list--root",
    );

    if (!chatsContainer) {
      setTimeout(() => {
        const retryContainer = document.querySelector(
          "#cnvs_root .ws-conversations-list--root",
        );
        if (retryContainer) {
          this.filterChatsByFolder(folderId);
        }
      }, 50);
      return;
    }

    // все чатики
    const chatList = chatsContainer.querySelectorAll("li");
    const allChatNames = new Set();

    chatList.forEach((chat) => {
      const chatName = this.getChatName(chat);
      allChatNames.add(chatName);

      if (this.isClientChat(chatName)) {
        const chatInfo = {
          element: chat,
          name: chatName,
        };
        this.autoAddClientChat(chatInfo);
      }
    });

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
        const chatNamesInFolder = new Set(
          folder.chats.map((chat) => chat.name),
        );
        let visibleCount = 0;
        let existingChatsInFolder = 0;

        chatList.forEach((chat) => {
          const chatName = this.getChatName(chat);

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

          if (!this.isUserActive()) {
            setTimeout(() => {
              this.cleanupOrphanedChats();
            }, 2000);
          }
        }

        if (visibleCount > 0) {
          this.removeNoChatsMessage();
        } else {
          if (folder.chats.length > 0) {
            this.showNoChatsMessage(
              `${folder.name} (чаты отсутствуют на странице)`,
            );

            setTimeout(() => {
              if (this.state) {
                this.cleanupOrphanedChats();
              }
            }, 3000);
          } else {
            this.showNoChatsMessage(folder.name);
          }
        }
      }
    }
  }
  // ==============================
  // СООБЩЕНИЯ ОТСУТСТВИЯ ЧАТОВ
  // ==============================

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
      "#cnvs_root .ws-conversations-list--root",
    );
    if (chatsList && chatsList.parentNode) {
      chatsList.parentNode.insertBefore(
        messageContainer,
        chatsList.nextSibling,
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

  // ==============================
  // РАБОТА С БЕЙДЖАМИ (СЧЕТЧИКАМИ)
  // ==============================

  // Работа с бейджами
  getUnreadCountForFolder(folderId) {
    if (folderId === "all") {
      return this.getTotalUnreadCount();
    } else {
      const folder = this.foldersData.find((f) => f.id === folderId);
      if (!folder || folder.hidden) return 0;
      return this.getUnreadCountForSpecificFolder(folder);
    }
  }

  // Счетчик непрочитанных для конкретной папки
  getUnreadCountForSpecificFolder(folder) {
    if (!folder || !folder.chats || folder.chats.length === 0) return 0;

    // Более точный селектор: бейджи, которые видны
    const allChatsWithBadges = document.querySelectorAll(
      ".ws-conversations-list-item .ws-conversations-list-item--badge:not([style*='display: none']), " +
        ".ws-conversations-list-item .ws-conversations-list-item--badge:not([hidden])",
    );

    if (allChatsWithBadges.length === 0) return 0;

    const chatsWithBadgesMap = new Map();

    for (let i = 0; i < allChatsWithBadges.length; i++) {
      const badge = allChatsWithBadges[i];
      if (
        badge.offsetParent !== null &&
        badge.style.display !== "none" &&
        !badge.hidden
      ) {
        const chatElement = badge.closest(".ws-conversations-list-item");
        if (chatElement) {
          const chatName = this.getChatName(chatElement);
          chatsWithBadgesMap.set(chatName, true);
        }
      }
    }

    let unreadCount = 0;
    for (let i = 0; i < folder.chats.length; i++) {
      if (chatsWithBadgesMap.has(folder.chats[i].name)) {
        unreadCount++;
      }
    }

    return unreadCount;
  }

  // Обновление счетчиков без полного обновления папок
  updateFolderBadges() {
    if (this.updateBadgesTimeout) {
      clearTimeout(this.updateBadgesTimeout);
    }

    this.updateBadgesTimeout = setTimeout(() => {
      const folders = document.querySelectorAll(".folder");

      if (folders.length === 0) {
        this.updateBadgesTimeout = null;
        return;
      }

      const allBadges = document.querySelectorAll(
        ".ws-conversations-list-item .ws-conversations-list-item--badge",
      );

      const chatsWithBadges = new Map();
      for (let i = 0; i < allBadges.length; i++) {
        const badge = allBadges[i];
        const chatElement = badge.closest(".ws-conversations-list-item");
        if (chatElement) {
          const chatName = this.getChatName(chatElement);
          chatsWithBadges.set(chatName, true);
        }
      }

      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        const folderId = folder.getAttribute("data-id");

        if (folderId) {
          const unreadCount = this.getUnreadCountForFolderOptimized(
            folderId,
            chatsWithBadges,
          );
          this.updateBadgeForFolderElement(folder, unreadCount);
        }
      }

      this.updateBadgesTimeout = null;
    }, 30);
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
      if (badge) {
        badge.remove();
      }
    }
  }

  // все непрочитанные чаты
  getTotalUnreadCount() {
    const badges = document.querySelectorAll(
      ".ws-conversations-list-item .ws-conversations-list-item--badge",
    );
    return badges.length;
  }

  getUnreadCountForFolderOptimized(folderId, chatsWithBadgesMap) {
    if (folderId === "all") {
      return chatsWithBadgesMap.size;
    } else {
      const folder = this.foldersData.find((f) => f.id === folderId);
      if (!folder) return 0;
      return this.getUnreadCountForSpecificFolderOptimized(
        folder,
        chatsWithBadgesMap,
      );
    }
  }

  getUnreadCountForSpecificFolderOptimized(folder, chatsWithBadgesMap) {
    if (!folder || !folder.chats || folder.chats.length === 0) return 0;

    let unreadCount = 0;

    for (let i = 0; i < folder.chats.length; i++) {
      if (chatsWithBadgesMap.has(folder.chats[i].name)) {
        unreadCount++;
      }
    }

    return unreadCount;
  }

  // ==============================
  // НАБЛЮДАТЕЛИ И ОБСЕРВЕРЫ
  // ==============================

  // Обсервер изменений в чате
  setupChatListObserver() {
    let updatePending = false;

    const chatListObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      let newChatsDetected = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.matches) {
              if (
                node.matches(".ws-conversations-list-item") ||
                node.querySelector(".ws-conversations-list-item")
              ) {
                const chatElements = node.matches(".ws-conversations-list-item")
                  ? [node]
                  : node.querySelectorAll(".ws-conversations-list-item");

                chatElements.forEach((chatElement) => {
                  const chatName = this.getChatName(chatElement);

                  // Автоматически добавляем клиентские чаты
                  if (this.isClientChat(chatName)) {
                    this.autoAddClientChat({
                      element: chatElement,
                      name: chatName,
                    });
                    newChatsDetected = true;
                  }
                });
              }
            }
          });

          shouldUpdate = true;
          break;
        }

        if (mutation.type === "attributes") {
          const target = mutation.target;
          if (
            target.classList &&
            (target.classList.contains("ws-conversations-list-item") ||
              target.classList.contains("ws-conversations-list-item--badge") ||
              target.closest(".ws-conversations-list-item"))
          ) {
            shouldUpdate = true;
            break;
          }
        }
      }

      if ((shouldUpdate || newChatsDetected) && !updatePending) {
        updatePending = true;

        setTimeout(() => {
          this.updateFolderBadges();
          updatePending = false;
        }, 50);
      }
    });

    const chatList = document.querySelector(
      "#cnvs_root .ws-conversations-list--root",
    );
    if (chatList) {
      chatListObserver.observe(chatList, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style", "hidden", "data-*"],
      });

      this.chatListObserver = chatListObserver;
      this.updateFolderBadges();

      setTimeout(() => {
        const existingChats = chatList.querySelectorAll(
          ".ws-conversations-list-item",
        );
        existingChats.forEach((chatElement) => {
          const chatName = this.getChatName(chatElement);
          if (this.isClientChat(chatName)) {
            this.autoAddClientChat({
              element: chatElement,
              name: chatName,
            });
          }
        });
      }, 1000);
    }
  }

  // ==============================
  // ПЕРИОДИЧЕСКИЕ ОБНОВЛЕНИЯ
  // ==============================

  // Переодическое обновление счетчиков
  setupPeriodicUpdate() {
    if (this.periodUpdateInterval) {
      clearInterval(this.periodUpdateInterval);
    }

    this.periodUpdateInterval = setInterval(() => {
      if (this.state) {
        this.updateFolderBadges();
      }
    }, 3000);
  }

  isUserActive() {
    return Date.now() - (this.lastUserActivity || 0) < 30000;
  }

  // Проверка дом и принудительное обновление бейджей
  waitForDOMAndUpdateBadges() {
    const checkDom = () => {
      const chatList = document.querySelector(
        "#cnvs_root .ws-conversations-list--root",
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

  // ==============================
  // ОБРАБОТКА SPA (SINGLE PAGE APPLICATION)
  // ==============================

  // Работа с spa
  setupSPAObserver() {
    const targetNode = document.body;
    if (!targetNode) return;

    let reinitTimeout;
    let ignoreInitialLoad = true;

    setTimeout(() => {
      ignoreInitialLoad = false;
    }, 1000);

    const callback = (mutationsList) => {
      if (ignoreInitialLoad) return;

      for (let mutation of mutationsList) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          let hasChatElements = false;

          for (let node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (
                node.id === "cnvs_root" ||
                node.classList?.contains("ws-conversation-header") ||
                (node.querySelector &&
                  node.matches &&
                  (node.matches("#cnvs_root, .ws-conversations-header") ||
                    node.querySelector("#cnvs_root, .ws-conversations-header")))
              ) {
                hasChatElements = true;
                break;
              }
            }
          }

          if (hasChatElements && this.state) {
            clearTimeout(reinitTimeout);
            reinitTimeout = setTimeout(() => {
              this.reinitializeForSPA();
            }, 300);
            break;
          }
        }
      }
    };

    this.spaObserver = new MutationObserver(callback);
    this.spaObserver.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  reinitializeForSPA() {
    this.foldersInjected = false;

    this.removeFolders();
    this.cleanupOrphanedChats();

    setTimeout(() => {
      this.quickInjectFolders();
    }, 100);
  }

  quickInjectFolders() {
    const conversationsHeader = document.querySelector(
      ".ws-conversations-header",
    );
    const existingFolders = document.querySelector("[data-chat-folders]");

    if (existingFolders && this.foldersInjected) {
      this.updateFoldersDisplay();
      this.applySavedFolderQuick();
      return;
    }

    if (!conversationsHeader) {
      setTimeout(() => this.quickInjectFolders(), 50);
      return;
    }

    const folders = document.createElement("div");
    folders.setAttribute("data-chat-folders", "true");
    conversationsHeader.appendChild(folders);

    folders.innerHTML = window.foldersDataComponent(this.foldersData);

    const allFolders = folders.querySelectorAll(".folder");
    allFolders.forEach((folder, index) => {
      if (this.foldersData[index]) {
        folder.setAttribute("data-id", this.foldersData[index].id);
        folder.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectFolder(folder);
        });
      }
    });

    this.updateSelectedFolder();

    this.foldersInjected = true;

    setTimeout(() => {
      this.applySavedFolderQuick();
      this.updateFolderBadges();

      setTimeout(() => {
        if (!this.chatListObserver) {
          this.setupChatListObserver();
        }
      }, 200);
    }, 50);
  }

  applySavedFolderQuick() {
    if (!this.selectedFolderId || this.selectedFolderId === "all") {
      this.filterChatsByFolder("all");
      return;
    }

    const folderElement = document.querySelector(
      `.folder[data-id="${this.selectedFolderId}"]`,
    );

    if (folderElement) {
      document.querySelectorAll(".folder").forEach((f) => {
        f.removeAttribute("data-clicked");
      });

      folderElement.setAttribute("data-clicked", "true");

      this.filterChatsByFolder(this.selectedFolderId);
    } else {
      setTimeout(() => {
        const retryElement = document.querySelector(
          `.folder[data-id="${this.selectedFolderId}"]`,
        );
        if (retryElement) {
          this.applySavedFolderQuick();
        } else {
          this.selectedFolderId = "all";
          this.filterChatsByFolder("all");
          this.updateSelectedFolder();
        }
      }, 100);
    }
  }

  // Принудительная переинъекция папок
  forceReinjectFolders() {
    this.foldersInjected = false;
    this.removeFolders();

    this.injectFolders();

    setTimeout(() => {
      this.updateFolderBadges();
    }, 500);

    this.removeChatListObserver();
    setTimeout(() => {
      this.setupChatListObserver();
    }, 1000);

    setTimeout(() => {
      this.applySavedFolder();
    }, 1500);
  }

  // ==============================
  // РАБОТА С LOCAL STORAGE
  // ==============================

  // Загрузка сохраненной папки из storage
  async loadSelectedFolder() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["selectedFolderId"], (result) => {
        if (
          result.selectedFolderId &&
          this.isValidFolderId(result.selectedFolderId)
        ) {
          this.selectedFolderId = result.selectedFolderId;
        } else {
          this.selectedFolderId = "all";
        }
        resolve();
      });
    });
  }

  // Проверка, что ID существует
  isValidFolderId(folderId) {
    return this.foldersData.some((folder) => folder.id === folderId);
  }

  // Сохранение выбранной папки в сторадж
  saveSelectedFolder() {
    chrome.storage.local.set(
      { selectedFolderId: this.selectedFolderId },
      () => {},
    );
  }

  // Применение сохраненной папки после загрузки DOM
  async applySavedFolder() {
    if (this.selectedFolderId && this.selectedFolderId !== "all") {
      setTimeout(() => {
        const folderElement = document.querySelector(
          `.folder[data-id="${this.selectedFolderId}"]`,
        );

        if (folderElement) {
          this.updateSelectedFolder();
          this.filterChatsByFolder(this.selectedFolderId);
        } else {
          setTimeout(() => {
            const retryFolderElement = document.querySelector(
              `.folder[data-id="${this.selectedFolderId}"]`,
            );
            if (retryFolderElement) {
              this.updateSelectedFolder();
              this.filterChatsByFolder(this.selectedFolderId);
            } else {
              this.selectedFolderId = "all";
              this.updateSelectedFolder();
              this.filterChatsByFolder("all");
            }
          }, 100);
        }
      }, 500);
    } else {
      this.filterChatsByFolder("all");
    }
  }

  // ==============================
  // УВЕДОМЛЕНИЯ
  // ==============================

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

  // ==============================
  // ДОПОЛНИТЕЛЬНЫЙ МЕТОД ДЛЯ ПРОВЕРКИ И ВОССТАНОВЛЕНИЯ
  // ==============================

  checkAndRestoreFolders() {
    const existingFolders = document.querySelector("[data-chat-folders]");
    const conversationsHeader = document.querySelector(
      ".ws-conversations-header",
    );

    if (conversationsHeader && !existingFolders && this.state) {
      this.foldersInjected = false;
      this.injectFolders();
      return true;
    }
    return false;
  }

  // ==============================
  // ОЧИСТКА УСТАРЕВШИХ ЧАТОВ
  // ==============================
  cleanupOrphanedChats() {
    if (this.foldersData.length === 0) return;

    const allChatElements = document.querySelectorAll(
      ".ws-conversations-list-item",
    );
    const existingChatNames = new Set();

    allChatElements.forEach((chatElement) => {
      const chatName = this.getChatName(chatElement);
      existingChatNames.add(chatName);
    });

    let hasChanges = false;

    this.foldersData.forEach((folder) => {
      if (!folder.chats || folder.chats.length === 0) return;

      const initialLength = folder.chats.length;
      folder.chats = folder.chats.filter((chat) =>
        existingChatNames.has(chat.name),
      );

      if (folder.chats.length !== initialLength) {
        hasChanges = true;
      }
    });

    if (hasChanges) {
      this.saveFoldersData();
    }

    return hasChanges;
  }

  // ==============================
  // ОПРЕДЕЛЕНИЕ ТИПА ЧАТА
  // ==============================

  isClientChat(chatName) {
    const clientPattern = /^\d{6}\s+.+/;
    const sixDigitPattern = /\b\d{6}\b/;

    return clientPattern.test(chatName) || sixDigitPattern.test(chatName);
  }

  getChatType(chatName) {
    if (this.isClientChat(chatName)) {
      return "client";
    }
  }
}

// ==============================
// ИНИЦИАЛИЗАЦИЯ
// ==============================
window.chatsInstance = new Chats();
