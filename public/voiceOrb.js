let orbScene, orbCamera, orbRenderer;
let coreMesh, nodePoints;
let orbGeometry;
let noise = new SimplexNoise();
let currentState = 'idle';
let time = 0;
let micVolume = 0;

// ✅ FIX: Variable to store the original perfect sphere shape
let basePositions; 

function initVoiceOrb() {
    const canvas = document.getElementById('voice-canvas');
    if (!canvas) return;

    orbScene = new THREE.Scene();
    orbCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    orbCamera.position.z = 3.2;

    orbRenderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    orbRenderer.setSize(window.innerWidth, window.innerHeight);
    orbRenderer.setPixelRatio(window.devicePixelRatio);

    orbGeometry = new THREE.IcosahedronGeometry(1, 4); 
    
    // ✅ FIX: Store original positions once (The "Memory" of the shape)
    basePositions = orbGeometry.attributes.position.array.slice();

    const lineMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        wireframe: true,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });
    coreMesh = new THREE.Mesh(orbGeometry, lineMat);
    orbScene.add(coreMesh);

    const pointsMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.03,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });
    nodePoints = new THREE.Points(orbGeometry, pointsMat);
    orbScene.add(nodePoints);

    window.addEventListener('resize', () => {
        orbCamera.aspect = window.innerWidth / window.innerHeight;
        orbCamera.updateProjectionMatrix();
        orbRenderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function updateOrbState(state) {
    currentState = state;
    const colors = {
        listening: 0xff3333,
        thinking: 0x00ccff,
        speaking: 0x00ff88,
        idle: 0x00ff88
    };

    const targetColor = new THREE.Color(colors[state] || colors.idle);
    coreMesh.material.color.lerp(targetColor, 0.5);
    if (state === 'thinking') nodePoints.material.opacity = 0.3;
    else nodePoints.material.opacity = 0.8;
}

function setMicVolume(vol) {
    micVolume = vol;
}

function animateOrb() {
    requestAnimationFrame(animateOrb);
    time += 0.01;

    if (!coreMesh || !basePositions) return;

    const positionAttribute = orbGeometry.getAttribute('position');
    const vertex = new THREE.Vector3();

    let chaosIntensity = 0;
    let coreSpinY = 0.002;
    let coreSpinZ = 0.001;

    // --- State Logic ---
    if (currentState === 'listening') {
        const normalizedVolume = Math.min(micVolume, 0.25); 
        const baseScale = 1.0 + (normalizedVolume * 0.8); 
        coreMesh.scale.lerp(new THREE.Vector3(baseScale, baseScale, baseScale), 0.2);
        nodePoints.scale.copy(coreMesh.scale);
        chaosIntensity = normalizedVolume * 2.5;
        coreSpinY = 0.01 + micVolume * 0.1;
    } 
    else if (currentState === 'thinking') {
        chaosIntensity = 0; 
        coreSpinY = 0.2;
        coreMesh.scale.lerp(new THREE.Vector3(0.7, 0.7, 0.7), 0.1);
        nodePoints.scale.copy(coreMesh.scale);
    } 
    else if (currentState === 'speaking') {
        chaosIntensity = 0.1;
        coreSpinY = 0.005;
        const pulse = 1.0 + Math.sin(time * 5) * 0.1;
        coreMesh.scale.set(pulse, pulse, pulse);
        nodePoints.scale.set(pulse, pulse, pulse);
    }
    else {
        coreMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
        nodePoints.scale.copy(coreMesh.scale);
        chaosIntensity = noise.noise3D(time, 0, 0) * 0.1 + 0.1; 
    }

    // --- ✅ FIX: Optimized Deformation Loop ---
    for (let i = 0; i < positionAttribute.count; i++) {
        // 1. Reset vertex to its original "Perfect Sphere" position
        vertex.fromArray(basePositions, i * 3);
        
        // 2. Calculate Noise directly on the clean vertex
        let chaosValue = noise.noise3D(
            vertex.x + time * 2.0,
            vertex.y + time * 2.0, 
            vertex.z + time * 2.0
        );

        // 3. Apply displacement (Expand outward based on noise)
        // Since 'vertex' is already a unit vector (radius 1 sphere), we just multiply
        vertex.multiplyScalar(1.0 + (chaosValue * chaosIntensity));
        
        // 4. Update the active geometry
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    orbGeometry.attributes.position.needsUpdate = true;
    orbGeometry.computeVertexNormals();

    coreMesh.rotation.y += coreSpinY;
    coreMesh.rotation.z += coreSpinZ;
    nodePoints.rotation.y = coreMesh.rotation.y;
    nodePoints.rotation.z = coreMesh.rotation.z;

    orbRenderer.render(orbScene, orbCamera);
}

initVoiceOrb();
animateOrb();

window.setVoiceOrbState = updateOrbState;
window.setMicVolume = setMicVolume;