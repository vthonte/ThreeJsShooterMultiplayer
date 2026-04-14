import { state } from "../state.js";

state.savedId = localStorage.getItem("playerId");

if (!state.savedId) {
  if (window.crypto && crypto.randomUUID) {
    state.savedId = crypto.randomUUID();
  } else {
    // fallback UUID generator
    state.savedId = "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  localStorage.setItem("playerId", savedId);
}

// ---------------- DAMAGE / DEATH ----------------

export function damagePlayer(amount) {
  if (state.isGameOver) return;

  state.playerHealth -= amount;

  // ✅ FIX: clamp health
  state.playerHealth = Math.max(0, state.playerHealth);

  const healthBar = document.getElementById("health-bar");
  const healthText = document.getElementById("health-text");

  if (healthBar) healthBar.style.width = state.playerHealth + "%";
  if (healthText) healthText.innerText = state.playerHealth;

  if (state.playerHealth <= 0) gameOver();
}
