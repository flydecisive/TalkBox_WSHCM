import { createState } from "./state.js";
import * as storage from "./storage.js";
import * as foldersUI from "./ui/folders-ui.js";
import * as chatUtils from "./chats/chat-utils.js";
import * as folderActions from "./chats/folder-actions.js";
import * as filtering from "./chats/filtering.js";
import * as restore from "./restore.js";
import * as chatListObserver from "./observers/chat-list-observer.js";
import * as contextMenu from "./ui/context-menu.js";
import * as badges from "./chats/badges.js";
import * as runtimeListeners from "./runtime-listeners.js";
import * as spaWatchdog from "./observers/spa-watchdog.js";
import * as cleanup from "./chats/cleanup.js";
import * as pinStorage from "./pins/pin-storage.js";
import * as pinUI from "./pins/pin-ui.js";
import * as pinContextMenu from "./pins/pin-context-menu.js";
import * as pinUtils from "./pins/pin-utils.js";
import * as pinChatObserver from "./observers/pin-chat-observer.js";
import * as pinCleanup from "./pins/pin-cleanup.js";

export class ChatsApp {
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
      await foldersUI.loadCSS();

      this.state.isEnabled = await storage.getEnabledState();
      this.state.foldersData = await storage.getFoldersData();

      const savedFolderId = await storage.loadSelectedFolder();
      this.state.selectedFolderId = storage.isValidFolderId(
        savedFolderId,
        this.state.foldersData,
      )
        ? savedFolderId
        : "all";

      this.setupRuntimeListeners();
      this.applyState();

      console.log("[ChatsApp] initialized", {
        isEnabled: this.state.isEnabled,
        foldersCount: this.state.foldersData.length,
        selectedFolderId: this.state.selectedFolderId,
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

        this.setupPinContextMenu();
        this.updatePinsBar();
        this.setupPinChatObserver();
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

    this.removePinContextMenu();
    this.removePinsBar();

    this.removePinChatObserver();

    if (this.state.updateBadgesTimeout) {
      clearTimeout(this.state.updateBadgesTimeout);
      this.state.updateBadgesTimeout = null;
    }
  }

  setupRuntimeListeners() {
    runtimeListeners.setupRuntimeListeners(this.state, this);
  }

  removeRuntimeListeners() {
    runtimeListeners.removeRuntimeListeners(this.state);
  }

  async saveSelectedFolder(folderId) {
    this.state.selectedFolderId = folderId;
    await storage.saveSelectedFolder(folderId);
  }

  async saveFoldersData() {
    return storage.saveFoldersData(this.state.foldersData);
  }

  validateFoldersData(folders) {
    return storage.validateFoldersData(folders);
  }

  removeFolders() {
    foldersUI.removeFolders(this.state);
  }

  injectFolders() {
    foldersUI.injectFolders(this.state, this);
  }

  updateFoldersDisplay() {
    foldersUI.updateFoldersDisplay(this.state, this);
  }

  updateSelectedFolder() {
    foldersUI.updateSelectedFolder(this.state);
  }

  applySavedFolderQuick() {
    restore.applySavedFolderQuick(this.state, this);
  }

  setupChatListObserver() {
    chatListObserver.setupChatListObserver(this.state, this);
  }

  removeChatListObserver() {
    chatListObserver.removeChatListObserver(this.state);
  }

  setupRightClickHandler() {
    contextMenu.setupRightClickHandler(this.state, this);
  }

  removeRightClickHandler() {
    contextMenu.removeRightClickHandler(this.state);
  }

  removeContextMenuItem() {
    contextMenu.removeContextMenuItem();
  }

  removeExtContextMenu() {
    contextMenu.removeExtContextMenu(this.state);
  }

  closeAllMenus() {
    contextMenu.closeAllMenus(this.state);
  }

  getSelectedChat() {
    return chatUtils.getSelectedChat(this.state);
  }

  getChatName(chatElem) {
    return chatUtils.getChatName(chatElem);
  }

  isClientChat(chatName) {
    return chatUtils.isClientChat(chatName);
  }

  isUserActive() {
    return chatUtils.isUserActive(this.state);
  }

  addChatToFolder(chatInfo, folderId) {
    return folderActions.addChatToFolder(this.state, this, chatInfo, folderId);
  }

  autoAddClientChat(chatInfo) {
    return folderActions.autoAddClientChat(this.state, this, chatInfo);
  }

  removeChatFromFolder(chatInfo, folderId) {
    return folderActions.removeChatFromFolder(
      this.state,
      this,
      chatInfo,
      folderId,
    );
  }

  isChatInFolder(chatInfo, folderId) {
    return folderActions.isChatInFolder(this.state, chatInfo, folderId);
  }

  filterChatsByFolder(folderId) {
    return filtering.filterChatsByFolder(this.state, this, folderId);
  }

  showNoChatsMessage(folderName) {
    return filtering.showNoChatsMessage(this.state, folderName);
  }

  removeNoChatsMessage() {
    return filtering.removeNoChatsMessage(this.state);
  }

  getTotalUnreadCount() {
    return badges.getTotalUnreadCount();
  }

  getUnreadCountForSpecificFolder(folder) {
    return badges.getUnreadCountForSpecificFolder(this.state, this, folder);
  }

  getUnreadCountForFolder(folderId) {
    return badges.getUnreadCountForFolder(this.state, this, folderId);
  }

  updateFolderBadges() {
    return badges.updateFolderBadges(this.state, this);
  }

  waitForDOMAndUpdateBadges() {
    return badges.waitForDOMAndUpdateBadges(this.state, this);
  }

  setupSPAObserver() {
    spaWatchdog.setupSPAObserver(this.state, this);
  }

  removeSPAObserver() {
    spaWatchdog.removeSPAObserver(this.state);
  }

  setupSPAWatchdog() {
    spaWatchdog.setupSPAWatchdog(this.state, this);
  }

  removeSPAWatchdog() {
    spaWatchdog.removeSPAWatchdog(this.state);
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

    this.removePinContextMenu();
    this.removePinsBar();
    this.removePinChatObserver();

    setTimeout(() => {
      this.applySavedFolderQuick();
      this.setupChatListObserver();
      this.setupRightClickHandler();
      this.waitForDOMAndUpdateBadges();

      this.setupPinContextMenu();
      this.updatePinsBar();
      this.setupPinChatObserver();
    }, 150);
  }

  cleanupOrphanedChatsSoft() {
    return cleanup.cleanupOrphanedChatsSoft(this.state, this);
  }

  resetOrphanTracking() {
    return cleanup.resetOrphanTracking(this.state);
  }

  getCurrentChatKey() {
    return pinUtils.getCurrentChatKey();
  }

  async addPinnedMessage(chatKey, pin) {
    const result = await pinStorage.addPinnedMessage(chatKey, pin);
    await this.updatePinsBar();
    return result;
  }

  async removePinnedMessage(chatKey, messageId) {
    const result = await pinStorage.removePinnedMessage(chatKey, messageId);
    await this.updatePinsBar();
    return result;
  }

  async updatePinsBar() {
    return pinUI.updatePinsBar(this.state, this);
  }

  removePinsBar() {
    return pinUI.removePinsBar();
  }

  setupPinContextMenu() {
    pinContextMenu.setupPinContextMenu(this.state, this);
  }

  removePinContextMenu() {
    pinContextMenu.removePinContextMenu(this.state);
  }

  setupPinChatObserver() {
    pinChatObserver.setupPinChatObserver(this.state, this);
  }

  removePinChatObserver() {
    pinChatObserver.removePinChatObserver(this.state);
  }

  async markVisiblePinnedChatsAsSeen() {
    return pinCleanup.markVisibleChatsAsSeen();
  }

  async cleanupOldPinnedChats() {
    return pinCleanup.cleanupOldPinnedChats();
  }

  async lockPinnedChat(chatKey) {
    const result = await pinStorage.lockPinnedChat(chatKey);
    await this.updatePinsBar();
    return result;
  }

  async unlockPinnedChat(chatKey) {
    const result = await pinStorage.unlockPinnedChat(chatKey);
    await this.updatePinsBar();
    return result;
  }

  async isPinnedChatLocked(chatKey) {
    return pinStorage.isPinnedChatLocked(chatKey);
  }
}
