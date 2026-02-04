export function setupSearch({ onQueryChange }) {
  const input = document.getElementById("search-input");
  if (!input) return;

  let last = "";
  let debounceId = null;

  const emit = () => {
    const q = input.value;
    if (q === last) return;
    last = q;
    onQueryChange?.(q);
  };

  input.addEventListener("input", () => {
    window.clearTimeout(debounceId);
    debounceId = window.setTimeout(emit, 80);
  });

  // Pull-to-refresh style: focus search on pull-down
  let startY = 0;
  let pulling = false;
  const list = document.getElementById("contacts-list");
  list.addEventListener(
    "touchstart",
    (e) => {
      if (list.scrollTop === 0) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    },
    { passive: true }
  );
  list.addEventListener(
    "touchmove",
    (e) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 40) {
        input.focus();
        pulling = false;
      }
    },
    { passive: true }
  );
}

