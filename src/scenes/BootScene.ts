import Phaser from 'phaser';

/** Первая сцена: здесь появится настройка платформы/сохранений, пока сразу переходим к загрузке. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
