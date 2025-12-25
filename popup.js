document.addEventListener("DOMContentLoaded", async function () {
  let currentFoldersData = [];
  const defaultFoldersData = [
    { id: "all", name: "Все", chats: [] },
    { id: "private", name: "Личные", chats: [] },
    { id: "clients", name: "Клиенты", chats: [] },
    { id: "others", name: "Другое", chats: [] },
  ];

  // chrome.storage.local.set({ folders_data: [] });

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
    // Получаем текущее состояние
    const response = await chrome.runtime.sendMessage({ action: "getState" });
    toggle.checked = response.isEnabled;

    const foldersResponse = await chrome.runtime.sendMessage({
      action: "getFolders",
    });

    if (foldersResponse?.folders) {
      currentFoldersData = foldersResponse.folders;
    }

    updateStatus(response.isEnabled);

    // Обработчик переключения
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
      foldersContainer.innerHTML =
        window.foldersDataComponent(currentFoldersData);
      addAtributesForFolders();
      handleFolderEdit();
      // foldersContainer.appendChild(foldersDataElement);
    } else {
      foldersContainer.innerHTML = "";
    }
  }

  function getAllFolders() {
    const folders = document.querySelectorAll(".folder");
    return folders;
  }

  function addAtributesForFolders() {
    const folders = getAllFolders();
    folders.forEach((folder, index) => {
      folder.setAttribute("contenteditable", true);
      folder.setAttribute("data-id", currentFoldersData[index].id);
    });
  }

  async function handleFolderEdit() {
    const folders = getAllFolders();
    folders.forEach((folder) => {
      folder.addEventListener("blur", async (e) => {
        const folderElement = e.target;
        const folderId = folderElement.getAttribute("data-id");
        const newName = folderElement.textContent.trim();

        if (!folderId || !newName) {
          return;
        }

        // Обновляем имя в массиве
        const folderIndex = currentFoldersData.findIndex(
          (f) => f.id === folderId
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

      folder.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          folder.blur();
        }
      });
    });
  }
});
