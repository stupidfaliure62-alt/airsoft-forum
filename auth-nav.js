function escapeHtmlLocal(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function renderAuthNav() {
  const slot = document.getElementById("nav-auth-slot");
  if (!slot) return;

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    slot.innerHTML = '<a href="auth.html">Login</a>';
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("username, is_admin")
    .eq("id", session.user.id)
    .single();

  const name = profile ? profile.username : session.user.email;
  const adminLink = (profile && profile.is_admin)
    ? '<a href="admin.html">Applications</a>'
    : '<a href="apply.html">Apply</a>';

  slot.innerHTML =
    adminLink +
    '<span class="nav-user">' + escapeHtmlLocal(name) + "</span>" +
    '<a href="#" id="logout-link">Log out</a>';

  document.getElementById("logout-link").addEventListener("click", async function (e) {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });
}

function initLiveMemberCount() {
  const countEl = document.getElementById("member-count");
  if (!countEl) return;

  const channel = supabaseClient.channel("online-members", {
    config: { presence: { key: crypto.randomUUID() } }
  });

  channel
    .on("presence", { event: "sync" }, function () {
      const state = channel.presenceState();
      countEl.textContent = Object.keys(state).length.toLocaleString();
    })
    .subscribe(async function (status) {
      if (status === "SUBSCRIBED") {
        await channel.track({ online_at: new Date().toISOString() });
      }
    });
}

document.addEventListener("DOMContentLoaded", function () {
  renderAuthNav();
  initLiveMemberCount();
  supabaseClient.auth.onAuthStateChange(function () {
    renderAuthNav();
  });
});
