export class ContactsForm {
  constructor(formEl, { onSubmit, onCancel }) {
    this.formEl = formEl;
    this.onSubmit = onSubmit;
    this.onCancel = onCancel;

    this.idInput = document.getElementById("contact-id");
    this.firstNameInput = document.getElementById("first-name");
    this.lastNameInput = document.getElementById("last-name");
    this.companyInput = document.getElementById("company");
    this.jobTitleInput = document.getElementById("job-title");
    this.notesInput = document.getElementById("notes");
    this.phonesContainer = document.getElementById("phones-container");
    this.emailsContainer = document.getElementById("emails-container");
    this.photoInput = document.getElementById("photo-input");
    this.formAvatar = document.getElementById("form-avatar");
    this.btnAvatar = document.getElementById("btn-form-avatar");
    this.btnAddPhone = document.getElementById("btn-add-phone");
    this.btnAddEmail = document.getElementById("btn-add-email");
    this.btnSave = document.getElementById("btn-form-save");
    this.btnCancel = document.getElementById("btn-form-cancel");
    this.formTitle = document.getElementById("form-title");

    this.currentPhotoDataUrl = null;

    this.bindEvents();
  }

  bindEvents() {
    this.formEl.addEventListener("submit", (e) => {
      e.preventDefault();
    });

    this.btnSave.addEventListener("click", () => this.handleSubmit());
    this.btnCancel.addEventListener("click", () => this.onCancel?.());

    this.btnAvatar.addEventListener("click", () => {
      this.photoInput.click();
    });

    this.photoInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.currentPhotoDataUrl = reader.result;
        this.formAvatar.src = this.currentPhotoDataUrl;
      };
      reader.readAsDataURL(file);
    });

    this.btnAddPhone.addEventListener("click", () => {
      this.addPhoneField();
    });
    this.btnAddEmail.addEventListener("click", () => {
      this.addEmailField();
    });
  }

  openForCreate() {
    this.formTitle.textContent = "New Contact";
    this.idInput.value = "";
    this.firstNameInput.value = "";
    this.lastNameInput.value = "";
    this.companyInput.value = "";
    this.jobTitleInput.value = "";
    this.notesInput.value = "";
    this.currentPhotoDataUrl = null;
    this.formAvatar.src = "assets/placeholder-avatar.svg";
    this.phonesContainer.innerHTML = "";
    this.emailsContainer.innerHTML = "";
    this.addPhoneField();
    this.addEmailField();
  }

  openForEdit(contact) {
    this.formTitle.textContent = "Edit Contact";
    this.idInput.value = contact.id;
    this.firstNameInput.value = contact.firstName || "";
    this.lastNameInput.value = contact.lastName || "";
    this.companyInput.value = contact.company || "";
    this.jobTitleInput.value = contact.jobTitle || "";
    this.notesInput.value = contact.notes || "";

    this.currentPhotoDataUrl = contact.photo || null;
    this.formAvatar.src = this.currentPhotoDataUrl || "assets/placeholder-avatar.svg";

    this.phonesContainer.innerHTML = "";
    (contact.phoneNumbers || []).forEach((p) => this.addPhoneField(p));
    if (!this.phonesContainer.children.length) this.addPhoneField();

    this.emailsContainer.innerHTML = "";
    (contact.emailAddresses || []).forEach((e) => this.addEmailField(e));
    if (!this.emailsContainer.children.length) this.addEmailField();
  }

  addPhoneField(initial = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "dynamic-item";

    wrapper.innerHTML = `
      <select class="dynamic-select" data-role="type">
        <option value="mobile">Mobile</option>
        <option value="home">Home</option>
        <option value="work">Work</option>
        <option value="other">Other</option>
      </select>
      <input class="dynamic-input" type="tel" placeholder="+1 555 123 4567" data-role="value" />
      <div class="dynamic-actions">
        <button type="button" class="dynamic-primary-toggle" title="Primary" data-role="primary">★</button>
        <button type="button" class="dynamic-remove" title="Remove">✕</button>
      </div>
    `;

    if (initial) {
      wrapper.querySelector('[data-role="type"]').value = initial.type || "mobile";
      wrapper.querySelector('[data-role="value"]').value = initial.number || "";
      if (initial.isPrimary) {
        wrapper.querySelector('[data-role="primary"]').classList.add("is-primary");
      }
    }

    wrapper.querySelector('[data-role="primary"]').addEventListener("click", () => {
      // Make this the only primary
      Array.from(this.phonesContainer.querySelectorAll('[data-role="primary"]')).forEach((btn) =>
        btn.classList.remove("is-primary")
      );
      wrapper.querySelector('[data-role="primary"]').classList.add("is-primary");
    });

    wrapper.querySelector(".dynamic-remove").addEventListener("click", () => {
      wrapper.remove();
    });

    this.phonesContainer.appendChild(wrapper);
  }

  addEmailField(initial = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "dynamic-item";

    wrapper.innerHTML = `
      <select class="dynamic-select" data-role="type">
        <option value="personal">Personal</option>
        <option value="work">Work</option>
        <option value="other">Other</option>
      </select>
      <input class="dynamic-input" type="email" placeholder="name@example.com" data-role="value" />
      <div class="dynamic-actions">
        <button type="button" class="dynamic-primary-toggle" title="Primary" data-role="primary">★</button>
        <button type="button" class="dynamic-remove" title="Remove">✕</button>
      </div>
    `;

    if (initial) {
      wrapper.querySelector('[data-role="type"]').value = initial.type || "personal";
      wrapper.querySelector('[data-role="value"]').value = initial.email || "";
      if (initial.isPrimary) {
        wrapper.querySelector('[data-role="primary"]').classList.add("is-primary");
      }
    }

    wrapper.querySelector('[data-role="primary"]').addEventListener("click", () => {
      Array.from(this.emailsContainer.querySelectorAll('[data-role="primary"]')).forEach((btn) =>
        btn.classList.remove("is-primary")
      );
      wrapper.querySelector('[data-role="primary"]').classList.add("is-primary");
    });

    wrapper.querySelector(".dynamic-remove").addEventListener("click", () => {
      wrapper.remove();
    });

    this.emailsContainer.appendChild(wrapper);
  }

  collectPhones() {
    const items = Array.from(this.phonesContainer.querySelectorAll(".dynamic-item"));
    const result = items
      .map((item) => {
        const type = item.querySelector('[data-role="type"]').value || "mobile";
        const number = item.querySelector('[data-role="value"]').value.trim();
        const isPrimary = item.querySelector('[data-role="primary"]').classList.contains("is-primary");
        if (!number) return null;
        return { type, number, isPrimary };
      })
      .filter(Boolean);
    if (result.length && !result.some((p) => p.isPrimary)) {
      result[0].isPrimary = true;
    }
    return result;
  }

  collectEmails() {
    const items = Array.from(this.emailsContainer.querySelectorAll(".dynamic-item"));
    const result = items
      .map((item) => {
        const type = item.querySelector('[data-role="type"]').value || "personal";
        const email = item.querySelector('[data-role="value"]').value.trim();
        const isPrimary = item.querySelector('[data-role="primary"]').classList.contains("is-primary");
        if (!email) return null;
        return { type, email, isPrimary };
      })
      .filter(Boolean);
    if (result.length && !result.some((e) => e.isPrimary)) {
      result[0].isPrimary = true;
    }
    return result;
  }

  handleSubmit() {
    if (!this.firstNameInput.value.trim() && !this.lastNameInput.value.trim()) {
      this.firstNameInput.focus();
      return;
    }

    const payload = {
      id: this.idInput.value || null,
      firstName: this.firstNameInput.value.trim(),
      lastName: this.lastNameInput.value.trim(),
      company: this.companyInput.value.trim(),
      jobTitle: this.jobTitleInput.value.trim(),
      notes: this.notesInput.value.trim(),
      phoneNumbers: this.collectPhones(),
      emailAddresses: this.collectEmails(),
      photo: this.currentPhotoDataUrl,
    };

    const isEdit = Boolean(payload.id);
    this.onSubmit?.(payload, isEdit);
  }
}

