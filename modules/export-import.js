export function setupExportImport({ db, onAfterImport, onAfterClear }) {
  const btnExport = document.getElementById("btn-export");
  const importInput = document.getElementById("import-input");
  const btnClear = document.getElementById("btn-clear-data");

  btnExport.addEventListener("click", async () => {
    const contacts = await db.getAllContacts();
    const blob = new Blob([JSON.stringify(contacts, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        await db.importContacts(parsed);
        onAfterImport?.();
      } catch (err) {
        console.error(err);
        alert("Invalid JSON file");
      } finally {
        importInput.value = "";
      }
    };
    reader.readAsText(file);
  });

  btnClear.addEventListener("click", async () => {
    const ok = window.confirm("Clear all contacts? This cannot be undone.");
    if (!ok) return;
    await db.clearAll();
    onAfterClear?.();
  });
}

