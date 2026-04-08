export function scrollToPinnedMessage(messageId) {
  const el = document.getElementById(messageId);
  if (!el) return false;

  el.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });

  el.classList.add("ext-pinned-highlight");

  setTimeout(() => {
    el.classList.remove("ext-pinned-highlight");
  }, 1800);

  return true;
}
