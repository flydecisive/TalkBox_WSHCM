export function createState() {
  return {
    isEnabled: true,

    foldersData: [],
    selectedFolderId: "all",

    lastRightClickedChat: null,
    preparedMenu: null,

    rightClickHandler: null,
    chatClickHandler: null,
    outsideClickHandler: null,
    handleExtMenuItemClick: null,
    runtimeMessageHandler: null,

    chatListObserver: null,
    spaObserver: null,
    periodUpdateInterval: null,

    foldersInjected: false,
    updateBadgesTimeout: null,

    lastUserActivity: Date.now(),
    noChatsMessage: null,

    orphanMissCounts: new Map(),

    pinContextHandler: null,
    lastRightClickedMessage: null,

    pinChatObserverInterval: null,
    lastObservedChatKey: null,
    pinsModalOpen: false,
  };
}
