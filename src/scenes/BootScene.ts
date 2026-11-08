import Phaser from 'phaser';

declare const __BUILD_ID__: string;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height / 2 - 10, 'GAMBIT IDLE', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
    }).setOrigin(0.5);
    this.add.text(width / 2, height / 2 + 10, `build ${__BUILD_ID__}`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#8888aa',
    }).setOrigin(0.5);
  }
}
