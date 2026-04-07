export const SELECTORS = {
  header: ".ws-conversations-header",
  chatListRoot: "#cnvs_root .ws-conversations-list--root",
  chatItem: ".ws-conversations-list-item",
  chatItemListElement: "#cnvs_root .ws-conversations-list--root li",
  chatItemName: ".ws-conversations-list-item--info--name",
  chatBadge: ".ws-conversations-list-item .ws-conversations-list-item--badge",
  visibleChatBadge:
    ".ws-conversations-list-item .ws-conversations-list-item--badge:not([style*='display: none']), " +
    ".ws-conversations-list-item .ws-conversations-list-item--badge:not([hidden])",

  siteContextMenuRoot: "#cnv_context_menu",
  siteContextMenuList: ".p-contextmenu-root-list",

  foldersRoot: "[data-chat-folders]",
  extMenuItem: '[data-ext-menu="true"]',
  extContextMenu: ".context_menu",
  folder: ".folder",
  noChatsMessage: ".ext-no-chats-message",

  stylesId: "#chat-extension-styles",
};
