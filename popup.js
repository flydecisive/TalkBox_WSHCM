document.addEventListener("DOMContentLoaded", async function () {
  const SYSTEM_FOLDER_IDS = new Set([
    "all",
    "private",
    "clients",
    "others",
    "archive",
    "favorites",
  ]);

  function isSystemFolder(folderId) {
    return SYSTEM_FOLDER_IDS.has(folderId);
  }

  function generateFolderId(name) {
    const normalized = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30);

    const base = normalized || "folder";
    return `user-${base}-${Date.now()}`;
  }

  function getVisiblePopupFolders() {
    return currentFoldersData.filter((folder) => folder.id !== "all");
  }

  async function persistFolders() {
    const response = await chrome.runtime.sendMessage({
      action: "updateFolders",
      folders: currentFoldersData,
    });

    return response;
  }

  let currentFoldersData = [];
  const defaultFoldersData = [
    { id: "all", name: "Все", chats: [], hidden: false },
    { id: "private", name: "Личные", chats: [], hidden: false },
    { id: "clients", name: "Клиенты", chats: [], hidden: false },
    { id: "others", name: "Другое", chats: [], hidden: false },
    { id: "archive", name: "Архив", chats: [], hidden: false },
    { id: "favorites", name: "Избранное", chats: [], hidden: false },
  ];

  chrome.storage.local.get(["folders_data"], async (result) => {
    if (result.folders_data && result.folders_data.length > 0) {
      currentFoldersData = result.folders_data;
    } else {
      currentFoldersData = defaultFoldersData;
      await chrome.storage.local.set({ folders_data: defaultFoldersData });
    }

    initInterface();
  });

  const switchContainer = document.querySelector(".switch_container");
  const toggle = document.getElementById("toggleExtension");
  const status = document.createElement("div");
  status.classList.add("status");
  switchContainer.insertAdjacentElement("afterend", status);
  const foldersContainer = document.querySelector(".popup_folders");
  const addFolderButton = document.getElementById("addFolderButton");

  async function initInterface() {
    const response = await chrome.runtime.sendMessage({ action: "getState" });
    toggle.checked = response.isEnabled;

    const foldersResponse = await chrome.runtime.sendMessage({
      action: "getFolders",
    });

    if (foldersResponse?.folders) {
      currentFoldersData = foldersResponse.folders;
    }

    updateStatus(response.isEnabled);

    setupAddFolderHandler();

    toggle.addEventListener("change", async function () {
      const isEnabled = this.checked;

      const response = await chrome.runtime.sendMessage({
        action: "setState",
        isEnabled: isEnabled,
      });

      if (response.success) {
        updateStatus(isEnabled);
      }
    });
  }

  function updateStatus(isEnabled) {
    status.textContent = isEnabled ? "✅ Включено" : "❌ Выключено";
    status.style.color = isEnabled ? "green" : "red";

    if (isEnabled) {
      renderFolders();
    } else {
      foldersContainer.innerHTML = "";
    }
  }

  function renderFolders() {
    const allFolders = getVisiblePopupFolders();

    foldersContainer.innerHTML = window.foldersDataComponentPopup(allFolders);
    addAttributesForFolders();
    setupDragAndDrop();
    handleFolderEdit();
    setupHideToggleHandlers();
    setupDeleteFolderHandlers();
  }

  function setupHideToggleHandlers() {
    const hideButtons = document.querySelectorAll(
      '.folder__hide[data-action="toggleHide"]',
    );

    hideButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();

        const folderElement = button.closest(".folder");
        const folderId = folderElement.getAttribute("data-id");

        const folderIndex = currentFoldersData.findIndex(
          (f) => f.id === folderId,
        );

        if (folderIndex !== -1) {
          currentFoldersData[folderIndex].hidden =
            !currentFoldersData[folderIndex].hidden;

          try {
            const response = await chrome.runtime.sendMessage({
              action: "updateFolders",
              folders: currentFoldersData,
            });

            if (response.success) {
              button.textContent = currentFoldersData[folderIndex].hidden
                ? "👁️‍🗨️"
                : "👀";
            }
          } catch (error) {
            console.error("Error saving hide state: ", error);
          }
        }
      });
    });
  }

  function setupDeleteFolderHandlers() {
    const deleteButtons = document.querySelectorAll(
      '.folder__delete[data-action="deleteFolder"]',
    );

    deleteButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();

        const folderElement = button.closest(".folder");
        const folderId = folderElement?.getAttribute("data-id");

        if (!folderId || isSystemFolder(folderId)) {
          return;
        }

        const folder = currentFoldersData.find((f) => f.id === folderId);
        if (!folder) {
          return;
        }

        const confirmed = confirm(
          `Удалить папку "${folder.name}"? Чаты из системы не удалятся, только связь с папкой.`,
        );

        if (!confirmed) {
          return;
        }

        currentFoldersData = currentFoldersData.filter(
          (f) => f.id !== folderId,
        );

        try {
          const response = await persistFolders();
          if (response?.success) {
            renderFolders();
          }
        } catch (error) {
          console.error("Error deleting folder:", error);
        }
      });
    });
  }

  function addAttributesForFolders() {
    const folders = getAllFolders();
    folders.forEach((folder, index) => {
      const folderText = folder.querySelector(".folder__text");
      folderText.setAttribute("contenteditable", "true");
      folderText.setAttribute("maxlength", "30");
      folder.setAttribute("data-id", currentFoldersData[index + 1].id);
      folder.setAttribute("data-index", index + 1);
    });
  }

  function getAllFolders() {
    return document.querySelectorAll(".folder");
  }

  function setupDragAndDrop() {
    const folders = getAllFolders();
    let draggedFolder = null;
    let draggedFolderId = null;
    let draggedFolderIndex = null;

    folders.forEach((folder) => {
      const dragHandle = folder.querySelector(".folder__drag");

      if (!dragHandle) return;

      dragHandle.addEventListener("dragstart", (e) => {
        draggedFolder = folder;
        draggedFolderId = folder.getAttribute("data-id");
        draggedFolderIndex = parseInt(folder.getAttribute("data-index") || "0");
        folder.classList.add("dragging");

        e.dataTransfer.setData("text/plain", draggedFolderId);
        e.dataTransfer.effectAllowed = "move";

        const dragImage = document.createElement("div");
        dragImage.textContent =
          folder.querySelector(".folder__text").textContent;
        dragImage.style.position = "absolute";
        dragImage.style.top = "-1000px";
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 10, 10);

        setTimeout(() => {
          document.body.removeChild(dragImage);
        }, 0);
      });

      dragHandle.addEventListener("dragend", () => {
        if (draggedFolder) {
          draggedFolder.classList.remove("dragging");
        }
        getAllFolders().forEach((f) => f.classList.remove("drag-over"));
        draggedFolder = null;
        draggedFolderId = null;
        draggedFolderIndex = null;
      });
    });

    folders.forEach((folder) => {
      folder.addEventListener("dragover", (e) => {
        e.preventDefault();

        if (
          !draggedFolderId ||
          draggedFolderId === folder.getAttribute("data-id")
        ) {
          return;
        }

        e.dataTransfer.dropEffect = "move";
        folder.classList.add("drag-over");
      });

      folder.addEventListener("dragleave", () => {
        folder.classList.remove("drag-over");
      });

      folder.addEventListener("drop", async (e) => {
        e.preventDefault();
        folder.classList.remove("drag-over");

        const targetFolderId = folder.getAttribute("data-id");
        const targetFolderIndex = parseInt(
          folder.getAttribute("data-index") || "0",
        );

        if (!draggedFolderId || draggedFolderId === targetFolderId) {
          return;
        }

        await swapFolders(draggedFolderIndex, targetFolderIndex);
      });
    });

    foldersContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    });

    foldersContainer.addEventListener("dragleave", (e) => {
      if (!foldersContainer.contains(e.relatedTarget)) {
        getAllFolders().forEach((f) => f.classList.remove("drag-over"));
      }
    });
  }

  async function swapFolders(draggedIndex, targetIndex) {
    if (draggedIndex === targetIndex) {
      return;
    }

    const draggedFolder = currentFoldersData[draggedIndex];

    currentFoldersData.splice(draggedIndex, 1);

    currentFoldersData.splice(targetIndex, 0, draggedFolder);

    try {
      const response = await chrome.runtime.sendMessage({
        action: "updateFolders",
        folders: currentFoldersData,
      });

      if (response.success) {
        renderFolders();
      }
    } catch (error) {
      console.error("Error saving folder order: ", error);
    }
  }

  async function handleFolderEdit() {
    const folders = getAllFolders();

    folders.forEach((folder) => {
      const folderText = folder.querySelector(".folder__text");
      const dragHandle = folder.querySelector(".folder__drag");

      if (!folderText || !dragHandle) return;

      dragHandle.addEventListener("dragstart", () => {
        folderText.setAttribute("contenteditable", "false");
        folderText.style.pointerEvents = "none";
        folderText.style.userSelect = "none";
      });

      dragHandle.addEventListener("dragend", () => {
        folderText.setAttribute("contenteditable", "true");
        folderText.style.pointerEvents = "auto";
        folderText.style.userSelect = "auto";
      });

      folderText.addEventListener("input", (e) => {
        const text = e.target.textContent;
        if (text.length > 30) {
          e.target.textContent = text.substring(0, 30);
        }
      });

      folderText.addEventListener("blur", async (e) => {
        const folderElement = e.target;
        const folderId = folderElement.parentNode.getAttribute("data-id");
        const newName = folderElement.textContent.trim();

        if (!folderId || !newName) {
          const folderData = currentFoldersData.find((f) => f.id === folderId);
          if (folderData) {
            folderElement.textContent = folderData.name;
          }
          return;
        }

        if (newName.length > 30) {
          const folderData = currentFoldersData.find((f) => f.id === folderId);
          if (folderData) {
            folderElement.textContent = folderData.name;
          }
          return;
        }

        const folderIndex = currentFoldersData.findIndex(
          (f) => f.id === folderId,
        );

        if (folderIndex !== -1) {
          currentFoldersData[folderIndex].name = newName;

          try {
            const response = await chrome.runtime.sendMessage({
              action: "updateFolders",
              folders: currentFoldersData,
            });
          } catch (error) {
            console.error("Error saving to storage: ", error);
          }
        }
      });

      folderText.addEventListener("keydown", (e) => {
        const text = e.target.textContent;
        if (
          text.length >= 30 &&
          e.key.length === 1 &&
          !e.ctrlKey &&
          !e.metaKey
        ) {
          e.preventDefault();
        }

        if (e.key === "Enter") {
          e.preventDefault();
          folderText.blur();
        }

        if (folder.classList.contains("dragging")) {
          e.preventDefault();
        }
      });

      folderText.addEventListener("focus", () => {
        if (!folderText.getAttribute("title")) {
          folderText.setAttribute("title", "Максимум 30 символов");
        }
      });
    });
  }

  function setupAddFolderHandler() {
    if (!addFolderButton) return;

    addFolderButton.addEventListener("click", async () => {
      const defaultName = getNextFolderName();
      const folderName = prompt("Название новой папки:", defaultName);

      if (!folderName) return;

      const trimmedName = folderName.trim();
      if (!trimmedName) return;

      const duplicate = currentFoldersData.some(
        (folder) =>
          folder.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (duplicate) {
        alert("Папка с таким названием уже существует");
        return;
      }

      const newFolder = {
        id: generateFolderId(trimmedName),
        name: trimmedName,
        chats: [],
        hidden: false,
      };

      currentFoldersData.push(newFolder);

      try {
        const response = await persistFolders();
        if (response?.success) {
          renderFolders();
        }
      } catch (error) {
        console.error("Error creating folder:", error);
      }
    });
  }

  function getNextFolderName() {
    let index = 1;

    while (true) {
      const candidate = `Новая папка ${index}`;
      const exists = currentFoldersData.some(
        (folder) =>
          folder.name.trim().toLowerCase() === candidate.toLowerCase(),
      );

      if (!exists) {
        return candidate;
      }

      index += 1;
    }
  }
});
