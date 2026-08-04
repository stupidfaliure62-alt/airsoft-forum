document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("[data-cat]").forEach(async function (el) {
    const cat = el.dataset.cat;
    const { count, error } = await supabaseClient
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("category", cat);

    el.textContent = (error ? 0 : count || 0).toLocaleString();
  });
});
