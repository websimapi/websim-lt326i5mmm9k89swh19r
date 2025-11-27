export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.enabled = false;
    }

    async load(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[name] = audioBuffer;
        } catch (e) {
            console.warn(`Failed to load sound ${name}:`, e);
        }
    }

    play(name, loop = false) {
        if (!this.enabled || !this.buffers[name]) return null;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.loop = loop;
        
        // Simple gain for volume
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 0.5;
        
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);
        source.start(0);
        return source; // Return source to stop loops if needed
    }

    enable() {
        this.enabled = true;
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }
}

export const audio = new AudioManager();