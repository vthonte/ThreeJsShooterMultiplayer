import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/controls/PointerLockControls.js";

export function setupControls(camera, isCreatorMode) {
  const controls = new PointerLockControls(camera, document.body);

  document.addEventListener("click", () => {
    controls.lock();
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Escape") controls.unlock();
  });

  return controls;
}
