import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { WebsocketService } from '../../services/websocket.service';
import { Patch, Group, FixtureTemplate, FixtureChannel } from '../../models/fixture.model';
import { Subscription } from 'rxjs';

interface FaderChannel {
  id: string;
  name: string;
  channel: number;
  value: number;
  type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other';
  patchName: string;
  groupColor?: string;
}

@Component({
  selector: 'app-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="console-container">
      <div class="console-header">
        <h1 class="text-xl">DMX Console</h1>
        <div class="console-controls">
          <div class="view-toggle">
            <button class="btn" [class.btn-primary]="viewMode === 'individual'" 
                    [class.btn-secondary]="viewMode !== 'individual'" 
                    (click)="setViewMode('individual')">
              Individual
            </button>
            <button class="btn" [class.btn-primary]="viewMode === 'groups'" 
                    [class.btn-secondary]="viewMode !== 'groups'" 
                    (click)="setViewMode('groups')">
              Groups
            </button>
          </div>
          <button class="btn btn-danger" (click)="blackout()">Blackout</button>
          <button class="btn btn-secondary" (click)="fullOn()">Full On</button>
        </div>
      </div>

      <!-- Individual Channel View -->
      <div class="faders-container" *ngIf="viewMode === 'individual'">
        <div class="fader-section" *ngFor="let section of channelSections; let sectionIndex = index">
          <h3 class="section-title">Channels {{ (sectionIndex * 24) + 1 }} - {{ getMaxChannel(sectionIndex) }}</h3>
          <div class="faders-grid">
            <div class="fader-control" *ngFor="let fader of section; let i = index">
              <div class="fader-info">
                <div class="channel-number">{{ fader.channel }}</div>
                <div class="channel-name" [title]="fader.name + ' (' + fader.patchName + ')'">
                  {{ fader.name }}
                </div>
                <div class="channel-type">{{ fader.type }}</div>
              </div>
              <div class="fader-wrapper">
                <input type="range" 
                       class="fader" 
                       min="0" 
                       max="255" 
                       [value]="fader.value"
                       (input)="updateChannelValue(fader.channel, $event)"
                       orientation="vertical">
                <div class="fader-value">{{ fader.value }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Control View -->
      <div class="groups-container" *ngIf="viewMode === 'groups'">
        <div class="group-control" *ngFor="let group of groups">
          <div class="group-header" [style.border-left-color]="group.color">
            <h3>{{ group.name }}</h3>
            <div class="group-meta">{{ getGroupPatches(group).length }} fixtures</div>
          </div>
          
          <div class="group-faders">
            <div class="group-master">
              <div class="fader-info">
                <div class="channel-name">Master</div>
                <div class="channel-type">group</div>
              </div>
              <div class="fader-wrapper">
                <input type="range" 
                       class="fader group-fader" 
                       min="0" 
                       max="255" 
                       [value]="getGroupMasterValue(group)"
                       (input)="updateGroupMaster(group, $event)">
                <div class="fader-value">{{ getGroupMasterValue(group) }}</div>
              </div>
            </div>
            
            <div class="individual-faders">
              <div class="fader-control group-individual" *ngFor="let patch of getGroupPatches(group)">
                <div class="fader-info">
                  <div class="channel-name">{{ patch.name }}</div>
                  <div class="fixture-address">{{ patch.startAddress }}-{{ getEndAddress(patch) }}</div>
                </div>
                <div class="fader-wrapper">
                  <input type="range" 
                         class="fader mini-fader" 
                         min="0" 
                         max="255" 
                         [value]="getPatchMasterValue(patch)"
                         (input)="updatePatchMaster(patch, $event)">
                  <div class="fader-value">{{ getPatchMasterValue(patch) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DMX Monitor -->
      <div class="dmx-monitor">
        <h3 class="text-lg mb-4">DMX Monitor</h3>
        <div class="monitor-grid">
          <div class="monitor-channel" 
               *ngFor="let value of dmxValues.slice(0, 64); let i = index"
               [class.active]="value > 0">
            <div class="channel-num">{{ i + 1 }}</div>
            <div class="channel-val">{{ value }}</div>
          </div>
        </div>
        <div class="monitor-info" *ngIf="hasActiveChannels()">
          Showing channels 1-64. Active channels: {{ getActiveChannelCount() }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .console-container {
      padding: 20px;
      min-height: 100vh;
    }

    .console-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .console-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .view-toggle {
      display: flex;
      gap: 4px;
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 4px;
    }

    .faders-container {
      margin-bottom: 40px;
    }

    .fader-section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 16px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .faders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 16px;
    }

    .fader-control {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 16px 12px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .fader-info {
      text-align: center;
      margin-bottom: 12px;
      width: 100%;
    }

    .channel-number {
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .channel-name {
      font-size: 12px;
      color: #e2e8f0;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .channel-type {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      background: rgba(148, 163, 184, 0.1);
      padding: 2px 4px;
      border-radius: 3px;
    }

    .fader-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 200px;
    }

    .fader {
      writing-mode: bt-lr;
      -webkit-appearance: slider-vertical;
      width: 8px;
      height: 150px;
      background: rgba(15, 23, 42, 0.8);
      outline: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .fader::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 12px;
      border-radius: 6px;
      background: #3b82f6;
      cursor: pointer;
    }

    .fader::-moz-range-thumb {
      width: 20px;
      height: 12px;
      border-radius: 6px;
      background: #3b82f6;
      cursor: pointer;
      border: none;
    }

    .fader-value {
      font-size: 12px;
      color: #cbd5e1;
      margin-top: 8px;
      font-weight: 500;
    }

    .groups-container {
      margin-bottom: 40px;
    }

    .group-control {
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border-left: 4px solid #3b82f6;
    }

    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .group-header h3 {
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .group-meta {
      font-size: 12px;
      color: #94a3b8;
    }

    .group-faders {
      display: flex;
      gap: 24px;
      align-items: flex-start;
    }

    .group-master {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: rgba(59, 130, 246, 0.1);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .group-fader {
      background: rgba(59, 130, 246, 0.2);
    }

    .group-fader::-webkit-slider-thumb {
      background: #60a5fa;
    }

    .group-fader::-moz-range-thumb {
      background: #60a5fa;
    }

    .individual-faders {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      flex: 1;
    }

    .group-individual {
      background: rgba(15, 23, 42, 0.5);
      padding: 12px 8px;
      min-width: 70px;
    }

    .group-individual .fader-wrapper {
      height: 120px;
    }

    .mini-fader {
      height: 80px;
    }

    .fixture-address {
      font-size: 10px;
      color: #64748b;
      font-family: 'Courier New', monospace;
    }

    .dmx-monitor {
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 20px;
    }

    .monitor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
      gap: 4px;
      margin-bottom: 12px;
    }

    .monitor-channel {
      background: rgba(15, 23, 42, 0.8);
      border-radius: 4px;
      padding: 4px 2px;
      text-align: center;
      border: 1px solid rgba(148, 163, 184, 0.1);
      transition: all 0.2s ease;
    }

    .monitor-channel.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .channel-num {
      font-size: 10px;
      color: #94a3b8;
    }

    .channel-val {
      font-size: 12px;
      font-weight: 500;
      color: #e2e8f0;
    }

    .monitor-info {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }

    @media (max-width: 1024px) {
      .faders-grid {
        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
      }
      
      .group-faders {
        flex-direction: column;
        gap: 16px;
      }
      
      .individual-faders {
        flex-direction: column;
        width: 100%;
      }
    }

    @media (max-width: 768px) {
      .console-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      
      .console-controls {
        justify-content: center;
        flex-wrap: wrap;
      }
      
      .faders-grid {
        grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      }
      
      .monitor-grid {
        grid-template-columns: repeat(8, 1fr);
      }
    }
  `]
})
export class ConsoleComponent implements OnInit, OnDestroy {
  patches: Patch[] = [];
  groups: Group[] = [];
  templates: FixtureTemplate[] = [];
  dmxValues: number[] = new Array(512).fill(0);
  channelSections: FaderChannel[][] = [];
  viewMode: 'individual' | 'groups' = 'individual';
  
  private subscriptions: Subscription[] = [];

  constructor(
    private apiService: ApiService,
    private websocketService: WebsocketService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.subscribeToWebSocket();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadData(): void {
    this.apiService.getPatches().subscribe(patches => {
      this.patches = patches;
      this.buildChannelSections();
    });

    this.apiService.getGroups().subscribe(groups => {
      this.groups = groups;
    });

    this.apiService.getFixtureTemplates().subscribe(templates => {
      this.templates = templates;
      this.buildChannelSections();
    });

    this.apiService.getDmxValues().subscribe(values => {
      this.dmxValues = values;
    });
  }

  subscribeToWebSocket(): void {
    const dmxSub = this.websocketService.dmxValues$.subscribe(
      values => {
        this.dmxValues = values;
        this.updateFaderValues();
        this.logDebug('DMX values updated via WebSocket', values);
      }
    );
    this.subscriptions.push(dmxSub);
  }

  buildChannelSections(): void {
    const faderChannels: FaderChannel[] = [];
    
    for (let i = 1; i <= 512; i++) {
      let faderChannel: FaderChannel = {
        id: `ch-${i}`,
        name: `Ch ${i}`,
        channel: i,
        value: 0,
        type: 'other',
        patchName: ''
      };

      const patch = this.patches.find(p => {
        const template = this.getTemplate(p.templateId);
        if (!template) return false;
        return i >= p.startAddress && i < (p.startAddress + template.channelCount);
      });

      if (patch) {
        const template = this.getTemplate(patch.templateId);
        if (template) {
          const channelOffset = i - patch.startAddress;
          const channelDef = template.channels[channelOffset];
          if (channelDef) {
            faderChannel.name = channelDef.name;
            faderChannel.type = channelDef.type;
            faderChannel.patchName = patch.name;
            
            const group = this.groups.find(g => g.patchIds.includes(patch.id));
            if (group) {
              faderChannel.groupColor = group.color;
            }
          }
        }
      }

      faderChannels.push(faderChannel);
    }

    this.channelSections = [];
    for (let i = 0; i < faderChannels.length; i += 24) {
      this.channelSections.push(faderChannels.slice(i, i + 24));
    }
  }

  getTemplate(templateId: string): FixtureTemplate | undefined {
    return this.templates.find(t => t.id === templateId);
  }

  getGroupPatches(group: Group): Patch[] {
    return this.patches.filter(p => group.patchIds.includes(p.id));
  }

  getEndAddress(patch: Patch): number {
    const template = this.getTemplate(patch.templateId);
    if (!template) return patch.startAddress;
    return patch.startAddress + template.channelCount - 1;
  }

  setViewMode(mode: 'individual' | 'groups'): void {
    this.viewMode = mode;
  }

  updateChannelValue(channel: number, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value);
    this.logDebug(`Setting DMX channel ${channel} to value ${value}`);
    
    this.apiService.setDmxChannel(channel, value).subscribe(
      response => {
        this.logDebug(`Successfully set channel ${channel}`, response);
      },
      error => {
        this.logDebug(`Error setting channel ${channel}`, error);
      }
    );
    
    const sectionIndex = Math.floor((channel - 1) / 24);
    const channelIndex = (channel - 1) % 24;
    if (this.channelSections[sectionIndex] && this.channelSections[sectionIndex][channelIndex]) {
      this.channelSections[sectionIndex][channelIndex].value = value;
    }
  }

  getGroupMasterValue(group: Group): number {
    const patches = this.getGroupPatches(group);
    if (patches.length === 0) return 0;
    
    const values = patches.map(p => this.getPatchMasterValue(p));
    return Math.max(...values);
  }

  getPatchMasterValue(patch: Patch): number {
    const template = this.getTemplate(patch.templateId);
    if (!template) return 0;
    
    const dimmerChannel = template.channels.find(ch => ch.type === 'dimmer');
    if (!dimmerChannel) return 0;
    
    const channelNumber = patch.startAddress + dimmerChannel.channelOffset - 1;
    return this.dmxValues[channelNumber] || 0;
  }

  updateGroupMaster(group: Group, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value);
    const patches = this.getGroupPatches(group);
    
    const channelUpdates: { channel: number; value: number }[] = [];
    
    patches.forEach(patch => {
      const template = this.getTemplate(patch.templateId);
      if (template) {
        const dimmerChannel = template.channels.find(ch => ch.type === 'dimmer');
        if (dimmerChannel) {
          const channelNumber = patch.startAddress + dimmerChannel.channelOffset - 1;
          channelUpdates.push({ channel: channelNumber + 1, value });
        }
      }
    });
    
    if (channelUpdates.length > 0) {
      this.apiService.setMultipleDmxChannels(channelUpdates).subscribe();
    }
  }

  updatePatchMaster(patch: Patch, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value);
    const template = this.getTemplate(patch.templateId);
    
    if (template) {
      const dimmerChannel = template.channels.find(ch => ch.type === 'dimmer');
      if (dimmerChannel) {
        const channelNumber = patch.startAddress + dimmerChannel.channelOffset - 1;
        this.apiService.setDmxChannel(channelNumber + 1, value).subscribe();
      }
    }
  }

  blackout(): void {
    this.logDebug('Executing blackout - setting all channels to 0');
    const channelUpdates: { channel: number; value: number }[] = [];
    for (let i = 1; i <= 512; i++) {
      channelUpdates.push({ channel: i, value: 0 });
    }
    this.apiService.setMultipleDmxChannels(channelUpdates).subscribe(
      response => this.logDebug('Blackout completed', response),
      error => this.logDebug('Blackout failed', error)
    );
  }

  fullOn(): void {
    this.logDebug('Executing full on - setting all channels to 255');
    const channelUpdates: { channel: number; value: number }[] = [];
    for (let i = 1; i <= 512; i++) {
      channelUpdates.push({ channel: i, value: 255 });
    }
    this.apiService.setMultipleDmxChannels(channelUpdates).subscribe(
      response => this.logDebug('Full on completed', response),
      error => this.logDebug('Full on failed', error)
    );
  }

  getActiveChannelCount(): number {
    return this.dmxValues.slice(0, 64).filter(v => v > 0).length;
  }

  hasActiveChannels(): boolean {
    return this.dmxValues.slice(0, 64).some(v => v > 0);
  }

  getMaxChannel(sectionIndex: number): number {
    return Math.min((sectionIndex + 1) * 24, 512);
  }

  updateFaderValues(): void {
    this.channelSections.forEach((section, sectionIndex) => {
      section.forEach((fader, faderIndex) => {
        const channelIndex = fader.channel - 1;
        if (channelIndex >= 0 && channelIndex < this.dmxValues.length) {
          fader.value = this.dmxValues[channelIndex];
        }
      });
    });
  }

  private logDebug(message: string, data?: any): void {
    const settings = JSON.parse(localStorage.getItem('luminetDmxSettings') || '{}');
    if (settings.enableLogging) {
      console.log(`[LuminetDMX Debug] ${message}`, data);
    }
  }
}