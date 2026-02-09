document.addEventListener("DOMContentLoaded", async function () {
  let currentFoldersData = [];
  const defaultFoldersData = [
    { id: "all", name: "Все", chats: [] },
    { id: "private", name: "Личные", chats: [] },
    { id: "clients", name: "Клиенты", chats: [] },
    { id: "others", name: "Другое", chats: [] },
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
    foldersContainer.innerHTML =
      window.foldersDataComponentPopup(currentFoldersData);
    addAttributesForFolders();
    setupDragAndDrop();
    handleFolderEdit();
  }

  function addAttributesForFolders() {
    const folders = getAllFolders();
    folders.forEach((folder, index) => {
      const folderText = folder.querySelector(".folder__text");
      folderText.setAttribute("contenteditable", "true");
      folder.setAttribute("data-id", currentFoldersData[index].id);
      folder.setAttribute("data-index", index);
    });
  }

  function getAllFolders() {
    return document.querySelectorAll(".folder");
  }

  function setupDragAndDrop() {
    const folders = getAllFolders();
    let draggedFolder = null;
    let draggedFolderId = null;

    folders.forEach((folder) => {
      const dragHandle = folder.querySelector(".folder__drag");

      if (!dragHandle) return;

      dragHandle.addEventListener("dragstart", (e) => {
        draggedFolder = folder;
        draggedFolderId = folder.getAttribute("data-id");
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
        if (!draggedFolderId || draggedFolderId === targetFolderId) {
          return;
        }

        await swapFolders(draggedFolderId, targetFolderId);
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

  async function swapFolders(draggedId, targetId) {
    const draggedIndex = currentFoldersData.findIndex(
      (f) => f.id === draggedId,
    );
    const targetIndex = currentFoldersData.findIndex((f) => f.id === targetId);

    if (
      draggedIndex === -1 ||
      targetIndex === -1 ||
      draggedIndex === targetIndex
    ) {
      return;
    }

    [currentFoldersData[draggedIndex], currentFoldersData[targetIndex]] = [
      currentFoldersData[targetIndex],
      currentFoldersData[draggedIndex],
    ];

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
        if (e.key === "Enter") {
          e.preventDefault();
          folderText.blur();
        }

        if (folder.classList.contains("dragging")) {
          e.preventDefault();
        }
      });
    });
  }
});
