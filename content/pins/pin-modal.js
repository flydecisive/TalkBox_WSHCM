import * as pinScroll from "./pin-scroll.js";

const MODAL_SELECTOR = "[data-ext-pins-modal]";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderModal(pins) {
  const isLocked = pins.some((pin) => pin.isLocked === true);

  return `
    <div class="ext-pins-modal" data-ext-pins-modal="true">
      <div class="ext-pins-modal__backdrop" data-action="closeModal"></div>
      <div class="ext-pins-modal__dialog">
        <div class="ext-pins-modal__header">
          <div class="ext-pins-modal__title">
            Все закрепленные сообщения
            ${
              isLocked
                ? '<span class="ext-pins-modal__lock-badge">🔒 автоочистка выключена</span>'
                : ""
            }
          </div>

          <div class="ext-pins-modal__header-actions">
            <button
              class="ext-pins-modal__lock"
              data-action="toggleLock"
              title="${isLocked ? "Разрешить автоочистку" : "Никогда не удалять закрепы этого чата"}"
            >
              ${isLocked ? "🔒" : "🔓"}
            </button>

            <button class="ext-pins-modal__close" data-action="closeModal">×</button>
          </div>
        </div>

        <div class="ext-pins-modal__list">
          ${pins
            .slice()
            .reverse()
            .map(
              (pin) => `
                <div class="ext-pins-modal__item" data-message-id="${pin.messageId}">
                  <div class="ext-pins-modal__text" data-action="scrollToItem">
                    ${escapeHtml(pin.text || "Без текста")}
                  </div>
                  <button
                    class="ext-pins-modal__remove"
                    data-action="removeItem"
                    data-message-id="${pin.messageId}"
                    title="Удалить закреп"
                  >
                    ×
                  </button>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    </div>
  `;
}

export function openPinsModal(state, app, pins, chatKey) {
  closePinsModal(state);

  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderModal(pins);
  document.body.appendChild(wrapper.firstElementChild);

  state.pinsModalOpen = true;

  const modal = document.querySelector(MODAL_SELECTOR);
  if (!modal) return;

  modal.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();

      const action = el.getAttribute("data-action");

      if (action === "closeModal") {
        closePinsModal(state);
        return;
      }

      if (action === "scrollToItem") {
        const item = el.closest("[data-message-id]");
        const messageId = item?.getAttribute("data-message-id");
        if (messageId) {
          pinScroll.scrollToPinnedMessage(messageId);
          closePinsModal(state);
        }
        return;
      }

      if (action === "removeItem") {
        const messageId = el.getAttribute("data-message-id");
        if (messageId) {
          await app.removePinnedMessage(chatKey, messageId);
          await app.removePinnedMessage(chatKey, messageId);
          closePinsModal(state);
          await app.updatePinsBar();
        }
      }

      if (action === "toggleLock") {
        const isLocked = pins.some((pin) => pin.isLocked === true);

        if (isLocked) {
          await app.unlockPinnedChat(chatKey);
        } else {
          await app.lockPinnedChat(chatKey);
        }

        closePinsModal(state);
        await app.updatePinsBar();
        return;
      }
    });
  });
}

export function closePinsModal(state) {
  const modal = document.querySelector(MODAL_SELECTOR);
  if (modal) {
    modal.remove();
  }
  state.pinsModalOpen = false;
}
