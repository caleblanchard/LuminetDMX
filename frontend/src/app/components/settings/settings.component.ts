import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { WebsocketService } from '../../services/websocket.service';
import { ConfirmService } from '../../services/confirm.service';
import { UniverseConfig } from '../../models/fixture.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="header">
        <h1 class="text-xl">Settings</h1>
      </div>

      <div class="settings-sections">
        <!-- Art-Net Configuration -->
        <div class="card settings-section">
          <h2 class="text-lg mb-4">Art-Net Configuration</h2>
          
          <form (ngSubmit)="saveUniverseConfig()" #configForm="ngForm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Universe</label>
                <input type="number" 
                       class="input" 
                       [(ngModel)]="universeConfig.universe" 
                       name="universe" 
                       min="0" 
                       max="32767" 
                       required>
                <div class="field-help">Art-Net universe number (0-32767)</div>
              </div>
              <div>
                <label class="label">Broadcast IP Address</label>
                <input type="text" 
                       class="input" 
                       [(ngModel)]="universeConfig.broadcastIP" 
                       name="broadcastIP" 
                       pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                       placeholder="255.255.255.255"
                       required>
                <div class="field-help">IP address to broadcast Art-Net data</div>
              </div>
            </div>
            
            <div class="config-preview">
              <h3 class="text-lg mb-4">Current Configuration</h3>
              <div class="config-items">
                <div class="config-item">
                  <span class="config-label">Universe:</span>
                  <span class="config-value">{{ universeConfig.universe }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">Broadcast IP:</span>
                  <span class="config-value">{{ universeConfig.broadcastIP }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">Status:</span>
                  <span class="config-value" [class.status-connected]="isConnected" [class.status-disconnected]="!isConnected">
                    {{ isConnected ? 'Connected' : 'Disconnected' }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" [disabled]="!configForm.valid">
                Save Configuration
              </button>
              <button type="button" class="btn btn-secondary" (click)="testConnection()">
                Test Connection
              </button>
            </div>
          </form>
        </div>

        <!-- Network Information -->
        <div class="card settings-section">
          <h2 class="text-lg mb-4">Network Information</h2>
          
          <div class="network-info">
            <div class="info-item">
              <span class="info-label">Art-Net Port:</span>
              <span class="info-value">6454 (UDP)</span>
            </div>
            <div class="info-item">
              <span class="info-label">Protocol Version:</span>
              <span class="info-value">Art-Net 4</span>
            </div>
            <div class="info-item">
              <span class="info-label">Channels per Universe:</span>
              <span class="info-value">512</span>
            </div>
            <div class="info-item">
              <span class="info-label">Refresh Rate:</span>
              <span class="info-value">44 Hz (recommended)</span>
            </div>
          </div>
        </div>

        <!-- Application Information -->
        <div class="card settings-section">
          <h2 class="text-lg mb-4">Application Information</h2>
          
          <div class="app-info">
            <div class="info-item">
              <span class="info-label">Version:</span>
              <span class="info-value">1.0.0</span>
            </div>
            <div class="info-item">
              <span class="info-label">Backend Status:</span>
              <span class="info-value" [class.status-connected]="isConnected" [class.status-disconnected]="!isConnected">
                {{ isConnected ? 'Connected' : 'Disconnected' }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">License:</span>
              <span class="info-value">MIT License</span>
            </div>
          </div>
        </div>

        <!-- Advanced Settings -->
        <div class="card settings-section">
          <h2 class="text-lg mb-4">Advanced Settings</h2>
          
          <div class="advanced-settings">
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="settings.enableLogging">
                <span class="checkmark"></span>
                Enable Debug Logging
              </label>
              <div class="setting-help">Log DMX data and network activity to browser console</div>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="settings.autoReconnect">
                <span class="checkmark"></span>
                Auto-reconnect WebSocket
              </label>
              <div class="setting-help">Automatically reconnect to backend if connection is lost</div>
            </div>
            
            <div class="setting-item">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="settings.showChannelNumbers">
                <span class="checkmark"></span>
                Show Channel Numbers in Console
              </label>
              <div class="setting-help">Display DMX channel numbers on faders</div>
            </div>
            
            <div class="setting-item">
              <label class="label">DMX Channel Mode</label>
              <select class="input" [(ngModel)]="settings.dmxMode" name="dmxMode">
                <option value="HTP">HTP (Highest Takes Precedence)</option>
                <option value="LTP">LTP (Last Takes Precedence)</option>
              </select>
              <div class="setting-help">Determines how overlapping DMX channels are handled when multiple presets are active</div>
            </div>
          </div>
          
          <div class="form-actions">
            <button class="btn btn-primary" (click)="saveAdvancedSettings()">
              Save Advanced Settings
            </button>
            <button class="btn btn-secondary" (click)="resetSettings()">
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .header {
      margin-bottom: 24px;
    }

    .settings-sections {
      max-width: 800px;
    }

    .settings-section {
      margin-bottom: 32px;
    }

    .field-help {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
    }

    .config-preview {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .config-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .config-label {
      font-weight: 500;
      color: #cbd5e1;
    }

    .config-value {
      font-family: 'Courier New', monospace;
      color: #e2e8f0;
      background: rgba(30, 41, 59, 0.5);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .status-connected {
      color: #10b981 !important;
      background: rgba(16, 185, 129, 0.1) !important;
    }

    .status-disconnected {
      color: #ef4444 !important;
      background: rgba(239, 68, 68, 0.1) !important;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .network-info,
    .app-info {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .info-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .info-item:last-child {
      border-bottom: none;
    }

    .info-label {
      font-weight: 500;
      color: #cbd5e1;
    }

    .info-value {
      color: #94a3b8;
      font-size: 14px;
    }

    .advanced-settings {
      margin-bottom: 24px;
    }

    .setting-item {
      margin-bottom: 20px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      font-weight: 500;
      color: #e2e8f0;
      margin-bottom: 4px;
    }

    .checkbox-label input[type="checkbox"] {
      margin-right: 12px;
      width: 16px;
      height: 16px;
    }

    .setting-help {
      font-size: 12px;
      color: #94a3b8;
      margin-left: 28px;
    }

    @media (max-width: 768px) {
      .config-item,
      .info-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      
      .form-actions {
        flex-direction: column;
        gap: 8px;
      }
      
      .form-actions .btn {
        width: 100%;
      }
    }
  `]
})
export class SettingsComponent implements OnInit {
  universeConfig: UniverseConfig = {
    universe: 0,
    broadcastIP: '255.255.255.255'
  };

  settings = {
    enableLogging: false,
    autoReconnect: true,
    showChannelNumbers: true,
    dmxMode: 'HTP' as 'HTP' | 'LTP'
  };

  isConnected = false;

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadUniverseConfig();
    this.loadSettings();
    
    this.websocketService.connectionStatus$.subscribe(
      status => this.isConnected = status
    );
  }

  loadUniverseConfig(): void {
    this.apiService.getUniverseConfig().subscribe(
      config => this.universeConfig = config
    );
  }

  loadSettings(): void {
    const savedSettings = localStorage.getItem('luminetDmxSettings');
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }
  }

  saveUniverseConfig(): void {
    this.apiService.updateUniverseConfig(this.universeConfig).subscribe(
      config => {
        this.universeConfig = config;
        this.confirm.ask({ title: 'Saved', message: 'Art-Net configuration saved successfully!', confirmText: 'OK', hideCancel: true }).subscribe();
      },
      error => {
        this.confirm.ask({ title: 'Error', message: 'Failed to save configuration. Please check your settings.', confirmText: 'OK', hideCancel: true }).subscribe();
      }
    );
  }

  saveAdvancedSettings(): void {
    localStorage.setItem('luminetDmxSettings', JSON.stringify(this.settings));
    
    // Trigger a custom event to notify other services of settings change
    window.dispatchEvent(new CustomEvent('luminetDmxSettingsChanged', { 
      detail: this.settings 
    }));
    
    if (this.settings.enableLogging) {
      console.log('[LuminetDMX Settings] Debug logging enabled - you should now see debug messages in the console');
      console.log('[LuminetDMX Settings] Current settings:', this.settings);
    }

    this.confirm
      .ask({ title: 'Saved', message: 'Advanced settings saved successfully!', confirmText: 'OK', hideCancel: true })
      .subscribe();
  }

  resetSettings(): void {
    this.confirm.ask({
      title: 'Reset to Defaults',
      message: 'Are you sure you want to reset all settings to defaults?',
      confirmText: 'Reset',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        this.settings = {
          enableLogging: false,
          autoReconnect: true,
          showChannelNumbers: true,
          dmxMode: 'HTP' as 'HTP' | 'LTP'
        };

        this.universeConfig = {
          universe: 0,
          broadcastIP: '255.255.255.255'
        };

        localStorage.removeItem('luminetDmxSettings');
        this.saveUniverseConfig();
        this.confirm
          .ask({ title: 'Reset', message: 'Settings reset to defaults!', confirmText: 'OK', hideCancel: true })
          .subscribe();
      }
    });
  }

  testConnection(): void {
    if (!this.isConnected) {
      alert('No connection to backend server. Please check if the server is running.');
      return;
    }
    
    this.apiService.setDmxChannel(1, 128).subscribe(
      () => {
        this.confirm.ask({ title: 'Test Sent', message: 'Test signal sent successfully! Check your lighting equipment.', confirmText: 'OK', hideCancel: true }).subscribe();
        setTimeout(() => {
          this.apiService.setDmxChannel(1, 0).subscribe();
        }, 2000);
      },
      error => {
        this.confirm.ask({ title: 'Test Failed', message: 'Test failed. Please check your Art-Net configuration.', confirmText: 'OK', hideCancel: true }).subscribe();
      }
    );
  }
}