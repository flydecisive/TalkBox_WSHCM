import { getCurrentChatKey } from "../pins/pin-utils.js";

export function setupPinChatObserver(state, app) {
  removePinChatObserver(state);

  state.lastObservedChatKey = getCurrentChatKey();

  if (typeof app.updatePinsBar === "function") {
    setTimeout(() => {
      app.updatePinsBar();
    }, 300);
  }

  state.pinChatObserverInterval = setInterval(async () => {
    if (!state.isEnabled) return;

    const currentChatKey = getCurrentChatKey();
    if (!currentChatKey) return;

    if (state.lastObservedChatKey !== currentChatKey) {
      state.lastObservedChatKey = currentChatKey;

      if (typeof app.removePinsBar === "function") {
        app.removePinsBar();
      }

      if (typeof app.updatePinsBar === "function") {
        await app.updatePinsBar();
      }
    }
  }, 500);
}

export function removePinChatObserver(state) {
  if (state.pinChatObserverInterval) {
    clearInterval(state.pinChatObserverInterval);
    state.pinChatObserverInterval = null;
  }
}
