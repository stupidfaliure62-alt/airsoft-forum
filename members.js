document.addEventListener("DOMContentLoaded", async function () {
  const list = document.getElementById("members-list");

  const { data: { session } } = await supabaseClient.auth.getSession();
  let viewerIsAdmin = false;
  const viewerId = session ? session.user.id : null;

  if (session) {
    const { data: viewerProfile } = await supabaseClient
      .from("profiles")
      .select("is_admin")
      .eq("id", session.user.id)
      .single();
    viewerIsAdmin = !!(viewerProfile && viewerProfile.is_admin);
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, username, created_at, is_admin, is_banned")
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
        '<span class="forum-title">' + escapeHtmlLocal(member.username) +
          (member.is_admin ? ' <span class="member-badge badge-admin-tag">ADMIN</span>' : "") +
          (member.is_banned ? ' <span class="member-badge badge-banned-tag">BANNED</span>' : "") +
        "</span>" +
        '<p class="forum-desc">Joined ' + joined + "</p>" +
      "</div>" +
      (viewerIsAdmin && member.id !== viewerId
        ? '<button class="ban-toggle-btn' + (member.is_banned ? " unban-btn" : "") + '" data-id="' + member.id + '" data-banned="' + member.is_banned + '">' +
            (member.is_banned ? "Unban" : "Ban") +
          "</button>"
        : "");
    list.appendChild(li);
  });

  if (viewerIsAdmin) {
    list.querySelectorAll(".ban-toggle-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const currentlyBanned = btn.dataset.banned === "true";
        const verb = currentlyBanned ? "unban" : "ban";
        if (!confirm("Are you sure you want to " + verb + " this user?")) return;

        btn.disabled = true;
        const { error: updateError } = await supabaseClient
          .from("profiles")
          .update({ is_banned: !currentlyBanned })
          .eq("id", btn.dataset.id);

        if (updateError) {
          alert("Couldn't update this user's ban status.");
          btn.disabled = false;
          return;
        }
        window.location.reload();
      });
    });
  }
});
