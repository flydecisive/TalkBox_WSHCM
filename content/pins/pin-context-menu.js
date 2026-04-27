import * as pinStorage from "./pin-storage.js";
import * as pinUtils from "./pin-utils.js";

function getMessageContextMenuRoot() {
  return document.querySelector(".ws-context-menu-msg");
}

function getMessageContextMenuList(root) {
  return root?.querySelector("ul") || null;
}

function createPinMenuItem(isPinned) {
  return `
    <li
      class="p-contextmenu-item"
      data-ext-pin-menu="true"
      role="menuitem"
      aria-label="${isPinned ? "Открепить сообщение" : "Закрепить сообщение"}"
      data-p-highlight="false"
      data-p-focused="false"
    >
      <div class="p-contextmenu-item-content">
        <a class="p-contextmenu-item-link">
          <span class="p-contextmenu-item-label">
            ${isPinned ? "Открепить сообщение" : "Закрепить сообщение"}
          </span>
        </a>
      </div>
    </li>
  `;
}

function setupPinMenuItemHover(item) {
  if (!item) return;

  item.addEventListener("mouseenter", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const allMenuItems = document.querySelectorAll(".p-contextmenu-item");
    allMenuItems.forEach((menuItem) => {
      menuItem.classList?.remove("p-focus");
      menuItem.setAttribute?.("data-p-focused", "false");
    });

    item.classList?.add("p-focus");
    item.setAttribute?.("data-p-focused", "true");
  });

  item.addEventListener("mouseleave", () => {
    item.classList?.remove("p-focus");
    item.setAttribute?.("data-p-focused", "false");
  });
}

function closeSiteContextMenu() {
  document.dispatchEvent(
    new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
    }),
  );
}

async function tryInjectPinMenu(messageInfo, app, attempt = 0) {
  const root = getMessageContextMenuRoot();
  const list = getMessageContextMenuList(root);

  if (!root || !list) {
    if (attempt < 15) {
      setTimeout(() => {
        tryInjectPinMenu(messageInfo, app, attempt + 1);
      }, 60);
    }
    return;
  }

  const oldItem = list.querySelector('[data-ext-pin-menu="true"]');
  if (oldItem) {
    oldItem.remove();
  }

  const chatKey = pinUtils.getCurrentChatKey();
  if (!chatKey) {
    if (attempt < 15) {
      setTimeout(() => {
        tryInjectPinMenu(messageInfo, app, attempt + 1);
      }, 60);
    }
    return;
  }

  const isPinned = await pinStorage.isPinnedMessage(
    chatKey,
    messageInfo.messageId,
  );

  list.insertAdjacentHTML("beforeend", createPinMenuItem(isPinned));

  const item = list.querySelector('[data-ext-pin-menu="true"]');
  if (!item) return;

  setupPinMenuItemHover(item);

  item.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const pin = pinUtils.buildPinFromMessage(messageInfo.msgRoot);
      if (!pin) return;

      if (isPinned) {
        await app.removePinnedMessage(chatKey, messageInfo.messageId);
      } else {
        await app.addPinnedMessage(chatKey, pin);
      }

      await app.updatePinsBar();
      closeSiteContextMenu();
    },
    { once: true },
  );
}

export function setupPinContextMenu(state, app) {
  if (state.pinContextHandler) {
    document.removeEventListener("contextmenu", state.pinContextHandler, true);
  }

  state.pinContextHandler = (e) => {
    const messageInfo = pinUtils.getMessageElementFromTarget(e.target);

    if (!messageInfo) {
      state.lastRightClickedMessage = null;
      return;
    }

    state.lastRightClickedMessage = messageInfo;

    setTimeout(() => {
      tryInjectPinMenu(messageInfo, app, 0);
    }, 30);
  };

  document.addEventListener("contextmenu", state.pinContextHandler, true);
}

export function removePinContextMenu(state) {
  if (state.pinContextHandler) {
    document.removeEventListener("contextmenu", state.pinContextHandler, true);
    state.pinContextHandler = null;
  }
}
