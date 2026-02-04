import { ContactsDB } from "./modules/contacts-db.js";
import { ContactsUI } from "./modules/contacts-ui.js";
import { ContactsForm } from "./modules/contacts-form.js";
import { setupSearch } from "./modules/search.js";
import { setupExportImport } from "./modules/export-import.js";

const state = {
  contacts: [],
  selectedContactId: null,
  beforeInstallPromptEvent: null,
};

const db = new ContactsDB();
let ui;
let form;

function showToast(message, duration = 2500) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("toast--visible");
  window.clearTimeout(el._hideTimer);
  el._hideTimer = window.setTimeout(() => {
    el.classList.remove("toast--visible");
  }, duration);
}

async function refreshContacts({ silent = false } = {}) {
  try {
    state.contacts = await db.getAllContacts();
    ui.renderList(state.contacts);
    ui.renderFavorites(state.contacts);
    if (!silent) showToast("Contacts updated");
  } catch (err) {
    console.error(err);
    showToast("Unable to load contacts");
  }
}

function navigateToScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    const isTarget = s.id === id;
    s.classList.toggle("screen-active", isTarget);
    if (isTarget) {
      s.removeAttribute("hidden");
    } else {
      s.setAttribute("hidden", "true");
    }
  });
}

function setupTabs() {
  const tabContacts = document.getElementById("tab-contacts");
  const tabFavorites = document.getElementById("tab-favorites");

  function activateTab(tab) {
    [tabContacts, tabFavorites].forEach((t) =>
      t.classList.toggle("bottom-nav-item--active", t === tab)
    );
    const target = tab.dataset.target;
    if (target) navigateToScreen(target);
  }

  tabContacts.addEventListener("click", () => activateTab(tabContacts));
  tabFavorites.addEventListener("click", () => activateTab(tabFavorites));
}

function setupFAB() {
  const fab = document.getElementById("fab-add-contact");
  fab.addEventListener("click", () => {
    form.openForCreate();
    navigateToScreen("screen-form");
  });
}

function setupSettings() {
  const btnOpenSettings = document.getElementById("btn-open-settings");
  const btnSettingsBack = document.getElementById("btn-settings-back");

  btnOpenSettings.addEventListener("click", () => {
    navigateToScreen("screen-settings");
  });

  btnSettingsBack.addEventListener("click", () => {
    navigateToScreen("screen-contacts");
  });
}

function setupDetailActions() {
  const btnBack = document.getElementById("btn-detail-back");
  const btnEdit = document.getElementById("btn-detail-edit");
  const btnDelete = document.getElementById("btn-detail-delete");
  const btnFavorite = document.getElementById("btn-detail-favorite");

  btnBack.addEventListener("click", () => {
    navigateToScreen("screen-contacts");
  });

  btnEdit.addEventListener("click", async () => {
    if (!state.selectedContactId) return;
    const contact = await db.getContact(state.selectedContactId);
    if (!contact) return;
    form.openForEdit(contact);
    navigateToScreen("screen-form");
  });

  btnDelete.addEventListener("click", async () => {
    if (!state.selectedContactId) return;
    const id = state.selectedContactId;
    await db.deleteContact(id);
    state.selectedContactId = null;
    navigateToScreen("screen-contacts");
    await refreshContacts();
    showToast("Contact deleted");
  });

  btnFavorite.addEventListener("click", async () => {
    if (!state.selectedContactId) return;
    const contact = await db.getContact(state.selectedContactId);
    if (!contact) return;
    const updated = { ...contact, isFavorite: !contact.isFavorite, updatedAt: new Date().toISOString() };
    await db.updateContact(contact.id, updated);
    await refreshContacts({ silent: true });
    ui.showDetail(updated);
  });
}

function setupForm() {
  const formElement = document.getElementById("contact-form");
  form = new ContactsForm(formElement, {
    async onSubmit(contactPayload, isEdit) {
      const now = new Date().toISOString();
      if (isEdit && contactPayload.id) {
        const updated = {
          ...contactPayload,
          updatedAt: now,
        };
        await db.updateContact(contactPayload.id, updated);
        state.selectedContactId = contactPayload.id;
        showToast("Contact updated");
      } else {
        const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
        const created = {
          ...contactPayload,
          id,
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.addContact(created);
        state.selectedContactId = id;
        showToast("Contact saved");
      }
      await refreshContacts({ silent: true });
      const current = await db.getContact(state.selectedContactId);
      if (current) {
        ui.showDetail(current);
        navigateToScreen("screen-detail");
      } else {
        navigateToScreen("screen-contacts");
      }
    },
    onCancel() {
      if (state.selectedContactId) {
        navigateToScreen("screen-detail");
      } else {
        navigateToScreen("screen-contacts");
      }
    },
  });
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    state.beforeInstallPromptEvent = e;
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js");
  } catch (err) {
    console.warn("SW registration failed", err);
  }
}

async function bootstrap() {
  ui = new ContactsUI({
    onSelect: async (contact) => {
      state.selectedContactId = contact.id;
      ui.showDetail(contact);
      navigateToScreen("screen-detail");
    },
    onToggleFavorite: async (contact) => {
      const updated = {
        ...contact,
        isFavorite: !contact.isFavorite,
        updatedAt: new Date().toISOString(),
      };
      await db.updateContact(contact.id, updated);
      await refreshContacts({ silent: true });
    },
    onDelete: async (contact) => {
      await db.deleteContact(contact.id);
      if (state.selectedContactId === contact.id) {
        state.selectedContactId = null;
      }
      await refreshContacts({ silent: true });
      showToast("Contact deleted");
    },
  });

  setupForm();
  setupTabs();
  setupFAB();
  setupSettings();
  setupDetailActions();
  setupInstallPrompt();
  setupSearch({
    onQueryChange: (q) => ui.filterList(state.contacts, q),
  });
  setupExportImport({
    db,
    onAfterImport: async () => {
      await refreshContacts({ silent: true });
      showToast("Contacts imported");
    },
    onAfterClear: async () => {
      await refreshContacts({ silent: true });
      showToast("All data cleared");
    },
  });

  await registerServiceWorker();
  await refreshContacts({ silent: true });

  // Seed with a few example contacts on first run
  if (!state.contacts.length) {
    const now = new Date().toISOString();
    const sample = [
      {
        id: "sample-amelia-lee",
        firstName: "Amelia",
        lastName: "Lee",
        phoneNumbers: [
          { type: "work", number: "+44 20 7946 0011", isPrimary: true },
        ],
        emailAddresses: [
          { type: "work", email: "amelia.lee@citystudio.co", isPrimary: true },
        ],
        photo: null,
        company: "City Studio",
        jobTitle: "Art Director",
        notes: "Coffee meetup in London. Interested in collab.",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
      {
        id: "sample-david-kim",
        firstName: "David",
        lastName: "Kim",
        phoneNumbers: [
          { type: "mobile", number: "+1 415 555 9821", isPrimary: true },
        ],
        emailAddresses: [
          { type: "work", email: "david.kim@loopmetrics.io", isPrimary: true },
        ],
        photo: null,
        company: "Loop Metrics",
        jobTitle: "Data Scientist",
        notes: "Met at SF ML meetup. Loves dashboards.",
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
      {
        id: "sample-ema-garcia",
        firstName: "Ema",
        lastName: "Garcia",
        phoneNumbers: [
          { type: "mobile", number: "+34 600 123 456", isPrimary: true },
        ],
        emailAddresses: [
          { type: "personal", email: "ema.garcia@example.es", isPrimary: true },
        ],
        photo: null,
        company: "Sunrise Studio",
        jobTitle: "Illustrator",
        notes: "Did the icons for v1 of the app.",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
      {
        id: "sample-john-doe",
        firstName: "John",
        lastName: "Doe",
        phoneNumbers: [
          { type: "mobile", number: "+1 555 123 4567", isPrimary: true },
        ],
        emailAddresses: [
          { type: "personal", email: "john.doe@example.com", isPrimary: true },
        ],
        photo: null,
        company: "Nova Labs",
        jobTitle: "Product Designer",
        notes: "Met at DesignConf 2024 • UX track.",
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
        interactions: [
          { id: "int-1", kind: "call", at: now, note: "Kickoff call." },
        ],
      },
      {
        id: "sample-lina-zhou",
        firstName: "Lina",
        lastName: "Zhou",
        phoneNumbers: [
          { type: "work", number: "+86 21 5555 1234", isPrimary: true },
        ],
        emailAddresses: [
          { type: "work", email: "lina.zhou@orbitlabs.cn", isPrimary: true },
        ],
        photo: null,
        company: "Orbit Labs",
        jobTitle: "Android Engineer",
        notes: "Helps with Android builds and gradle issues.",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
      {
        id: "sample-rafael-santos",
        firstName: "Rafael",
        lastName: "Santos",
        phoneNumbers: [
          { type: "mobile", number: "+55 11 98888 0000", isPrimary: true },
        ],
        emailAddresses: [
          { type: "personal", email: "rafa.santos@example.com", isPrimary: true },
        ],
        photo: null,
        company: "Freelance",
        jobTitle: "iOS Engineer",
        notes: "Go‑to person for mobile performance audits.",
        isFavorite: true,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
      {
        id: "sample-sara-nguyen",
        firstName: "Sara",
        lastName: "Nguyen",
        phoneNumbers: [
          { type: "mobile", number: "+61 400 555 901", isPrimary: true },
        ],
        emailAddresses: [
          { type: "work", email: "sara.nguyen@pacificlabs.au", isPrimary: true },
        ],
        photo: null,
        company: "Pacific Labs",
        jobTitle: "PM",
        notes: "Product manager on shared side‑project.",
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
        interactions: [],
      },
    ];

    for (const c of sample) {
      const existing = await db.getContact(c.id);
      if (!existing) {
        await db.addContact(c);
      }
    }
    await refreshContacts({ silent: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();
});

