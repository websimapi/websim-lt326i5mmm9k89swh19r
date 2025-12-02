import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { Chef, Station, Ingredient, ITEMS } from './game_objects.js';
import { loadAssets, textures } from './assets.js';
import { audio } from './audio.js';

// --- Configuration ---
const SCENE_WIDTH = 10;
const SCENE_HEIGHT = 10;

// --- Globals ---
let scene, camera, renderer;
let chef;
let stations = [];
let customers = [];
let lastTime = 0;
let score = 0;
const orders = [];

// --- Init ---
async function init() {
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.textContent = "Loading...";

    // Preload sounds
    audio.load('sizzle', 'sizzle.mp3');
    audio.load('bell', 'bell.mp3');
    audio.load('pop', 'pop.mp3');
    audio.load('trash', 'trash.mp3');

    await loadAssets();

    startBtn.disabled = false;
    startBtn.textContent = "Start Cooking";

    startBtn.addEventListener('click', async () => {
        document.getElementById('start-screen').style.display = 'none';
        audio.enable();
        await setupGame();
        animate(0);
    });
}

async function setupGame() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 12;
    camera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2, frustumSize * aspect / 2,
        frustumSize / 2, frustumSize / -2,
        0.1, 1000
    );
    camera.position.set(0, 10, 5); // Isometric-ish top down
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Floor
    const floorGeo = new THREE.PlaneGeometry(SCENE_WIDTH + 4, SCENE_HEIGHT + 4);
    const floorMat = new THREE.MeshLambertMaterial({ map: textures.floor_tile });
    textures.floor_tile.wrapS = THREE.RepeatWrapping;
    textures.floor_tile.wrapT = THREE.RepeatWrapping;
    textures.floor_tile.repeat.set(8, 8);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Walls (Visual only)
    // ...

    // --- Stations Setup ---
    // Layout: 
    // Top: Customer Counter
    // Bottom: Buns, Patties
    // Left: Grill
    // Right: Veggies + Condiments
    // Center: Assembly Table (x2)

    createStation('counter', 0, -5, 4, 1); // Customers appear here (actually top z is negative in 3js usually? Let's say Z- is top)

    // Let's align: Z-5 is top (Counter). Z+5 is bottom. X-5 left, X+5 right.

    // Counter at Top
    createStation('counter', -2, -4, 3, 1.5);
    createStation('counter', 2, -4, 3, 1.5);
    createStation('trash', 5, -4, 1.5, 1.5);

    // Ingredients at Bottom
    createStation('crate_bun', -3, 4, 1.5, 1.5);
    createStation('crate_pattie', -1, 4, 1.5, 1.5);

    // Veggies Right
    createStation('crate_lettuce', 4, 4, 1.5, 1.5);
    createStation('crate_tomato', 4, 2, 1.5, 1.5);
    createStation('crate_onion', 4, 0, 1.5, 1.5);
    createStation('crate_ketchup', 4, -2, 1.5, 1.5); // Using crates for sauce bottles

    // Grill Left
    createStation('grill', -4, 0, 1.5, 3);

    // Assembly Center
    createStation('assembly', -1, 0, 2, 2);
    createStation('assembly', 1.5, 0, 2, 2);

    // Chef
    chef = new Chef();
    scene.add(chef);

    // Inputs
    setupControls();

    // Resize
    window.addEventListener('resize', onWindowResize, false);

    // Start customer loop
    setInterval(spawnCustomer, 5000);
}

function createStation(type, x, z, w, d) {
    const s = new Station(type, x, z, w, d);
    stations.push(s);
    scene.add(s);

    // Visual hints
    if (type.startsWith('crate_')) {
        // Show icon on crate
        const iconType = type.replace('crate_', '');
        const icon = new Ingredient(iconType);
        icon.position.set(0, 0.6, 0);
        s.add(icon);
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 12;
    camera.left = -frustumSize * aspect / 2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = -frustumSize / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Controls ---
let joystickManager;
let moveVector = new THREE.Vector2(0, 0);

function setupControls() {
    const zone = document.getElementById('controls-left');
    joystickManager = nipplejs.create({
        zone: zone,
        mode: 'dynamic',
        color: 'white',
        size: 150
    });

    joystickManager.on('move', (evt, data) => {
        const forward = data.vector.y;
        const turn = data.vector.x;
        moveVector.set(turn, -forward); // In 3D Z is down/forward
    });

    joystickManager.on('end', () => {
        moveVector.set(0, 0);
    });

    const actionBtn = document.getElementById('action-btn');
    actionBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleInteraction();
        actionBtn.style.transform = "scale(0.9)";
    });
    actionBtn.addEventListener('pointerup', (e) => {
        actionBtn.style.transform = "scale(1)";
    });
}

function handleInteraction() {
    // Find nearest station
    let nearest = null;
    let minDist = 2.0;

    stations.forEach(s => {
        const dist = chef.position.distanceTo(s.position);
        if (dist < minDist) {
            minDist = dist;
            nearest = s;
        }
    });

    if (!nearest) return;

    const stationType = nearest.stationType;

    // Logic Tree

    // 1. Holding nothing
    if (!chef.heldItem) {
        // Pick up from crate
        if (stationType.startsWith('crate_')) {
            const itemType = stationType.replace('crate_', '');
            // Handle specific item types
            let finalType = itemType;
            if(itemType === 'bun') finalType = ITEMS.BUN_BOTTOM; // Default to bottom bun spawn

            chef.setHeldItem(new Ingredient(finalType));
        }
        // Pick up from station
        else if (nearest.heldItem) {
            chef.setHeldItem(nearest.heldItem);
            nearest.heldItem = null;
            nearest.itemAnchor.remove(nearest.itemAnchor.children[0]);
            nearest.isProcessing = false; // Stop cooking if picked up
        }
    }
    // 2. Holding something
    else {
        const held = chef.heldItem;

        // Trash
        if (stationType === 'trash') {
            chef.setHeldItem(null);
            audio.play('trash');
            return;
        }

        // Grill Logic
        if (stationType === 'grill') {
            if (!nearest.heldItem && held.type === ITEMS.PATTIE_RAW) {
                // Place pattie
                chef.setHeldItem(null);
                nearest.setItem(held);
                startCooking(nearest, held);
            }
        }
        // Assembly Logic
        else if (stationType === 'assembly') {
            if (!nearest.heldItem) {
                // Place item
                chef.setHeldItem(null);
                nearest.setItem(held);
            } else {
                // Combine?
                const base = nearest.heldItem;
                // If base is bun bottom or plate or stack, add held item
                if (isValidStack(base, held)) {
                    base.addIngredient(held.type);
                    // Destroy held item object as it is merged
                    chef.setHeldItem(null);
                    audio.play('pop');

                    // Check if bun top added -> make it a "burger" ready to serve?
                    // For now, it stays an Ingredient group
                }
            }
        }
        // Counter Logic
        else if (stationType === 'counter') {
            // Serve
            if (tryServeOrder(held)) {
                chef.setHeldItem(null);
                audio.play('bell');
            }
        }
    }
}

function startCooking(station, pattie) {
    station.isProcessing = true;
    station.cookStartTime = Date.now();

    // Start sizzle loop?
}

function isValidStack(base, item) {
    // Simple logic: Can stack anything on a bun bottom or existing stack
    // Cannot stack a bun bottom on top of something else
    if (item.type === ITEMS.BUN_BOTTOM) return false;

    // Base must be bun bottom or contain bun bottom
    const baseIsBun = base.type === ITEMS.BUN_BOTTOM;
    const baseIsStack = base.contents && base.contents[0] === ITEMS.BUN_BOTTOM;

    return baseIsBun || baseIsStack;
}

// --- Game Logic ---

function spawnCustomer() {
    if (customers.length >= 3) return;

    // Generate Order
    const ingredients = [ITEMS.BUN_BOTTOM, ITEMS.PATTIE_COOKED];

    // Random extras
    if (Math.random() > 0.5) ingredients.push(ITEMS.LETTUCE);
    if (Math.random() > 0.5) ingredients.push(ITEMS.TOMATO);
    if (Math.random() > 0.5) ingredients.push(ITEMS.ONION);
    if (Math.random() > 0.5) ingredients.push(ITEMS.KETCHUP);

    ingredients.push(ITEMS.BUN_TOP); // Always close with top bun

    const order = {
        id: Date.now(),
        ingredients: ingredients,
        timeLeft: 60
    };
    orders.push(order);
    updateOrdersUI();
}

function tryServeOrder(item) {
    if (!item.contents) return false;

    // Must be a bun based stack
    if (item.contents[0] !== ITEMS.BUN_BOTTOM) return false;

    // Copy contents to not mutate
    const layers = [...item.contents];

    const index = orders.findIndex(o => {
        const target = [...o.ingredients];

        // Check lengths
        if (layers.length !== target.length) return false;

        // Check bottom and top (if top bun exists in target)
        if (layers[0] !== target[0]) return false;
        // if (target[target.length-1] === ITEMS.BUN_TOP && layers[layers.length-1] !== ITEMS.BUN_TOP) return false;

        // Sort both arrays to compare content regardless of order (except bottom bun which we checked)
        const lSorted = layers.sort();
        const tSorted = target.sort();

        return lSorted.join(',') === tSorted.join(',');
    });

    if (index !== -1) {
        // Success
        orders.splice(index, 1);
        updateOrdersUI();
        score += 10;
        document.getElementById('score').innerText = score;
        return true;
    }
    return false;
}

function updateOrdersUI() {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';
    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = 'order-card';
        // Icons
        o.ingredients.forEach(ing => {
            // Only show key ingredients to save space
            if(ing === ITEMS.BUN_BOTTOM) return;
            if(ing === ITEMS.BUN_TOP) return;

            const img = document.createElement('img');
            let src = ing;
            if(ing === ITEMS.KETCHUP) src = 'ketchup_blob';
            if(ing === ITEMS.MUSTARD) src = 'mustard_blob';
            img.src = `${src}.png`;
            div.appendChild(img);
        });
        const timer = document.createElement('div');
        timer.className = 'order-timer';
        div.appendChild(timer);
        container.appendChild(div);
    });
}

// --- Loop ---

function animate(time) {
    requestAnimationFrame(animate);
    const dt = (time - lastTime) / 1000;
    lastTime = time;

    // Move Chef
    if (chef) {
        const speed = 5;
        chef.position.x += moveVector.x * speed * dt;
        chef.position.z += moveVector.y * speed * dt; // Y is Z in our mapping

        // Bounds
        chef.position.x = Math.max(-4.5, Math.min(4.5, chef.position.x));
        chef.position.z = Math.max(-4.5, Math.min(4.5, chef.position.z));
    }

    // Process Cooking
    const now = Date.now();
    stations.forEach(s => {
        if (s.stationType === 'grill' && s.isProcessing && s.heldItem) {
            const cookedTime = 5000;
            const burntTime = 10000;
            const elapsed = now - s.cookStartTime;

            if (elapsed > burntTime && s.heldItem.type !== ITEMS.PATTIE_BURNT) {
                s.heldItem.type = ITEMS.PATTIE_BURNT;
                s.heldItem.mesh.material.map = textures.pattie_burnt;
                s.heldItem.mesh.material.needsUpdate = true;
                // smoke effect?
            } else if (elapsed > cookedTime && elapsed < burntTime && s.heldItem.type !== ITEMS.PATTIE_COOKED) {
                s.heldItem.type = ITEMS.PATTIE_COOKED;
                s.heldItem.mesh.material.map = textures.pattie_cooked;
                s.heldItem.mesh.material.needsUpdate = true;
            }
        }
    });

    renderer.render(scene, camera);
}

init();