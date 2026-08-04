let signupCaptchaWidgetId = null;

function onHcaptchaReady() {
  signupCaptchaWidgetId = hcaptcha.render("captcha-signup", { sitekey: HCAPTCHA_SITE_KEY });
}

function resetPasswordRedirectUrl() {
  return new URL("reset-password.html", window.location.href).href;
}

document.addEventListener("DOMContentLoaded", function () {
  const tabs = document.querySelectorAll(".auth-tab");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const forgotForm = document.getElementById("forgot-form");

  function showForm(form) {
    [loginForm, signupForm, forgotForm].forEach(function (f) {
      f.classList.toggle("auth-form-hidden", f !== form);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      showForm(tab.dataset.tab === "login" ? loginForm : signupForm);
    });
  });

  document.getElementById("forgot-password-link").addEventListener("click", function (e) {
    e.preventDefault();
    showForm(forgotForm);
  });

  document.getElementById("back-to-login-link").addEventListener("click", function (e) {
    e.preventDefault();
    showForm(loginForm);
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;

    const { data: email, error: lookupError } = await supabaseClient.rpc("email_for_username", { uname: username });
    if (lookupError || !email) {
      errorEl.textContent = "Incorrect username or password.";
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
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
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      errorEl.textContent = "Username can only contain letters and numbers.";
      return;
    }

    const captchaToken = signupCaptchaWidgetId !== null ? hcaptcha.getResponse(signupCaptchaWidgetId) : null;
    if (!captchaToken) {
      errorEl.textContent = "Please complete the captcha.";
      return;
    }

    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("username")
      .ilike("username", username)
      .maybeSingle();

    if (existing) {
      errorEl.textContent = "That username is already taken.";
      if (signupCaptchaWidgetId !== null) hcaptcha.reset(signupCaptchaWidgetId);
      return;
    }

    const { error } = await supabaseClient.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username: username },
        captchaToken: captchaToken
      }
    });
    if (error) {
      errorEl.textContent = error.message;
      if (signupCaptchaWidgetId !== null) hcaptcha.reset(signupCaptchaWidgetId);
      return;
    }
    window.location.href = "index.html";
  });

  forgotForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById("forgot-error");
    const successEl = document.getElementById("forgot-success");
    errorEl.textContent = "";
    successEl.textContent = "";
    const username = document.getElementById("forgot-username").value.trim();

    const { data: email, error: lookupError } = await supabaseClient.rpc("email_for_username", { uname: username });
    if (lookupError || !email) {
      errorEl.textContent = "No account found with that username.";
      return;
    }

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: resetPasswordRedirectUrl()
    });
    if (error) {
      errorEl.textContent = "Couldn't send reset email. Please try again later.";
      return;
    }
    successEl.textContent = "Check your email for a reset link.";
  });
});
