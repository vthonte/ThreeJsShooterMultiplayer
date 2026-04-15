import { gameOver } from "../multiplayer/socket.js";
import { state } from "../state.js";
import { generatePlayerId } from "../utils/generatePlayerId.js";

state.playerId = localStorage.getItem("playerId");

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
