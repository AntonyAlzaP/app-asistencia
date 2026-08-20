import { Component, ElementRef, effect, model, output, signal, viewChild } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-camera-capture',
  standalone: true,
  imports: [DialogModule, ButtonModule, MessageModule],
  templateUrl: './camera-capture.html',
  styleUrl: './camera-capture.scss'
})
export class CameraCapture {
  readonly visible = model(false);
  readonly title = model('Tomar foto');
  readonly captured = output<Blob>();
  readonly cancelled = output<void>();

  readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly errorMessage = signal<string | null>(null);
  readonly ready = signal(false);

  private stream: MediaStream | null = null;

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    });
  }

  private async startCamera(): Promise<void> {
    this.errorMessage.set(null);
    this.ready.set(false);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      const video = this.videoRef()?.nativeElement;
      if (video) {
        video.srcObject = this.stream;
        await video.play();
        this.ready.set(true);
      }
    } catch (err) {
      this.errorMessage.set('No se pudo acceder a la cámara. Verifica los permisos del sistema.');
    }
  }

  private stopCamera(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.ready.set(false);
  }

  capture(): void {
    const video = this.videoRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.stampTimestamp(ctx, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          this.captured.emit(blob);
          this.visible.set(false);
        }
      },
      'image/jpeg',
      0.85
    );
  }

  private stampTimestamp(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const text = new Intl.DateTimeFormat('es-PE', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date());

    const fontSize = Math.max(14, Math.round(width * 0.035));
    ctx.font = `600 ${fontSize}px sans-serif`;
    const paddingX = fontSize * 0.6;
    const paddingY = fontSize * 0.5;
    const textWidth = ctx.measureText(text).width;
    const barHeight = fontSize + paddingY * 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, height - barHeight, textWidth + paddingX * 2, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, paddingX, height - barHeight / 2);
  }

  close(): void {
    this.cancelled.emit();
    this.visible.set(false);
  }
}
