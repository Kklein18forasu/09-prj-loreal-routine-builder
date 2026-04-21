const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const WORKER_URL = "https://wispy-feather-ddc6.kklein18.workers.dev";

const STORAGE_KEY = "loreal-selected-products";

let allProducts = [];
let selectedProductIds = [];
let conversationHistory = [
  {
    role: "system",
    content: `
You are a L'Oréal beauty advisor.

Only answer questions about:
- skincare
- haircare
- makeup
- fragrance
- grooming
- the user's routine

Use ONLY the selected products when building routines.

Be clear, helpful, and structured.
`
  }
];

/* ---------- STORAGE ---------- */
function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProductIds));
}

function loadSelections() {
  const saved = localStorage.getItem(STORAGE_KEY);
  selectedProductIds = saved ? JSON.parse(saved) : [];
}

/* ---------- PRODUCTS ---------- */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
    renderProducts();
    renderSelectedProducts();
  } catch (error) {
    productsContainer.innerHTML = "Error loading products.";
  }
}

/* ---------- DISPLAY PRODUCTS ---------- */
function renderProducts() {
  const category = categoryFilter.value.toLowerCase();
  const search = productSearch.value.toLowerCase();

  let filtered = allProducts;

  if (category) {
    filtered = filtered.filter(p => p.category.toLowerCase() === category);
  }

  if (search) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.brand.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search)
    );
  }

  productsContainer.innerHTML = filtered.map(p => {
    const selected = selectedProductIds.includes(p.id);

    return `
      <div class="product-card ${selected ? "selected" : ""}" data-id="${p.id}">
        <img src="${p.image}">
        <h3>${p.name}</h3>
        <p>${p.brand}</p>

        <button class="desc-btn" data-id="${p.id}">View Description</button>

        <div class="desc hidden" id="desc-${p.id}">
          ${p.description}
        </div>
      </div>
    `;
  }).join("");

  attachProductEvents();
}

/* ---------- PRODUCT EVENTS ---------- */
function attachProductEvents() {
  document.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("desc-btn")) return;

      const id = Number(card.dataset.id);
      toggleProduct(id);
    });
  });

  document.querySelectorAll(".desc-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const id = btn.dataset.id;
      const el = document.getElementById(`desc-${id}`);

      el.classList.toggle("hidden");
      btn.textContent = el.classList.contains("hidden")
        ? "View Description"
        : "Hide Description";
    });
  });
}

/* ---------- SELECT PRODUCTS ---------- */
function toggleProduct(id) {
  if (selectedProductIds.includes(id)) {
    selectedProductIds = selectedProductIds.filter(i => i !== id);
  } else {
    selectedProductIds.push(id);
  }

  saveSelections();
  renderProducts();
  renderSelectedProducts();
}

function renderSelectedProducts() {
  const selected = allProducts.filter(p => selectedProductIds.includes(p.id));

  if (!selected.length) {
    selectedProductsList.innerHTML = "No products selected.";
    return;
  }

  selectedProductsList.innerHTML = selected.map(p => `
    <div class="selected-pill">
      ${p.name}
      <button data-id="${p.id}" class="remove-btn">x</button>
    </div>
  `).join("");

  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      selectedProductIds = selectedProductIds.filter(i => i !== id);
      saveSelections();
      renderProducts();
      renderSelectedProducts();
    });
  });
}

/* ---------- CHAT UI ---------- */
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerText = text;
  chatWindow.appendChild(div);
}

/* ---------- CALL WORKER ---------- */
async function callWorker(messages, selectedProducts) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages,
      selectedProducts
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Worker request failed");
  }

  return data.reply;
}

/* ---------- GENERATE ROUTINE ---------- */
async function generateRoutine() {
  const selected = allProducts.filter(p => selectedProductIds.includes(p.id));

  if (!selected.length) {
    addMessage("assistant", "Select products first.");
    return;
  }

  const prompt = `
Create a routine using ONLY these products:
${JSON.stringify(selected, null, 2)}
`;

  conversationHistory.push({ role: "user", content: prompt });

  addMessage("user", "Generate my routine");

  try {
    const reply = await callWorker(conversationHistory, selected);
    addMessage("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });
  } catch (error) {
    addMessage("assistant", error.message);
  }
}

/* ---------- CHAT SUBMIT ---------- */
async function handleChat(e) {
  e.preventDefault();

  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  userInput.value = "";

  try {
    const reply = await callWorker(conversationHistory, []);
    addMessage("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });
  } catch (error) {
    addMessage("assistant", error.message);
  }
}

/* ---------- EVENTS ---------- */
categoryFilter.addEventListener("change", renderProducts);
productSearch.addEventListener("input", renderProducts);
generateRoutineBtn.addEventListener("click", generateRoutine);
chatForm.addEventListener("submit", handleChat);

clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelections();
  renderProducts();
  renderSelectedProducts();
});

/* ---------- INIT ---------- */
loadSelections();
loadProducts();

addMessage("assistant", "Select products and click Generate Routine.");