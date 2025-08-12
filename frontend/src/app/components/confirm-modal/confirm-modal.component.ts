import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="(confirm.state$ | async)?.isOpen" (click)="confirm.cancel()">
      <div class="modal" (click)="$event.stopPropagation()">
        <h3 class="title">{{ (confirm.state$ | async)?.options?.title || 'Are you sure?' }}</h3>
        <p class="message">{{ (confirm.state$ | async)?.options?.message }}</p>
        <div class="actions">
          <button class="btn" *ngIf="!(confirm.state$ | async)?.options?.hideCancel" (click)="confirm.cancel()">{{ (confirm.state$ | async)?.options?.cancelText || 'Cancel' }}</button>
          <button class="btn danger" [class.danger]="(confirm.state$ | async)?.options?.danger" (click)="confirm.confirm()">
            {{ (confirm.state$ | async)?.options?.confirmText || 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); z-index: 2000; }
    .modal { background: rgba(15,23,42,0.98); color: #e2e8f0; border: 1px solid rgba(148,163,184,0.2); border-radius: 12px; padding: 20px; width: 90%; max-width: 420px; box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    .title { margin: 0 0 8px 0; font-size: 18px; font-weight: 600; }
    .message { margin: 0 0 16px 0; color: #cbd5e1; }
    .actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(148,163,184,0.2); background: rgba(30,41,59,0.8); color: #e2e8f0; cursor: pointer; }
    .btn:hover { background: rgba(30,41,59,1); }
    .btn.danger { background: #ef4444; border-color: #ef4444; color: #fff; }
    .btn.danger:hover { background: #dc2626; border-color: #dc2626; }
  `]
})
export class ConfirmModalComponent {
  constructor(public confirm: ConfirmService) {}
}


