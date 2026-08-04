function usernameToEmail(username) {
  const slug = username.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug + "@af.local";
}

document.addEventListener("DOMContentLoaded", function () {
  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      if (tab.dataset.tab === "login") {
        loginForm.classList.remove("auth-form-hidden");
        signupForm.classList.add("auth-form-hidden");
      } else {
        signupForm.classList.remove("auth-form-hidden");
        loginForm.classList.add("auth-form-hidden");
      }
    });
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    const { error } = await supabaseClient.auth.signInWithPassword({
      email: usernameToEmail(username),
      password: password
    });
    if (error) {
      errorEl.textContent = "Incorrect username or password.";
      return;
    }
    window.location.href = "index.html";
  });

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("signup-error");
    errorEl.textContent = "";
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      errorEl.textContent = "Username can only contain letters and numbers.";
      return;
    }

    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("username")
      .ilike("username", username)
      .maybeSingle();

    if (existing) {
      errorEl.textContent = "That username is already taken.";
      return;
    }

    const { error } = await supabaseClient.auth.signUp({
      email: usernameToEmail(username),
      password: password,
      options: { data: { username: username } }
    });
    if (error) {
      errorEl.textContent = error.message;
      return;
    }
    window.location.href = "index.html";
  });
});
