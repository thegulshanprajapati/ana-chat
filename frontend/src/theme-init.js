try {
  const mode = (localStorage.getItem("chat_color_mode") || "").toLowerCase();
  if (mode === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
} catch {
  // ignore localStorage failures
}
