import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { ConfirmModalComponent } from './components/confirm-modal/confirm-modal.component';
import { WebsocketService } from './services/websocket.service';
import { ApiService } from './services/api.service';
import { BlackoutService } from './services/blackout.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ConfirmModalComponent],
  template: `
    <div class="app-container">
      <nav class="sidebar">
        <div class="logo">
          <h1>LuminetDMX</h1>
        </div>
        
        <ul class="nav-menu">
          <li>
            <a routerLink="/virtual-console" routerLinkActive="active">
              <span class="icon">🎛️</span>
              Virtual Console
            </a>
          </li>
          <li>
            <a routerLink="/light-control" routerLinkActive="active">
              <span class="icon">🎨</span>
              Light Control
            </a>
          </li>
          <li>
            <a routerLink="/presets" routerLinkActive="active">
              <span class="icon">📋</span>
              Presets
            </a>
          </li>
          <li>
            <a routerLink="/console" routerLinkActive="active">
              <span class="icon">🎚️</span>
              Console
            </a>
          </li>
          <li>
            <a routerLink="/fixtures" routerLinkActive="active">
              <span class="icon">💡</span>
              Fixtures
            </a>
          </li>
          <li>
            <a routerLink="/patches" routerLinkActive="active">
              <span class="icon">🔌</span>
              Patches
            </a>
          </li>
          <li>
            <a routerLink="/groups" routerLinkActive="active">
              <span class="icon">👥</span>
              Groups
            </a>
          </li>
          <li>
            <a routerLink="/settings" routerLinkActive="active">
              <span class="icon">⚙️</span>
              Settings
            </a>
          </li>
        </ul>
        
        <div class="connection-status">
          <div class="status-indicator" [class.connected]="isConnected" [class.disconnected]="!isConnected">
            <span class="dot"></span>
            {{ isConnected ? 'Connected' : 'Disconnected' }}
          </div>
        </div>
      </nav>
      
      <main class="main-content">
        <router-outlet></router-outlet>
        <button class="floating-blackout" 
                [class.active]="isBlackedOut"
                (click)="toggleBlackout()" 
                [title]="isBlackedOut ? 'Restore from Blackout' : 'Blackout (all channels to 0)'">
          {{ isBlackedOut ? '🔆' : '⛔' }}
        </button>
        <div class="blackout-tooltip">{{ isBlackedOut ? 'Restore' : 'Blackout' }}</div>
        
        <button class="floating-clear-all" (click)="clearAll()" title="Clear All Channels">🧹</button>
        <div class="clear-all-tooltip">Clear All</div>
        <app-confirm-modal></app-confirm-modal>
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      min-height: 100vh;
    }

    .sidebar {
      width: 250px;
      background: rgba(15, 23, 42, 0.9);
      border-right: 1px solid rgba(148, 163, 184, 0.1);
      display: flex;
      flex-direction: column;
      backdrop-filter: blur(10px);
    }

    .logo {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .logo h1 {
      font-size: 20px;
      font-weight: 700;
      color: #3b82f6;
      margin: 0;
    }

    .nav-menu {
      flex: 1;
      list-style: none;
      padding: 20px 0;
      margin: 0;
    }

    .nav-menu li {
      margin-bottom: 4px;
    }

    .nav-menu a {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      color: #cbd5e1;
      text-decoration: none;
      transition: all 0.2s ease;
      border-right: 3px solid transparent;
    }

    .nav-menu a:hover {
      background: rgba(59, 130, 246, 0.1);
      color: #e2e8f0;
    }

    .nav-menu a.active {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border-right-color: #3b82f6;
    }

    .nav-menu .icon {
      margin-right: 12px;
      font-size: 18px;
    }

    .connection-status {
      padding: 20px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 500;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .connected .dot {
      background: #10b981;
    }

    .disconnected .dot {
      background: #ef4444;
    }

    .connected {
      color: #10b981;
    }

    .disconnected {
      color: #ef4444;
    }

    .main-content {
      flex: 1;
      overflow-x: hidden;
      position: relative;
    }

    .floating-blackout {
      position: fixed;
      right: 24px;
      bottom: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: #ef4444;
      color: white;
      font-size: 22px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .floating-blackout:hover {
      background: #dc2626;
    }

    .floating-blackout.active {
      background: #f59e0b;
      box-shadow: 0 10px 20px rgba(245, 158, 11, 0.4);
    }

    .floating-blackout.active:hover {
      background: #d97706;
    }

    .floating-clear-all {
      position: fixed;
      right: 24px;
      bottom: 100px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: #6366f1;
      color: white;
      font-size: 22px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.3);
      cursor: pointer;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .floating-clear-all:hover {
      background: #4f46e5;
    }

    .blackout-tooltip {
      position: fixed;
      right: 26px;
      bottom: 86px;
      background: rgba(15, 23, 42, 0.95);
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1100;
      display: none;
    }

    .clear-all-tooltip {
      position: fixed;
      right: 26px;
      bottom: 162px;
      background: rgba(15, 23, 42, 0.95);
      color: #e2e8f0;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 1100;
      display: none;
    }

    .floating-blackout:hover + .blackout-tooltip { display: block; }
    .floating-clear-all:hover + .clear-all-tooltip { display: block; }

    @media (max-width: 768px) {
      .sidebar {
        width: 100%;
        height: auto;
        position: fixed;
        bottom: 0;
        z-index: 1000;
        flex-direction: row;
        border-right: none;
        border-top: 1px solid rgba(148, 163, 184, 0.1);
      }

      .logo {
        display: none;
      }

      .nav-menu {
        display: flex;
        flex: 1;
        padding: 0;
        justify-content: space-around;
      }

      .nav-menu li {
        margin-bottom: 0;
        flex: 1;
      }

      .nav-menu a {
        flex-direction: column;
        padding: 12px 8px;
        text-align: center;
        border-right: none;
        border-top: 3px solid transparent;
        font-size: 12px;
      }

      .nav-menu a.active {
        border-right: none;
        border-top-color: #3b82f6;
      }

      .nav-menu .icon {
        margin-right: 0;
        margin-bottom: 4px;
        font-size: 16px;
      }

      .connection-status {
        display: none;
      }

      .main-content {
        padding-bottom: 80px;
      }
      
      .floating-blackout {
        bottom: 100px;
        right: 16px;
        width: 48px;
        height: 48px;
        font-size: 18px;
      }
      
      .floating-clear-all {
        bottom: 160px;
        right: 16px;
        width: 48px;
        height: 48px;
        font-size: 18px;
      }
      
      .blackout-tooltip {
        right: 18px;
        bottom: 154px;
        font-size: 11px;
        padding: 4px 8px;
      }
      
      .clear-all-tooltip {
        right: 18px;
        bottom: 214px;
        font-size: 11px;
        padding: 4px 8px;
      }
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  isConnected = false;
  isBlackedOut = false;
  private blackoutSubscription: Subscription | null = null;

  constructor(
    private websocketService: WebsocketService, 
    private api: ApiService,
    private blackoutService: BlackoutService
  ) {
    this.websocketService.connectionStatus$.subscribe(
      status => this.isConnected = status
    );
  }

  ngOnInit(): void {
    this.blackoutSubscription = this.blackoutService.blackoutState$.subscribe(
      state => this.isBlackedOut = state
    );
  }

  ngOnDestroy(): void {
    if (this.blackoutSubscription) {
      this.blackoutSubscription.unsubscribe();
    }
  }

  toggleBlackout(): void {
    this.blackoutService.toggleBlackout();
  }

  clearAll(): void {
    this.blackoutService.clearAll();
  }
}