import constants from "../constants.js";
import { addBlock, removeBlock } from "../scene.js";
import { state } from "../state.js";
import { shoot } from "../ui/hud.js";

export const mouseupEvent = () => {
  state.isMouseDown = false;
  state.activeMouseButton = null;
};

export const mousemoveEvent = () => {
  if (!state.isCreatorMode) return;

  state.raycaster.setFromCamera(state.center, state.camera);

  const intersects = state.raycaster.intersectObjects(
    [...state.objects, state.buildPlane],
    true,
  );

  if (!intersects.length) {
    state.preview.visible = false;
    state.lastHit = null;
    return;
  }

  state.lastHit = intersects[0];

  const pos = getBlockPosition(state.lastHit);

  state.preview.position.set(pos.x, pos.y, pos.z);
  state.preview.visible = true;

  if (!state.isCreatorMode) return;

  // update preview first (you already do this)

  if (state.isMouseDown && state.activeMouseButton === 0 && canPlace()) {
    handleBlockPlace();
    state.lastPlaceTime = Date.now();
  }

  if (state.isMouseDown && state.activeMouseButton === 2) {
    handleBlockRemove();
  }
};

export const mousedownEvent = (e) => {
  if (!state.isCreatorMode) return;

  state.isMouseDown = true;
  state.activeMouseButton = e.button;

  // place immediately on click
  if (e.button === 0) {
    handleBlockPlace();
  }

  if (e.button === 2) {
    e.preventDefault();
    handleBlockRemove();
  }
};

document.addEventListener("mousedown", mousedownEvent);

document.addEventListener("mouseup", mouseupEvent);

document.addEventListener("mousemove", mousemoveEvent);

function handleBlockPlace() {
  if (!state.lastHit) return;

  const pos = getBlockPosition(state.lastHit);
  addBlock(pos.x, pos.y, pos.z);
  saveWorld();
}

export function getRootObject(obj) {
  while (
    obj &&
    !obj.userData.isBlock &&
    !obj.userData.isPlayer &&
    !obj.userData.isEnemy
  ) {
    obj = obj.parent;
  }
  return obj;
}

function getBlockPosition(hit) {
  const pos = state.pos;

  const hitObj = getRootObject(hit.object);

  if (hitObj?.userData.isBlock && hit.face) {
    // go from block center → next voxel cell
    pos.copy(hitObj.position).add(hit.face.normal);
  } else {
    pos.copy(hit.point);
  }

  // SNAP TO GRID
  pos.x = Math.round(pos.x);
  pos.y = Math.round(pos.y);
  pos.z = Math.round(pos.z);

  return pos;
}

function saveWorld() {
  localStorage.setItem("myWorld", JSON.stringify(state.worldData));
}

function handleBlockRemove() {
  state.raycaster.setFromCamera(state.center, state.camera);

  const intersects = state.raycaster.intersectObjects(
    [...state.objects, state.buildPlane],
    false,
  );

  if (!intersects.length) return;

  const hit = getRootObject(intersects[0].object);

  if (hit?.userData.isBlock) {
    removeBlock(hit);
  }
  saveWorld();
}

function canPlace() {
  return Date.now() - state.lastPlaceTime > constants.PLACE_DELAY;
}

// ---------------- INPUT ----------------

if (!state.isCreatorMode) {
  document.addEventListener("click", shoot);
}

document.addEventListener("keydown", (e) => {
  if (!state.isAlive) return;

  if (e.key === "w") state.move.forward = true;
  if (e.key === "s") state.move.back = true;
  if (e.key === "a") state.move.left = true;
  if (e.key === "d") state.move.right = true;

  if (e.code === "Space" && state.isOnGround) {
    state.yVelocity = state.jumpForce;
    state.isOnGround = false;
  }

  if (state.isSpectating) {
    const list = Object.values(otherPlayers);

    if (e.key === "ArrowRight") {
      spectateIndex = (spectateIndex + 1) % list.length;
    }

    if (e.key === "ArrowLeft") {
      spectateIndex = (spectateIndex - 1 + list.length) % list.length;
    }
  }
});

document.addEventListener("contextmenu", (e) => {
  if (!state.isCreatorMode) return;

  e.preventDefault();

  state.raycaster.setFromCamera(state.center, state.camera);

  const intersects = state.raycaster.intersectObjects(
    [...state.objects, state.buildPlane],
    false,
  );

  if (!intersects.length) return;

  const hitObj = getRootObject(intersects[0].object);
  const hit = intersects[0];

  let pos = hit.point.clone();

  if (hit.face && hitObj?.userData.isBlock) {
    pos.add(hit.face.normal);
  }

  pos.x = Math.round(pos.x);
  pos.y = Math.round(pos.y);
  pos.z = Math.round(pos.z);

  addBlock(pos.x, pos.y, pos.z);
});

document.addEventListener("keyup", (e) => {
  if (e.key === "w") state.move.forward = false;
  if (e.key === "s") state.move.back = false;
  if (e.key === "a") state.move.left = false;
  if (e.key === "d") state.move.right = false;
});
