import { SELECTORS } from "../selectors.js";

export function getSelectedChat(state) {
  if (state.lastRightClickedChat) {
    return state.lastRightClickedChat;
  }

  return null;
}

export function getChatName(chatElem) {
  const chatName = chatElem.querySelector(SELECTORS.chatItemName);

  if (chatName) {
    return chatName.textContent.trim().replace(/[<>]/g, "").substring(0, 100);
  }

  return "Без названия";
}

export function isClientChat(chatName) {
  if (!chatName || typeof chatName !== "string") return false;

  const clientPattern = /^\d{6}\s+.+/;
  const sixDigitPattern = /\b\d{6}\b/;

  return clientPattern.test(chatName) || sixDigitPattern.test(chatName);
}

export function isUserActive(state) {
  const now = Date.now();
  return now - state.lastUserActivity < 5000;
}
