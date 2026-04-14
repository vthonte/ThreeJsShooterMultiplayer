export function createEnemies(scene, THREE) {
  const enemies = [];

  for (let i = 0; i < 5; i++) {
    // 👇 create a group (enemy = multiple parts)
    const enemy = new THREE.Group();

    // BODY
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0x550000,
        emissiveIntensity: 0.5,
      }),
    );
    body.position.y = 1;

    // HEAD
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3),
      new THREE.MeshStandardMaterial({
        color: 0xffaaaa,
      }),
    );
    head.position.y = 2;

    // 👇 add parts to enemy
    enemy.add(body);
    enemy.add(head);

    // POSITION
    enemy.position.set(
      (Math.random() - 0.5) * 50,
      0,
      (Math.random() - 0.5) * 50,
    );

    // DATA
    enemy.userData = {
      speed: 0.02,
      isEnemy: true,
      health: 3,
      attackCooldown: 0,
    };

    scene.add(enemy);
    enemies.push(enemy);
  }

  return enemies;
}
