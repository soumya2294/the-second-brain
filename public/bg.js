const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const brainGroup = new THREE.Group();
scene.add(brainGroup);

brainGroup.position.x = 0;
brainGroup.position.y = 0;

const coreGeo = new THREE.IcosahedronGeometry(2.5, 1); 
const coreMat = new THREE.MeshBasicMaterial({ 
    color: 0x00ff88, 
    wireframe: true,
    transparent: true,
    opacity: 0.15
});
const core = new THREE.Mesh(coreGeo, coreMat);
brainGroup.add(core);

const glowGeo = new THREE.IcosahedronGeometry(2.4, 1);
const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.05
});
const glow = new THREE.Mesh(glowGeo, glowMat);
brainGroup.add(glow);

const particlesGeo = new THREE.BufferGeometry();
const particleCount = 600;
const posArray = new Float32Array(particleCount * 3);

for(let i = 0; i < particleCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 12;
}

particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({
    size: 0.03,
    color: 0x00ff88,
    transparent: true,
    opacity: 0.3
});
const particleMesh = new THREE.Points(particlesGeo, particlesMat);
brainGroup.add(particleMesh);

function createRing(radius, tube, color) {
    const geo = new THREE.TorusGeometry(radius, tube, 16, 100);
    const mat = new THREE.MeshBasicMaterial({ 
        color: color, 
        transparent: true, 
        opacity: 0.1,
        wireframe: true 
    });
    const ring = new THREE.Mesh(geo, mat);
    brainGroup.add(ring);
    return ring;
}

const ring1 = createRing(3.5, 0.02, 0x00ff88);
const ring2 = createRing(4.2, 0.02, 0x4cc9f0);
const ring3 = createRing(5.0, 0.02, 0xffffff);

ring1.rotation.x = Math.PI / 2;
ring2.rotation.y = Math.PI / 3;

camera.position.z = 12;

let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
    requestAnimationFrame(animate);

    core.rotation.y += 0.002;
    core.rotation.x += 0.001;
    glow.rotation.y -= 0.002;

    particleMesh.rotation.y -= 0.001;

    ring1.rotation.x += 0.005;
    ring1.rotation.y += 0.002;

    ring2.rotation.y += 0.004;
    ring2.rotation.z += 0.002;

    ring3.rotation.x -= 0.003;
    ring3.rotation.z += 0.003;

    brainGroup.rotation.x += (mouseY * 0.1 - brainGroup.rotation.x) * 0.05;
    brainGroup.rotation.y += (mouseX * 0.1 - brainGroup.rotation.y) * 0.05;

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();