import { gameOver } from "../multiplayer/socket.js";
import { state } from "../state.js";

state.playerId = localStorage.getItem("playerId");

export function setPlayerId() {
  if (!state.playerId) {
    if (window.crypto && crypto.randomUUID) {
      state.playerId = crypto.randomUUID();
    } else {
      // fallback UUID generator
      state.playerId = "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
      );
    }
  }

  localStorage.setItem("playerId", state.playerId);
  return state.playerId;
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
