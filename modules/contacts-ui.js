export class ContactsUI {
  constructor(handlers) {
    this.handlers = handlers;
    this.listEl = document.getElementById("contacts-list");
    this.favoritesEl = document.getElementById("favorites-list");
    this.emptyState = document.getElementById("empty-state");
    this.favoritesEmpty = document.getElementById("favorites-empty");
    this.attachSwipeHandlers();
  }

  attachSwipeHandlers() {
    let startX = 0;
    let current = null;

    const onTouchStart = (e) => {
      const item = e.target.closest(".contact-item");
      if (!item) return;
      startX = e.touches[0].clientX;
      current = item;
    };

    const onTouchMove = (e) => {
      if (!current) return;
      const dx = e.touches[0].clientX - startX;
      if (dx < -20) {
        current.classList.add("swiped-left");
        current.classList.remove("swiped-right");
      } else if (dx > 20) {
        current.classList.add("swiped-right");
        current.classList.remove("swiped-left");
      }
    };

    const resetAll = () => {
      document.querySelectorAll(".contact-item").forEach((el) => {
        el.classList.remove("swiped-left", "swiped-right");
      });
      current = null;
    };

    const onTouchEnd = () => {
      setTimeout(() => {
        resetAll();
      }, 300);
    };

    this.listEl.addEventListener("touchstart", onTouchStart, { passive: true });
    this.listEl.addEventListener("touchmove", onTouchMove, { passive: true });
    this.listEl.addEventListener("touchend", onTouchEnd);

    this.listEl.addEventListener("click", (e) => {
      const item = e.target.closest(".contact-item");
      if (!item) return;
      const id = item.dataset.id;
      const contact = this._contacts.find((c) => c.id === id);
      if (!contact) return;
      if (e.target.closest(".swipe-delete")) {
        this.handlers.onDelete?.(contact);
      } else if (e.target.closest(".swipe-favorite")) {
        this.handlers.onToggleFavorite?.(contact);
      } else {
        this.handlers.onSelect?.(contact);
      }
    });
  }

  renderList(contacts) {
    this._contacts = contacts || [];
    this.listEl.innerHTML = "";

    if (!contacts || contacts.length === 0) {
      this.emptyState.style.display = "flex";
      return;
    }
    this.emptyState.style.display = "none";

    const grouped = {};
    for (const c of contacts) {
      const base = (c.firstName || c.lastName || "?").trim();
      const letter = base.charAt(0).toUpperCase() || "#";
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(c);
    }

    const letters = Object.keys(grouped).sort();

    for (const letter of letters) {
      const sectionHeader = document.createElement("div");
      sectionHeader.className = "section-header";
      sectionHeader.textContent = letter;
      this.listEl.appendChild(sectionHeader);

      for (const contact of grouped[letter]) {
        this.listEl.appendChild(this.renderRow(contact));
      }
    }
  }

  renderFavorites(contacts) {
    this.favoritesEl.innerHTML = "";
    const favs = (contacts || []).filter((c) => c.isFavorite);
    if (favs.length === 0) {
      this.favoritesEmpty.style.display = "flex";
      return;
    }
    this.favoritesEmpty.style.display = "none";
    for (const c of favs) {
      this.favoritesEl.appendChild(this.renderRow(c, { compact: true }));
    }
  }

  renderRow(contact, { compact = false } = {}) {
    const row = document.createElement("div");
    row.className = "contact-row";

    const shell = document.createElement("div");
    shell.className = "contact-swipe-shell";
    row.appendChild(shell);

    const actions = document.createElement("div");
    actions.className = "swipe-actions";
    actions.innerHTML = `
      <button class="swipe-favorite">Fav</button>
      <button class="swipe-delete">Del</button>
    `;

    const item = document.createElement("div");
    item.className = "contact-item";
    item.dataset.id = contact.id;

    const avatar = document.createElement("div");
    avatar.className = "contact-avatar";
    if (contact.photo) {
      const img = document.createElement("img");
      img.src = contact.photo;
      img.alt = "Avatar";
      avatar.appendChild(img);
    } else {
      const span = document.createElement("span");
      span.className = "contact-avatar-initials";
      span.textContent = this.getInitials(contact);
      avatar.appendChild(span);
    }

    const main = document.createElement("div");
    main.className = "contact-main";

    const nameRow = document.createElement("div");
    nameRow.className = "contact-name-row";

    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = this.getDisplayName(contact);

    nameRow.appendChild(name);
    if (contact.isFavorite) {
      const pill = document.createElement("span");
      pill.className = "favorite-pill";
      pill.textContent = "Favorite";
      nameRow.appendChild(pill);
    }

    const company = document.createElement("div");
    company.className = "contact-company";
    company.textContent = [contact.company, contact.jobTitle].filter(Boolean).join(" • ");

    const meta = document.createElement("div");
    meta.className = "contact-meta";
    const primaryPhone = (contact.phoneNumbers || []).find((p) => p.isPrimary) || (contact.phoneNumbers || [])[0];
    const primaryEmail = (contact.emailAddresses || []).find((e) => e.isPrimary) || (contact.emailAddresses || [])[0];
    const bits = [];
    if (primaryPhone) bits.push(primaryPhone.number);
    if (primaryEmail) bits.push(primaryEmail.email);
    meta.textContent = bits.join(" • ");

    main.appendChild(nameRow);
    if (!compact) main.appendChild(company);
    main.appendChild(meta);

    const chevron = document.createElement("div");
    chevron.className = "contact-chevron";
    chevron.textContent = "›";

    item.appendChild(avatar);
    item.appendChild(main);
    item.appendChild(chevron);

    shell.appendChild(actions);
    shell.appendChild(item);
    return row;
  }

  getInitials(contact) {
    const first = (contact.firstName || "").trim();
    const last = (contact.lastName || "").trim();
    if (!first && !last) return "?";
    const parts = `${first} ${last}`.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }

  getDisplayName(contact) {
    const first = (contact.firstName || "").trim();
    const last = (contact.lastName || "").trim();
    if (!first && !last) return "Unnamed contact";
    return [first, last].filter(Boolean).join(" ");
  }

  showDetail(contact) {
    const nameEl = document.getElementById("detail-name");
    const ctEl = document.getElementById("detail-company-title");
    const avatarImg = document.getElementById("detail-avatar");
    const actionsEl = document.getElementById("detail-actions");
    const fieldsEl = document.getElementById("detail-fields");
    const favBtn = document.getElementById("btn-detail-favorite");

    nameEl.textContent = this.getDisplayName(contact);
    ctEl.textContent = [contact.company, contact.jobTitle].filter(Boolean).join(" • ");

    if (contact.photo) {
      avatarImg.src = contact.photo;
    } else {
      avatarImg.src = "assets/placeholder-avatar.svg";
    }

    favBtn.textContent = contact.isFavorite ? "★" : "☆";

    actionsEl.innerHTML = "";
    const primaryPhone = (contact.phoneNumbers || []).find((p) => p.isPrimary) || (contact.phoneNumbers || [])[0];
    const primaryEmail = (contact.emailAddresses || []).find((e) => e.isPrimary) || (contact.emailAddresses || [])[0];

    if (primaryPhone) {
      actionsEl.appendChild(this.createActionChip("Call", `tel:${primaryPhone.number}`));
      actionsEl.appendChild(this.createActionChip("Message", `sms:${primaryPhone.number}`));
    }
    if (primaryEmail) {
      actionsEl.appendChild(this.createActionChip("Email", `mailto:${primaryEmail.email}`));
    }

    fieldsEl.innerHTML = "";

    if (contact.phoneNumbers && contact.phoneNumbers.length) {
      const card = document.createElement("div");
      card.className = "detail-field-card";
      const label = document.createElement("div");
      label.className = "detail-field-label";
      label.textContent = "Phone";
      card.appendChild(label);
      for (const p of contact.phoneNumbers) {
        const v = document.createElement("div");
        v.className = "detail-field-value";
        v.textContent = p.number;
        card.appendChild(v);
        const s = document.createElement("div");
        s.className = "detail-field-sub";
        s.textContent = `${p.type || "phone"}${p.isPrimary ? " • Primary" : ""}`;
        card.appendChild(s);
      }
      fieldsEl.appendChild(card);
    }

    if (contact.emailAddresses && contact.emailAddresses.length) {
      const card = document.createElement("div");
      card.className = "detail-field-card";
      const label = document.createElement("div");
      label.className = "detail-field-label";
      label.textContent = "Email";
      card.appendChild(label);
      for (const e of contact.emailAddresses) {
        const v = document.createElement("div");
        v.className = "detail-field-value";
        v.textContent = e.email;
        card.appendChild(v);
        const s = document.createElement("div");
        s.className = "detail-field-sub";
        s.textContent = `${e.type || "email"}${e.isPrimary ? " • Primary" : ""}`;
        card.appendChild(s);
      }
      fieldsEl.appendChild(card);
    }

    if (contact.notes) {
      const card = document.createElement("div");
      card.className = "detail-field-card";
      const label = document.createElement("div");
      label.className = "detail-field-label";
      label.textContent = "Notes";
      card.appendChild(label);
      const v = document.createElement("div");
      v.className = "detail-field-value";
      v.textContent = contact.notes;
      card.appendChild(v);
      fieldsEl.appendChild(card);
    }
  }

  createActionChip(label, href) {
    const a = document.createElement("a");
    a.className = "detail-action-chip";
    a.href = href;
    a.textContent = label;
    return a;
  }

  filterList(contacts, query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      this.renderList(contacts);
      return;
    }
    const filtered = contacts.filter((c) => {
      const hay = [
        c.firstName,
        c.lastName,
        c.company,
        c.jobTitle,
        ...(c.phoneNumbers || []).map((p) => p.number),
        ...(c.emailAddresses || []).map((e) => e.email),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    this.renderList(filtered);
  }
}

