import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private ws: WebSocket | null = null;
  private messageSubject = new Subject<any>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private dmxValuesSubject = new BehaviorSubject<number[]>(new Array(512).fill(0));

  public messages$ = this.messageSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public dmxValues$ = this.dmxValuesSubject.asObservable();

  constructor() {
    this.connect();
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '3000';
    
    this.ws = new WebSocket(`${protocol}//${host}:${port}`);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.logDebug('WebSocket connection established');
      this.connectionStatusSubject.next(true);
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.logDebug('WebSocket message received', data);
      this.messageSubject.next(data);
      
      if (data.type === 'dmx_update') {
        this.dmxValuesSubject.next(data.data);
        this.logDebug('DMX values updated from WebSocket', data.data);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.logDebug('WebSocket connection closed');
      this.connectionStatusSubject.next(false);
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.logDebug('WebSocket error occurred', error);
      this.connectionStatusSubject.next(false);
    };
  }

  public sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private logDebug(message: string, data?: any): void {
    const settings = JSON.parse(localStorage.getItem('luminetDmxSettings') || '{}');
    if (settings.enableLogging) {
      console.log(`[LuminetDMX WebSocket] ${message}`, data);
    }
  }
}