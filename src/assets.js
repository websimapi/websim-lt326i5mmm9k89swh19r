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
            });
        });
    }));
}

