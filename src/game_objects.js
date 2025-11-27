import * as THREE from 'three';
import { textures } from './assets.js';
import { audio } from './audio.js';

// Item Constants
export const ITEMS = {
    BUN_BOTTOM: 'bun_bottom',
    BUN_TOP: 'bun_top',
    PATTIE_RAW: 'pattie_raw',
    PATTIE_COOKING: 'pattie_cooking',
    PATTIE_COOKED: 'pattie_cooked',
    PATTIE_BURNT: 'pattie_burnt',
    LETTUCE: 'lettuce',
    TOMATO: 'tomato',
    ONION: 'onion',
    KETCHUP: 'ketchup',
    MUSTARD: 'mustard',
    PLATE: 'plate'
};

export class Chef extends THREE.Group {
    constructor() {
        super();
        const geometry = new THREE.PlaneGeometry(1.2, 1.2);
        const material = new THREE.MeshBasicMaterial({ 
            map: textures.chef_top, 
            transparent: true,
            side: THREE.DoubleSide
        });
        this.mesh = new THREE.Mesh(geometry, material);
        // Rotate so it's flat on the ground (XZ plane), but actually we are doing top down camera looking at XY usually? 
        // Let's stick to standard 3D: Y is up. Plane lies on XZ.
        this.mesh.rotation.x = -Math.PI / 2;
        this.add(this.mesh);

        this.heldItem = null;
        this.interactRadius = 1.5;
    }

    setHeldItem(item) {
        if (this.heldItem) {
            this.remove(this.heldItem);
        }
        this.heldItem = item;
        if (item) {
            item.position.set(0.6, 1, 0.6); // Slightly offset and up
            // item.rotation.x = 0; // Reset rotation relative to chef
            this.add(item);
            audio.play('pop');
        }
    }
}

export class Ingredient extends THREE.Group {
    constructor(type) {
        super();
        this.type = type;
        this.contents = [type]; // For plates/burgers
        
        let texName = type;
        if(type === ITEMS.KETCHUP) texName = 'ketchup_blob';
        if(type === ITEMS.MUSTARD) texName = 'mustard_blob';

        // Map raw pattie texture
        if(type === ITEMS.PATTIE_COOKING) texName = 'pattie_raw'; 

        const size = (type === ITEMS.PLATE) ? 1.2 : 0.8;
        const geometry = new THREE.PlaneGeometry(size, size);

        // Safety check for texture
        const tex = textures[texName] ? textures[texName] : textures['floor_tile'];

        const material = new THREE.MeshBasicMaterial({ 
            map: tex, 
            transparent: true,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.add(this.mesh);

        // Stack visual height
        this.stackHeight = 0.05;
    }

    addIngredient(type) {
        // Only valid if this is a plate or bun bottom acting as base
        this.contents.push(type);

        let texName = type;
        if(type === ITEMS.KETCHUP) texName = 'ketchup_blob';
        if(type === ITEMS.MUSTARD) texName = 'mustard_blob';

        const geometry = new THREE.PlaneGeometry(0.8, 0.8);
        const material = new THREE.MeshBasicMaterial({ 
            map: textures[texName], 
            transparent: true 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;

        // Stack visually
        const yOffset = (this.contents.length - 1) * 0.1;
        mesh.position.y = yOffset;

        this.add(mesh);
    }
}

export class Station extends THREE.Mesh {
    constructor(type, x, z, width, depth) {
        const geometry = new THREE.BoxGeometry(width, 1, depth);
        const material = new THREE.MeshLambertMaterial({ 
            map: textures.counter_surface
        });
        super(geometry, material);
        this.position.set(x, 0.5, z);
        this.stationType = type;
        this.heldItem = null;

        // Progress bar for cooking/spawning
        this.progress = 0;
        this.isProcessing = false;

        // Visual indicator for held item
        this.itemAnchor = new THREE.Group();
        this.itemAnchor.position.set(0, 0.6, 0);
        this.add(this.itemAnchor);
    }

    setItem(item) {
        // clear current
        while(this.itemAnchor.children.length > 0){ 
            this.itemAnchor.remove(this.itemAnchor.children[0]); 
        }
        this.heldItem = item;
        if(item) {
            item.position.set(0,0,0);
            this.itemAnchor.add(item);
            audio.play('pop');
        }
    }
}