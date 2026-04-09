import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/controls/PointerLockControls.js";

export function setupControls(camera) {
  const controls = new PointerLockControls(camera, document.body);

  document.body.addEventListener("click", () => {
    controls.lock();
  });

  return controls;
}
