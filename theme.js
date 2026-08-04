document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function isLight() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function updateIcon() {
    btn.textContent = isLight() ? "\u{1F319}" : "\u{2600}\u{FE0F}";
  }

  updateIcon();

  btn.addEventListener("click", function () {
    if (isLight()) {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("af-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("af-theme", "light");
    }
    updateIcon();
  });
});
