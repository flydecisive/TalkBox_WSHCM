export function showNotification(message) {
  const existing = document.querySelector(".ext-hotification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.className = "ext-hotification";
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add("show");
  }, 10);

  setTimeout(() => {
    notification.classList.remove("show");

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}