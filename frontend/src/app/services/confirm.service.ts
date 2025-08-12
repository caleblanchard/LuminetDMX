import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  hideCancel?: boolean;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private stateSubject = new BehaviorSubject<ConfirmState>({ isOpen: false, options: null });
  public state$ = this.stateSubject.asObservable();

  private responseSubject: Subject<boolean> | null = null;

  ask(options: ConfirmOptions): Observable<boolean> {
    // Close any existing prompt
    if (this.responseSubject) {
      this.responseSubject.complete();
      this.responseSubject = null;
    }

    this.responseSubject = new Subject<boolean>();
    this.stateSubject.next({ isOpen: true, options });
    return this.responseSubject.asObservable();
  }

  confirm(): void {
    if (this.responseSubject) {
      this.responseSubject.next(true);
      this.responseSubject.complete();
      this.responseSubject = null;
    }
    this.stateSubject.next({ isOpen: false, options: null });
  }

  cancel(): void {
    if (this.responseSubject) {
      this.responseSubject.next(false);
      this.responseSubject.complete();
      this.responseSubject = null;
    }
    this.stateSubject.next({ isOpen: false, options: null });
  }
}


