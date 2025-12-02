import * as THREE from 'three';

const textureLoader = new THREE.TextureLoader();

export const textures = {};

export function loadAssets() {
    const list = [
        'floor_tile', 'counter_surface', 'chef_top', 'customer_top',
        'pattie_raw', 'pattie_cooked', 'pattie_burnt',
        'bun_bottom', 'bun_top',
        'lettuce', 'tomato', 'onion',
        'ketchup_blob', 'mustard_blob'
    ];

    return Promise.all(list.map(name => {
        return new Promise((resolve) => {
            textureLoader.load(`${name}.png`, (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                textures[name] = tex;
                resolve();
            }, undefined, (err) => {
                console.warn(`Failed to load texture: ${name}`, err);
                // Fallback texture
                const canvas = document.createElement('canvas');
                canvas.width = 64; canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(0,0,64,64);
                const fallback = new THREE.CanvasTexture(canvas);
                fallback.colorSpace = THREE.SRGBColorSpace;
                textures[name] = fallback;
                resolve();
            });
        });
    }));
}

