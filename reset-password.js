function showResetForm(container) {
  container.innerHTML =
    '<form id="reset-form" class="auth-form">' +
      '<input type="password" id="new-password" placeholder="New password (min 6 characters)" minlength="6" required>' +
      '<button type="submit">Set New Password</button>' +
      '<p class="auth-error" id="reset-error"></p>' +
    "</form>";

  document.getElementById("reset-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("reset-error");
    errorEl.textContent = "";
    const newPassword = document.getElementById("new-password").value;

    const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) {
      errorEl.textContent = "Couldn't update your password. The link may have expired — request a new one.";
      return;
    }

    container.innerHTML = '<p class="auth-success">Password updated. Redirecting...</p>';
    setTimeout(function () { window.location.href = "index.html"; }, 1500);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("reset-content");

  supabaseClient.auth.onAuthStateChange(function (event) {
    if (event === "PASSWORD_RECOVERY") {
      showResetForm(container);
    }
  });

  setTimeout(async function () {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && container.querySelector("#reset-form") === null) {
      showResetForm(container);
    } else if (!session) {
      container.innerHTML = '<p class="auth-required">This reset link is invalid or has expired. ' +
        '<a href="auth.html">Request a new one</a>.</p>';
    }
  }, 2000);
});
