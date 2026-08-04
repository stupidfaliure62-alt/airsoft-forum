document.addEventListener("DOMContentLoaded", async function () {
  const list = document.getElementById("members-list");

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("username, created_at")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    list.innerHTML = '<li class="thread-empty">No members yet. Be the first to sign up!</li>';
    return;
  }

  list.innerHTML = "";
  data.forEach(function (member) {
    const joined = new Date(member.created_at).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric"
    });
    const li = document.createElement("li");
    li.className = "forum-row";
    li.innerHTML =
      '<div class="forum-icon">' + escapeHtmlLocal(member.username.slice(0, 2).toUpperCase()) + "</div>" +
      '<div class="forum-info">' +
        '<span class="forum-title">' + escapeHtmlLocal(member.username) + "</span>" +
        '<p class="forum-desc">Joined ' + joined + "</p>" +
      "</div>";
    list.appendChild(li);
  });
});
