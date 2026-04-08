import * as pinStorage from "./pin-storage.js";
import * as pinScroll from "./pin-scroll.js";
import * as pinModal from "./pin-modal.js";
import { getCurrentChatKey } from "./pin-utils.js";

const PINS_BAR_SELECTOR = "[data-ext-pins-bar]";

function getPinsMountPoint() {
  return document.querySelector(".ws-conversation--messages-container");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPinsBar(latestPin, pins) {
  const isLocked = pins.some((pin) => pin.isLocked === true);

  return `
    <div class="ext-pins-bar" data-ext-pins-bar="true">
      <div class="ext-pins-bar__main">
        <div class="ext-pins-bar__content" data-action="scrollToLatest">
          <div class="ext-pins-bar__label">
            Закрепленное сообщение
            ${
              isLocked
                ? '<span class="ext-pins-bar__lock-badge">🔒 не удалять</span>'
                : ""
            }
          </div>
          <div class="ext-pins-bar__text">${escapeHtml(latestPin.text || "Без текста")}</div>
        </div>

        <div class="ext-pins-bar__actions">
          <button
            class="ext-pins-bar__icon-btn"
            data-action="toggleLock"
            title="${isLocked ? "Разрешить автоочистку" : "Никогда не удалять закрепы этого чата"}"
          >
            ${isLocked ? "🔒" : "🔓"}
          </button>

          <button class="ext-pins-bar__btn" data-action="openAll">
            Все (${pins.length})
          </button>

          <button
            class="ext-pins-bar__icon-btn"
            data-action="removeLatest"
            title="Удалить закреп"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  `;
}

async function tryRenderPinsBar(state, app, retryCount = 0) {
  const chatKey = getCurrentChatKey();
  if (!chatKey) {
    removePinsBar();
    return;
  }

  const pins = await pinStorage.getPinnedMessagesByChat(chatKey);

  if (!pins.length) {
    removePinsBar();
    return;
  }

  const latestPin = pins[pins.length - 1];
  const mountPoint = getPinsMountPoint();

  if (!mountPoint) {
    if (retryCount < 20) {
      setTimeout(() => {
        tryRenderPinsBar(state, app, retryCount + 1);
      }, 250);
    }
    return;
  }

  const computedPosition = window.getComputedStyle(mountPoint).position;
  if (computedPosition === "static") {
    mountPoint.style.position = "relative";
  }

  const existing = document.querySelector(PINS_BAR_SELECTOR);

  if (existing) {
    existing.outerHTML = renderPinsBar(latestPin, pins);
  } else {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderPinsBar(latestPin, pins);
    mountPoint.prepend(wrapper.firstElementChild);
  }

  mountPoint.classList.add("ext-pins-mounted");

  bindPinsBarEvents(state, app, chatKey, pins);
}

export async function updatePinsBar(state, app) {
  return tryRenderPinsBar(state, app, 0);
}

export function removePinsBar() {
  const existing = document.querySelector(PINS_BAR_SELECTOR);
  if (existing) {
    existing.remove();
  }

  const mountPoint = getPinsMountPoint();
  if (mountPoint) {
    mountPoint.classList.remove("ext-pins-mounted");
  }
}

function bindPinsBarEvents(state, app, chatKey, pins) {
  const bar = document.querySelector(PINS_BAR_SELECTOR);
  if (!bar) return;

  bar.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();

      const action = el.getAttribute("data-action");

      if (action === "scrollToLatest") {
        const latest = pins[pins.length - 1];
        pinScroll.scrollToPinnedMessage(latest.messageId);
        return;
      }

      if (action === "openAll") {
        pinModal.openPinsModal(state, app, pins, chatKey);
        return;
      }

      if (action === "toggleLock") {
        const isLocked = pins.some((pin) => pin.isLocked === true);

        if (isLocked) {
          await app.unlockPinnedChat(chatKey);
        } else {
          await app.lockPinnedChat(chatKey);
        }

        await app.updatePinsBar();
        return;
      }

      if (action === "removeLatest") {
        const latest = pins[pins.length - 1];
        await app.removePinnedMessage(chatKey, latest.messageId);
        await app.updatePinsBar();
      }
    });
  });
}
