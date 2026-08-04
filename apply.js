function escapeHtmlApply(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function statusScreen(app) {
  if (app.status === "approved") {
    return '<div class="status-box status-approved">' +
      '<h2>Application approved</h2>' +
      "<p>You're an admin now. Welcome aboard.</p>" +
      "</div>";
  }
  if (app.status === "rejected") {
    return '<div class="status-box status-rejected">' +
      "<h2>Application not accepted</h2>" +
      "<p>Thanks for applying. You're welcome to keep taking part in the forum.</p>" +
      "</div>";
  }
  return '<div class="status-box status-pending">' +
    '<h2><span class="pending-dot"></span>Pending verification</h2>' +
    "<p>Your application has been submitted and is waiting for an admin to review it. " +
    "You'll see the result here once it's been looked at.</p>" +
    '<p class="status-submitted">Submitted ' + escapeHtmlApply(new Date(app.created_at).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric"
    })) + "</p>" +
    "</div>";
}

function applicationForm() {
  return '<form id="apply-form" class="apply-form">' +
    '<label class="apply-label">How often will you be online?' +
      '<input type="text" id="apply-hours" placeholder="e.g. most evenings, ~2 hours a day" required>' +
    "</label>" +
    '<label class="apply-label">Why do you want to be an admin?' +
      '<textarea id="apply-why" rows="4" placeholder="Tell us what you\'d bring to the team..." required></textarea>' +
    "</label>" +
    '<label class="apply-label">Any relevant experience? <span class="apply-optional">(optional)</span>' +
      '<textarea id="apply-experience" rows="3" placeholder="Moderating other communities, running events, etc."></textarea>' +
    "</label>" +
    '<button type="submit">Submit Application</button>' +
    '<p class="auth-error" id="apply-error"></p>' +
  "</form>";
}

async function initApplyPage() {
  const container = document.getElementById("apply-content");
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    container.innerHTML = '<p class="auth-required">You need to <a href="auth.html">log in</a> to apply.</p>';
    return;
  }

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("is_admin, is_banned")
    .eq("id", session.user.id)
    .single();

  if (profile && profile.is_banned) {
    container.innerHTML = '<p class="auth-required">Banned accounts cannot apply.</p>';
    return;
  }

  if (profile && profile.is_admin) {
    container.innerHTML = '<p class="auth-required">You are already an admin. ' +
      '<a href="admin.html">Review applications</a>.</p>';
    return;
  }

  const { data: existing } = await supabaseClient
    .from("admin_applications")
    .select("status, created_at")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (existing) {
    container.innerHTML = statusScreen(existing);
    return;
  }

  container.innerHTML = applicationForm();

  document.getElementById("apply-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("apply-error");
    errorEl.textContent = "";

    const hours = document.getElementById("apply-hours").value.trim();
    const why = document.getElementById("apply-why").value.trim();
    const experience = document.getElementById("apply-experience").value.trim();
    if (!hours || !why) return;

    const { error } = await supabaseClient.from("admin_applications").insert({
      user_id: session.user.id,
      hours_online: hours,
      why_admin: why,
      experience: experience || null
    });

    if (error) {
      errorEl.textContent = "Couldn't submit your application. Please try again.";
      return;
    }

    container.innerHTML = statusScreen({ status: "pending", created_at: new Date().toISOString() });
  });
}

document.addEventListener("DOMContentLoaded", initApplyPage);
