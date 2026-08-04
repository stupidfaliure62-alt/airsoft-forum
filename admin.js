function escapeHtmlAdmin(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric"
  });
}

async function loadApplications() {
  const { data, error } = await supabaseClient
    .from("admin_applications")
    .select("id, user_id, hours_online, why_admin, experience, status, created_at, profiles(username)")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

async function setStatus(app, status) {
  const { error } = await supabaseClient
    .from("admin_applications")
    .update({ status: status })
    .eq("id", app.id);
  if (error) throw error;

  if (status === "approved") {
    const { error: promoteError } = await supabaseClient
      .from("profiles")
      .update({ is_admin: true })
      .eq("id", app.user_id);
    if (promoteError) throw promoteError;
  }
}

function renderApplication(app) {
  const username = app.profiles ? app.profiles.username : "unknown";
  const statusClass = "badge-" + app.status;

  return '<li class="application-card" data-id="' + escapeHtmlAdmin(app.id) + '">' +
    '<div class="application-head">' +
      '<div>' +
        '<span class="application-user">' + escapeHtmlAdmin(username) + "</span>" +
        '<span class="application-date">applied ' + escapeHtmlAdmin(formatDate(app.created_at)) + "</span>" +
      "</div>" +
      '<span class="status-badge ' + statusClass + '">' + escapeHtmlAdmin(app.status) + "</span>" +
    "</div>" +
    '<div class="application-qa">' +
      "<h4>How often will you be online?</h4>" +
      "<p>" + escapeHtmlAdmin(app.hours_online) + "</p>" +
      "<h4>Why do you want to be an admin?</h4>" +
      "<p>" + escapeHtmlAdmin(app.why_admin) + "</p>" +
      (app.experience ? "<h4>Relevant experience</h4><p>" + escapeHtmlAdmin(app.experience) + "</p>" : "") +
    "</div>" +
    (app.status === "pending"
      ? '<div class="application-actions">' +
          '<button class="approve-btn" data-action="approved">Approve</button>' +
          '<button class="reject-btn" data-action="rejected">Reject</button>' +
        "</div>"
      : "") +
  "</li>";
}

async function renderApplications() {
  const container = document.getElementById("admin-content");
  const apps = await loadApplications();

  if (apps.length === 0) {
    container.innerHTML = '<p class="thread-empty">No applications yet.</p>';
    return;
  }

  container.innerHTML = '<ul class="application-list">' +
    apps.map(renderApplication).join("") +
  "</ul>";

  container.querySelectorAll("[data-action]").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const card = btn.closest(".application-card");
      const app = apps.find(function (a) { return a.id === card.dataset.id; });
      btn.disabled = true;
      try {
        await setStatus(app, btn.dataset.action);
        renderApplications();
      } catch (err) {
        btn.disabled = false;
        alert("Couldn't update that application. Please try again.");
      }
    });
  });
}

async function initAdminPage() {
  const container = document.getElementById("admin-content");
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    container.innerHTML = '<p class="auth-required">You need to <a href="auth.html">log in</a>.</p>';
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_admin")
    .eq("id", session.user.id)
    .single();

  if (!profile || !profile.is_admin) {
    container.innerHTML = '<p class="auth-required">This page is for admins only.</p>';
    return;
  }

  renderApplications();
}

document.addEventListener("DOMContentLoaded", initAdminPage);
