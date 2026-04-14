import constants from "./constants.js";

export function initScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky blue

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 🌞 lighting
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // 🌍 ground (no blocks, just floor)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(constants.WORLD_SIZE, constants.WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x88cc88 }), // grass color
  );

  const buildPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({
      visible: false, // invisible but raycastable
    }),
  );

  buildPlane.rotation.x = -Math.PI / 2;
  buildPlane.position.y = 0;
  buildPlane.userData.isGround = true;

  scene.add(buildPlane);

  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 🌫️ fog (gives depth, looks nicer)
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, buildPlane };
}
