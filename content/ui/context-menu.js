import { SELECTORS } from "../selectors.js";
import * as notifications from "./notifications.js";

function getExtMenuItem() {
  return document.querySelector(SELECTORS.extMenuItem);
}

function getExtContextMenu() {
  return document.querySelector(SELECTORS.extContextMenu);
}

export function removeContextMenuItem() {
  const menuItem = getExtMenuItem();
  if (menuItem) {
    menuItem.remove();
  }
}

export function removePreparedMenu(state) {
  if (state.preparedMenu && state.preparedMenu.parentNode) {
    state.preparedMenu.parentNode.removeChild(state.preparedMenu);
    state.preparedMenu = null;
  }
}

export function removeExtContextMenu(state) {
  const menu = getExtContextMenu();

  if (menu) {
    if (state.outsideClickHandler) {
      document.removeEventListener("click", state.outsideClickHandler, true);
      state.outsideClickHandler = null;
    }

    if (state.handleExtMenuItemClick && state.preparedMenu) {
      const menuItems = state.preparedMenu.querySelectorAll(
        ".context_menu__item",
      );
      menuItems.forEach((item) => {
        item.removeEventListener("click", state.handleExtMenuItemClick);
      });
    }

    if (state.preparedMenu) {
      state.preparedMenu.style.display = "none";
    }
  }
}

export function closeSiteContextMenu() {
  document.dispatchEvent(
    new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    }),
  );
}

export function closeAllMenus(state) {
  removeExtContextMenu(state);
  removeContextMenuItem();
  closeSiteContextMenu();
}

export function handleOutsideClick(state, e) {
  const contextMenu = getExtContextMenu();
  const extMenuItem = getExtMenuItem();

  if (
    contextMenu &&
    !contextMenu.contains(e.target) &&
    extMenuItem &&
    !extMenuItem.contains(e.target)
  ) {
    closeAllMenus(state);
  }
}

export function injectContextMenuItem(state, app) {
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
      console.error(
        "[context-menu] window.contextMenuComponent is not available",
      );
      return;
    }

    const menuItemHTML = window.contextMenuComponent();
    container.insertAdjacentHTML("beforeend", menuItemHTML);

    prepareExtContextMenu(state, app);
    addMenuItemListener(state, app);
  }
}

export function addMenuItemListener(state, app) {
  const menuItem = getExtMenuItem();

  if (!menuItem) return;

  menuItem.addEventListener("mouseenter", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const allMenuItems = document.querySelectorAll(".p-contextmenu-item");
    allMenuItems.forEach((item) => {
      item.classList?.remove("p-contextmenu-item-active");
      item.setAttribute("data-p-active", "false");
      item.setAttribute("data-p-focused", "false");
    });

    menuItem.classList?.add("p-contextmenu-item-active");
    menuItem.setAttribute("data-p-active", "true");
    menuItem.setAttribute("data-p-focused", "true");
    hideOtherSubmenus(state);

    injectExtContextMenu(state, app);
  });

  menuItem.addEventListener("mouseleave", (e) => {
    e.preventDefault();
    e.stopPropagation();

    setTimeout(() => {
      const currentMenuItem = getExtMenuItem();
      const contextMenu = getExtContextMenu();

      if (
        currentMenuItem &&
        !currentMenuItem.matches(":hover") &&
        contextMenu &&
        !contextMenu.matches(":hover")
      ) {
        restoreOtherSubmenus(state);
        removeExtContextMenu(state);
        currentMenuItem.classList?.remove("p-contextmenu-item-active");
        currentMenuItem.setAttribute("data-p-active", "false");
        currentMenuItem.setAttribute("data-p-focused", "false");
      }
    }, 150);
  });
}

//

export function prepareExtContextMenu(state, app) {
  const existingMenu = getExtContextMenu();
  if (existingMenu) {
    existingMenu.remove();
  }

  const chatInfo =
    typeof app.getSelectedChat === "function" ? app.getSelectedChat() : null;

  const visibleFolders = state.foldersData
    .slice(1)
    .filter((folder) => !folder.hidden);

  if (typeof window.extContextMenuComponent !== "function") {
    console.error(
      "[context-menu] window.extContextMenuComponent is not available",
    );
    return;
  }

  const menuHTML = window.extContextMenuComponent(
    visibleFolders,
    chatInfo,
    state.foldersData,
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

export function injectExtContextMenu(state, app) {
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

export function updateContextMenuAfterAction(state, app) {
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

export function handleMenuItemClick(state, app, e) {
  e.preventDefault();
  e.stopPropagation();

  const menuItem = e.currentTarget;
  const folderId = menuItem.getAttribute("data-folder-id");
  const action = menuItem.getAttribute("data-action");

  const chatInfo =
    typeof app.getSelectedChat === "function" ? app.getSelectedChat() : null;

  if (chatInfo) {
    let success = false;
    let message = "";

    if (action === "add") {
      success =
        typeof app.addChatToFolder === "function"
          ? app.addChatToFolder(chatInfo, folderId)
          : false;
      message = "Чат добавлен в папку";
    } else if (action === "remove") {
      success =
        typeof app.removeChatFromFolder === "function"
          ? app.removeChatFromFolder(chatInfo, folderId)
          : false;
      message = "Чат удален из папки";
    }

    if (success) {
      notifications.showNotification(message);

      if (typeof app.updateFoldersDisplay === "function") {
        app.updateFoldersDisplay();
      }

      updateContextMenuAfterAction(state, app);
    }
  }

  closeAllMenus(state);
}

export function setupExtContextMenuListeners(
  state,
  app,
  menu = state.preparedMenu,
) {
  if (!menu) return;

  menu.addEventListener("mouseenter", () => {});

  menu.addEventListener("mouseleave", () => {
    setTimeout(() => {
      const menuItem = getExtMenuItem();
      const contextMenu = getExtContextMenu();

      if (
        menuItem &&
        !menuItem.matches(":hover") &&
        contextMenu &&
        !contextMenu.matches(":hover")
      ) {
        restoreOtherSubmenus(state);
        removeExtContextMenu(state);
        menuItem.classList?.remove("p-contextmenu-item-active");
        currentMenuItem.setAttribute("data-p-active", "false");
        currentMenuItem.setAttribute("data-p-focused", "false");
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

export function setupRightClickHandler(state, app) {
  state.rightClickHandler = (e) => {
    const chatItem = e.target.closest(SELECTORS.chatItem);

    if (chatItem) {
      state.lastRightClickedChat = {
        element: chatItem,
        name:
          typeof app.getChatName === "function"
            ? app.getChatName(chatItem)
            : "Без названия",
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

export function removeRightClickHandler(state) {
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

function hideOtherSubmenus(state) {
  const submenus = document.querySelectorAll('[data-pc-section="submenu"]');

  state.hiddenSubmenus = [];

  submenus.forEach((submenu) => {
    // не трогаем своё меню
    if (submenu.closest(SELECTORS.extMenuItem)) return;

    // сохраняем предыдущее состояние
    state.hiddenSubmenus.push({
      element: submenu,
      display: submenu.style.display,
    });

    submenu.style.display = "none";
  });
}

function restoreOtherSubmenus(state) {
  if (!state.hiddenSubmenus) return;

  state.hiddenSubmenus.forEach(({ element, display }) => {
    element.style.display = display || "";
  });

  state.hiddenSubmenus = [];
}
