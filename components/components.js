window.folderComponent = (folderData) => {
  if (folderData.hidden) return "";

  const unreadCount = folderData.unreadCount || 0;
  const badgeText = unreadCount > 9 ? "9+" : unreadCount.toString();
  const badgeVisible = unreadCount > 0 ? "" : 'style="display: none;"';

  if (unreadCount <= 0) {
    return `
      <div class='folder' data-id="${folderData.id}">
        <div class='folder__text'>${folderData.name}</div>
      </div>
    `;
  }

  return `
    <div class='folder' data-id="${folderData.id}">
      <div class='folder__badge' ${badgeVisible}>${badgeText}</div>
      <div class='folder__text'>${folderData.name}</div>
    </div>
  `;
};

window.folderComponentPopup = (folderData) => {
  const hiddenIcon = folderData.hidden ? "👁️‍🗨️" : "👀";

  return `
      <div class='folder' data-id="${folderData.id}">
        <div class='folder__text'>${folderData.name}</div>
        <div class='folder__drag' draggable='true'>|||</div>
        <div class='folder__hide' data-action="toggleHide">${hiddenIcon}</div>
      </div>
    `;
};

window.foldersDataComponent = (foldersData) => {
  if (foldersData.length === 0) {
    return '<div class="folders__data">Папок нет</div>';
  }

  return `
    <div class='folders__data'>
      ${foldersData.map(window.folderComponent).join("")}
    </div>
  `;
};

window.foldersDataComponentPopup = (foldersData) => {
  if (foldersData.length === 0) {
    return '<div class="folders__data">Папок нет</div>';
  }

  return `
    <div class='folders__data'>
      ${foldersData.map(window.folderComponentPopup).join("")}
    </div>
  `;
};

window.contextMenuComponent = () => {
  return `
    <li
      id="cnv_context_menu_5"
      class="p-menuitem"
      role="menuitem"
      aria-label="Пометить флажком"
      aria-level="1"
      aria-setsize="2"
      aria-posinset="5"
      data-pc-section="menuitem"
      data-p-highlight="false"
      data-p-focused="false"
      data-ext-menu="true"
    >
      <div class="p-menuitem-content" data-pc-section="content">
        <a class="p-menuitem-link">
          <div class="ws-icon p-menuitem-icon" ws-size="small">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
              <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></g>
              <g id="SVGRepo_iconCarrier">
                <path
                  d="M6 3H8C8.69805 3.00421 9.38286 3.19101 9.98634 3.54187C10.5898 3.89273 11.091 4.39545 11.44 5C11.797 5.60635 12.3055 6.10947 12.9156 6.46008C13.5256 6.8107 14.2164 6.99678 14.92 7H18C19.0609 7 20.0783 7.42136 20.8284 8.17151C21.5786 8.92165 22 9.93913 22 11V17C22 18.0609 21.5786 19.0782 20.8284 19.8284C20.0783 20.5785 19.0609 21 18 21H6C4.93913 21 3.92172 20.5785 3.17157 19.8284C2.42142 19.0782 2 18.0609 2 17V7C2 5.93913 2.42142 4.92165 3.17157 4.17151C3.92172 3.42136 4.93913 3 6 3Z"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></path>
              </g>
            </svg>
          </div>
          <span class="p-menuitem-text">Добавить в папку</span>
        </a>
      </div>
      <!---->
    </li>
  `;
};

window.extContextMenuItem = (folder, chatInfo, foldersData) => {
  if (folder.hidden) return "";

  let isInFolder = false;
  if (chatInfo && chatInfo.name && foldersData) {
    const folderData = foldersData.find((f) => f.id === folder.id);
    if (folderData && folderData.chats) {
      isInFolder = folderData.chats.some((chat) => chat.name === chatInfo.name);
    }
  }

  return `
    <li class='context_menu__item' data-folder-id='${folder.id}' data-action='${
      isInFolder ? "remove" : "add"
    }'>
      <div class='context_menu__item_status ${
        !isInFolder ? "context_menu__item_status--transparent" : ""
      }'>
        
      </div>
      <p>${folder.name}</p>
    </li>
  `;
};

window.extContextMenuComponent = (foldersData, chatInfo) => {
  return `
    <ul class="context_menu">
      ${foldersData
        .map((folder) => {
          return extContextMenuItem(folder, chatInfo, foldersData);
        })
        .join("")}
     </ul>
  `;
};
