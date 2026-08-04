function attachImagePicker(formEl, textareaEl) {
  const wrap = document.createElement("div");
  wrap.className = "image-picker";

  const label = document.createElement("label");
  label.className = "image-picker-label";
  label.textContent = "📎 Add image (or paste one)";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.className = "image-picker-input";
  label.appendChild(input);

  const preview = document.createElement("div");
  preview.className = "image-preview";
  preview.style.display = "none";

  const previewImg = document.createElement("img");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "Remove image";
  removeBtn.className = "image-preview-remove";

  preview.appendChild(previewImg);
  preview.appendChild(removeBtn);

  wrap.appendChild(label);
  wrap.appendChild(preview);

  textareaEl.insertAdjacentElement("afterend", wrap);

  function setFile(file) {
    if (!file || file.type.indexOf("image/") !== 0) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB.");
      return;
    }
    formEl._selectedImageFile = file;
    previewImg.src = URL.createObjectURL(file);
    preview.style.display = "flex";
  }

  function clear() {
    formEl._selectedImageFile = null;
    input.value = "";
    preview.style.display = "none";
    previewImg.src = "";
  }

  input.addEventListener("change", function () {
    if (input.files && input.files[0]) setFile(input.files[0]);
  });

  textareaEl.addEventListener("paste", function (e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        setFile(items[i].getAsFile());
        e.preventDefault();
        break;
      }
    }
  });

  removeBtn.addEventListener("click", clear);

  formEl._clearSelectedImage = clear;
}

async function uploadSelectedImage(file) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const ext = (file.type.split("/")[1] || "png").split("+")[0];
  const path = session.user.id + "/" + Date.now() + "." + ext;
  const { error: uploadError } = await supabaseClient.storage.from("thread-images").upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = supabaseClient.storage.from("thread-images").getPublicUrl(path);
  return data.publicUrl;
}
