import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { WebsocketService } from '../../services/websocket.service';
import { Patch, FixtureTemplate, FixtureChannel, Preset, PresetChannelValue, Group } from '../../models/fixture.model';
import { Subscription } from 'rxjs';

interface LightControl {
  patch: Patch;
  template: FixtureTemplate;
  channels: FixtureChannel[];
  selected: boolean;
}

interface CommonParameter {
  name: string;
  type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other';
  channels: {
    patchId: string;
    channelNumber: number;
    channelOffset: number;
  }[];
  value: number;
}

interface ColorControl {
  red: number;
  green: number;
  blue: number;
  amber?: number;
  white?: number;
}

@Component({
  selector: 'app-light-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="control-container">
      <div class="page-header">
        <h1 class="text-xl">Light Control</h1>
        <div class="header-controls">
          <button class="btn btn-secondary" (click)="selectAll()">Select All</button>
          <button class="btn btn-secondary" (click)="clearSelection()">Clear All</button>
          <span class="selection-count">{{ getSelectedCount() }} selected</span>
        </div>
      </div>

      <!-- Groups Row -->
      <div class="groups-row" *ngIf="groups.length > 0">
        <div class="group-chip"
             *ngFor="let group of groups"
             (click)="toggleGroup(group)"
             [class.selected]="isGroupFullySelected(group)"
             [title]="group.patchIds.length + ' fixtures'">
          <span class="group-color" [style.background-color]="group.color"></span>
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ group.patchIds.length }}</span>
        </div>
      </div>

      <!-- Light Selection Grid -->
      <div class="lights-grid">
        <div class="light-square" 
             *ngFor="let light of lights" 
             [class.selected]="light.selected"
             (click)="toggleLight(light)"
             [title]="light.patch.name + ' - ' + light.template.name + ' (U' + light.patch.universe + ' Ch' + light.patch.startAddress + '-' + getEndAddress(light) + ')'">
          <div class="light-content">
            <div class="light-name">{{ light.patch.name }}</div>
            <div class="light-address">U{{ light.patch.universe }}</div>
            <div class="channel-range">{{ light.patch.startAddress }}-{{ getEndAddress(light) }}</div>
          </div>
          <div class="selection-indicator" *ngIf="light.selected">✓</div>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="control-panel" *ngIf="getSelectedCount() > 0">
        <h2 class="control-title">
          Control Panel - {{ getSelectedCount() }} light{{ getSelectedCount() !== 1 ? 's' : '' }} selected
        </h2>

        <div class="parameters-grid">
          <!-- Non-Color Parameters Only -->
          <div class="parameter-section" *ngFor="let param of getNonColorParameters()">
            
            <!-- Dimmer Control -->
            <div class="parameter-control" *ngIf="param.type === 'dimmer'">
              <label class="parameter-label">{{ param.name }}</label>
              <div class="fader-control-vertical">
                <input type="range" 
                       class="parameter-fader dimmer-fader"
                       min="0" 
                       max="255" 
                       [(ngModel)]="param.value"
                       (input)="updateParameter(param, $event)"
                       orientation="vertical">
                <div class="fader-value">{{ dmxToPercentage(param.value) }}%</div>
              </div>
            </div>

            <!-- Other Parameters -->
            <div class="parameter-control" *ngIf="param.type !== 'dimmer'">
              <label class="parameter-label">{{ param.name }}</label>
              <div class="fader-control-vertical">
                <input type="range" 
                       class="parameter-fader"
                       [class]="param.type + '-fader'"
                       min="0" 
                       max="255" 
                       [(ngModel)]="param.value"
                       (input)="updateParameter(param, $event)"
                       orientation="vertical">
                <div class="fader-value">{{ param.value }}</div>
              </div>
            </div>

          </div>
        </div>

        <!-- Color Control Section (Outside Grid) -->
        <div class="color-control-section" *ngIf="hasColorControl()">
          <div class="color-control-container">
            <h3 class="color-control-title">Color Control</h3>
            <div class="color-controls">
              <div class="color-wheel-container">
                <input type="color" 
                       class="color-wheel"
                       [value]="rgbToHex(colorControl.red, colorControl.green, colorControl.blue)"
                       (change)="updateColorFromWheel($event)">
              </div>
              <div class="color-sliders">
                <div class="color-fader-column">
                  <label>Red</label>
                  <input type="range" min="0" max="255" 
                         [(ngModel)]="colorControl.red" 
                         (input)="updateColorChannels()"
                         class="color-fader red-fader"
                         orientation="vertical">
                  <span>{{ colorControl.red }}</span>
                </div>
                <div class="color-fader-column">
                  <label>Green</label>
                  <input type="range" min="0" max="255" 
                         [(ngModel)]="colorControl.green" 
                         (input)="updateColorChannels()"
                         class="color-fader green-fader"
                         orientation="vertical">
                  <span>{{ colorControl.green }}</span>
                </div>
                <div class="color-fader-column">
                  <label>Blue</label>
                  <input type="range" min="0" max="255" 
                         [(ngModel)]="colorControl.blue" 
                         (input)="updateColorChannels()"
                         class="color-fader blue-fader"
                         orientation="vertical">
                  <span>{{ colorControl.blue }}</span>
                </div>
                <div class="color-fader-column" *ngIf="colorControl.amber !== undefined">
                  <label>Amber</label>
                  <input type="range" min="0" max="255" 
                         [(ngModel)]="colorControl.amber" 
                         (input)="updateColorChannels()"
                         class="color-fader amber-fader"
                         orientation="vertical">
                  <span>{{ colorControl.amber }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button class="btn btn-danger" (click)="blackoutSelected()">Blackout Selected</button>
          <button class="btn btn-primary" (click)="fullOnSelected()">Full On Selected</button>
          <button class="btn btn-success" (click)="saveAsPreset()">Save as Preset</button>
        </div>
      </div>

      <!-- Save Preset Modal -->
      <div class="modal-overlay" *ngIf="showPresetModal" (click)="cancelPresetModal()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Save as Preset</h2>
          <form (ngSubmit)="confirmSavePreset()" #presetForm="ngForm">
            <div class="form-group">
              <label class="label">Preset Name</label>
              <input type="text" class="input" [(ngModel)]="newPresetName" name="presetName" required>
            </div>
            <div class="form-group">
              <label class="label">Description (optional)</label>
              <textarea class="input" [(ngModel)]="newPresetDescription" name="presetDescription" 
                        rows="3" placeholder="Describe this preset..."></textarea>
            </div>
            <div class="form-group">
              <label class="label">Fade Duration (ms)</label>
              <input type="number" class="input" min="0" step="50" [(ngModel)]="newPresetFadeMs" name="fadeMs" placeholder="e.g. 1000">
            </div>
            <div class="preset-preview-info">
              <p>This preset will save {{ presetChannelData.length }} channel values that are currently non-zero.</p>
            </div>
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelPresetModal()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="!presetForm.valid">Save Preset</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="lights.length === 0">
        <div class="card text-center">
          <h3>No lights configured</h3>
          <p>Create some lighting patches first to control lights from here.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .control-container {
      padding: 20px;
      min-height: 100vh;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 20px 0 16px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .groups-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .group-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.2);
      color: #cbd5e1;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .group-chip:hover {
      background: rgba(59, 130, 246, 0.08);
      border-color: rgba(59, 130, 246, 0.3);
    }

    .group-chip.selected {
      background: rgba(59, 130, 246, 0.15);
      border-color: #3b82f6;
      color: #e2e8f0;
    }

    .group-color {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .group-name {
      font-weight: 600;
      font-size: 13px;
    }

    .group-count {
      font-size: 12px;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.15);
      padding: 2px 6px;
      border-radius: 999px;
    }

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .selection-count {
      color: #94a3b8;
      font-size: 14px;
      margin-left: 8px;
    }

    .lights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .light-square {
      aspect-ratio: 1;
      background: rgba(30, 41, 59, 0.6);
      border-radius: 8px;
      padding: 8px;
      border: 2px solid rgba(148, 163, 184, 0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .light-square:hover {
      border-color: rgba(59, 130, 246, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .light-square.selected {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.15);
      box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
    }

    .light-content {
      text-align: center;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
    }

    .light-name {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      line-height: 1.2;
      word-break: break-word;
      text-align: center;
    }

    .light-address {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 500;
    }

    .channel-range {
      font-size: 8px;
      color: #64748b;
      font-family: 'Courier New', monospace;
    }

    .light-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .address-info {
      font-size: 12px;
      color: #3b82f6;
      font-family: 'Courier New', monospace;
    }

    .channel-count {
      font-size: 12px;
      color: #94a3b8;
    }

    .selection-indicator {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 18px;
      height: 18px;
      background: #10b981;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 12px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .control-panel {
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .control-title {
      font-size: 20px;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .parameters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
      width: 100%;
    }

    .parameter-control {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 240px;
    }

    .parameter-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #cbd5e1;
      margin-bottom: 12px;
      text-align: center;
    }

    .fader-control-vertical {
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 200px;
    }

    .parameter-fader {
      writing-mode: bt-lr;
      -webkit-appearance: slider-vertical;
      width: 8px;
      height: 150px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.8);
      outline: none;
      cursor: pointer;
      margin-bottom: 8px;
    }

    .parameter-fader::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 12px;
      border-radius: 6px;
      background: #3b82f6;
      cursor: pointer;
    }

    .parameter-fader::-moz-range-thumb {
      width: 20px;
      height: 12px;
      border-radius: 6px;
      background: #3b82f6;
      cursor: pointer;
      border: none;
    }

    .dimmer-fader::-webkit-slider-thumb {
      background: #10b981;
    }

    .dimmer-fader::-moz-range-thumb {
      background: #10b981;
    }

    .fader-value {
      font-size: 14px;
      font-weight: 500;
      color: #e2e8f0;
      text-align: center;
      min-width: 40px;
    }

    .color-control-section {
      margin: 32px 0;
      width: 100%;
    }

    .color-control-container {
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      max-width: 600px;
      margin: 0 auto;
    }

    .color-control-title {
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 20px;
      text-align: center;
    }

    .color-controls {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      width: 100%;
      justify-content: center;
    }

    .color-wheel-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .color-wheel {
      width: 80px;
      height: 80px;
      border: none;
      border-radius: 50%;
      cursor: pointer;
    }

    .color-preview {
      width: 60px;
      height: 30px;
      border-radius: 6px;
      border: 2px solid rgba(148, 163, 184, 0.2);
    }

    .color-sliders {
      display: flex;
      flex-direction: row;
      gap: 16px;
      align-items: flex-start;
    }

    .color-fader-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      flex: 1;
      max-width: 80px;
    }

    .color-fader-column label {
      font-size: 13px;
      font-weight: 500;
      color: #cbd5e1;
      text-align: center;
      margin-bottom: 4px;
    }

    .color-fader-column span {
      font-size: 13px;
      color: #e2e8f0;
      text-align: center;
      margin-top: 4px;
      font-weight: 500;
    }

    .color-fader {
      writing-mode: bt-lr;
      -webkit-appearance: slider-vertical;
      width: 8px;
      height: 120px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.8);
      outline: none;
      cursor: pointer;
    }

    .color-fader::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 10px;
      border-radius: 5px;
      cursor: pointer;
    }

    .color-fader::-moz-range-thumb {
      width: 18px;
      height: 10px;
      border-radius: 5px;
      cursor: pointer;
      border: none;
    }

    .red-fader::-webkit-slider-thumb { background: #ef4444; }
    .green-fader::-webkit-slider-thumb { background: #10b981; }
    .blue-fader::-webkit-slider-thumb { background: #3b82f6; }
    .amber-fader::-webkit-slider-thumb { background: #f59e0b; }

    .red-fader::-moz-range-thumb { background: #ef4444; }
    .green-fader::-moz-range-thumb { background: #10b981; }
    .blue-fader::-moz-range-thumb { background: #3b82f6; }
    .amber-fader::-moz-range-thumb { background: #f59e0b; }

    .quick-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      padding-top: 16px;
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .empty-state {
      text-align: center;
      margin-top: 60px;
    }

    .empty-state h3 {
      font-size: 20px;
      margin-bottom: 8px;
      color: #94a3b8;
    }

    .empty-state p {
      color: #64748b;
      margin-bottom: 20px;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: rgba(30, 41, 59, 0.95);
      border-radius: 12px;
      padding: 24px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal-content h2 {
      color: #e2e8f0;
      margin-bottom: 20px;
      font-size: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .preset-preview-info {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 20px;
    }

    .preset-preview-info p {
      color: #cbd5e1;
      margin: 0;
      font-size: 14px;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    @media (max-width: 768px) {
      .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      
      .header-controls {
        justify-content: center;
      }

      .lights-grid {
        grid-template-columns: repeat(auto-fill, minmax(75px, 1fr));
        gap: 8px;
      }
      
      .light-square {
        padding: 6px;
      }
      
      .light-name {
        font-size: 10px;
      }
      
      .light-address {
        font-size: 8px;
      }
      
      .channel-range {
        font-size: 7px;
      }
      
      .selection-indicator {
        width: 16px;
        height: 16px;
        top: 3px;
        right: 3px;
        font-size: 10px;
      }

      .parameters-grid {
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      }

      .parameter-control {
        min-height: 200px;
        padding: 12px;
      }

      .parameter-fader {
        height: 120px;
      }

      .fader-control-vertical {
        height: 160px;
      }

      .color-control-container {
        max-width: none;
        margin: 0;
        padding: 16px;
      }
      
      .color-controls {
        flex-direction: column;
        align-items: center;
      }
      
      .color-sliders {
        width: 100%;
        justify-content: center;
      }
      
      .color-fader {
        height: 100px;
      }
    }
  `]
})
export class LightControlComponent implements OnInit, OnDestroy {
  lights: LightControl[] = [];
  patches: Patch[] = [];
  templates: FixtureTemplate[] = [];
  groups: Group[] = [];
  commonParameters: CommonParameter[] = [];
  colorControl: ColorControl = { red: 0, green: 0, blue: 0 };
  showPresetModal = false;
  newPresetName = '';
  newPresetDescription = '';
  newPresetFadeMs?: number;
  presetChannelData: PresetChannelValue[] = [];
  
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
      this.buildLightControls();
    });

    this.apiService.getFixtureTemplates().subscribe(templates => {
      this.templates = templates;
      this.buildLightControls();
    });

    this.apiService.getGroups().subscribe(groups => {
      this.groups = groups;
    });
  }

  subscribeToWebSocket(): void {
    const dmxSub = this.websocketService.dmxValues$.subscribe(
      values => {
        // Update current values if needed
      }
    );
    this.subscriptions.push(dmxSub);
  }

  buildLightControls(): void {
    if (!this.patches.length || !this.templates.length) return;

    this.lights = this.patches.map(patch => {
      const template = this.templates.find(t => t.id === patch.templateId);
      return {
        patch,
        template: template!,
        channels: template!.channels,
        selected: false
      };
    }).filter(light => light.template);
    
    this.updateCommonParameters();
  }

  toggleLight(light: LightControl): void {
    light.selected = !light.selected;
    this.updateCommonParameters();
  }

  selectAll(): void {
    this.lights.forEach(light => light.selected = true);
    this.updateCommonParameters();
  }

  clearSelection(): void {
    this.lights.forEach(light => light.selected = false);
    this.updateCommonParameters();
  }

  toggleGroup(group: Group): void {
    const groupLightIds = new Set(group.patchIds);
    const allSelected = this.lights
      .filter(l => groupLightIds.has(l.patch.id))
      .every(l => l.selected);

    this.lights.forEach(light => {
      if (groupLightIds.has(light.patch.id)) {
        light.selected = !allSelected;
      }
    });
    this.updateCommonParameters();
  }

  isGroupFullySelected(group: Group): boolean {
    const groupLightIds = new Set(group.patchIds);
    const groupLights = this.lights.filter(l => groupLightIds.has(l.patch.id));
    return groupLights.length > 0 && groupLights.every(l => l.selected);
  }

  getSelectedCount(): number {
    return this.lights.filter(l => l.selected).length;
  }

  getSelectedLights(): LightControl[] {
    return this.lights.filter(l => l.selected);
  }

  getEndAddress(light: LightControl): number {
    return light.patch.startAddress + light.template.channelCount - 1;
  }

  updateCommonParameters(): void {
    const selectedLights = this.getSelectedLights();
    if (selectedLights.length === 0) {
      this.commonParameters = [];
      return;
    }

    console.log('Selected lights:', selectedLights.map(l => ({ 
      name: l.patch.name, 
      template: l.template.name,
      templateId: l.template.id,
      channels: l.channels.map(c => ({ name: c.name, type: c.type, offset: c.channelOffset }))
    })));

    // Debug: Check if we have mixed templates
    const templateIds = new Set(selectedLights.map(l => l.template.id));
    console.log('Unique template IDs:', Array.from(templateIds));

    // Create a more robust approach: find channels that exist in ALL lights with matching type and name
    if (selectedLights.length === 1) {
      // Single light selected - show all its unique channels
      const uniqueChannels = new Map<string, FixtureChannel>();
      const light = selectedLights[0];
      
      light.channels.forEach(channel => {
        const key = `${channel.type}-${channel.name}`;
        // For single light, only keep the first occurrence of each type-name combination
        if (!uniqueChannels.has(key)) {
          uniqueChannels.set(key, channel);
        }
      });

      this.commonParameters = Array.from(uniqueChannels.values()).map(channel => ({
        name: channel.name,
        type: channel.type,
        channels: [{
          patchId: light.patch.id,
          channelNumber: light.patch.startAddress + channel.channelOffset - 1,
          channelOffset: channel.channelOffset
        }],
        value: 0
      }));
    } else {
      // Multiple lights - find truly common channels
      const firstLight = selectedLights[0];
      const commonParams: CommonParameter[] = [];

      // Get unique channels from first light
      const uniqueFirstLightChannels = new Map<string, FixtureChannel>();
      firstLight.channels.forEach(channel => {
        const key = `${channel.type}-${channel.name}`;
        if (!uniqueFirstLightChannels.has(key)) {
          uniqueFirstLightChannels.set(key, channel);
        }
      });

      // Check which channels exist in ALL other lights
      uniqueFirstLightChannels.forEach((firstChannel, key) => {
        const allHaveThisChannel = selectedLights.every(light => {
          // Check if this light has a channel with the same type and name
          return light.channels.some(channel => 
            channel.type === firstChannel.type && 
            channel.name === firstChannel.name
          );
        });

        if (allHaveThisChannel) {
          // Build channel mappings for all lights
          const channelMappings = selectedLights.map(light => {
            // Find the first matching channel in this light
            const matchingChannel = light.channels.find(channel =>
              channel.type === firstChannel.type && 
              channel.name === firstChannel.name
            )!;

            return {
              patchId: light.patch.id,
              channelNumber: light.patch.startAddress + matchingChannel.channelOffset - 1,
              channelOffset: matchingChannel.channelOffset
            };
          });

          commonParams.push({
            name: firstChannel.name,
            type: firstChannel.type,
            channels: channelMappings,
            value: 0
          });
        }
      });

      this.commonParameters = commonParams;
    }

    console.log('Common parameters:', this.commonParameters);
    this.updateColorControl();
  }

  updateColorControl(): void {
    const colorParams = this.commonParameters.filter(p => p.type === 'color');
    const red = colorParams.find(p => p.name.toLowerCase().includes('red'));
    const green = colorParams.find(p => p.name.toLowerCase().includes('green'));
    const blue = colorParams.find(p => p.name.toLowerCase().includes('blue'));
    const amber = colorParams.find(p => p.name.toLowerCase().includes('amber'));

    if (red && green && blue) {
      this.colorControl = {
        red: red.value,
        green: green.value,
        blue: blue.value,
        amber: amber?.value
      };
    }
  }

  isColorGroup(param: CommonParameter): boolean {
    const colorParams = this.commonParameters.filter(p => p.type === 'color');
    const hasRGB = colorParams.some(p => p.name.toLowerCase().includes('red')) &&
                   colorParams.some(p => p.name.toLowerCase().includes('green')) &&
                   colorParams.some(p => p.name.toLowerCase().includes('blue'));
    return hasRGB && param.type === 'color' && param.name.toLowerCase().includes('red');
  }

  updateParameter(param: CommonParameter, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value);
    param.value = value;

    // Update all channels for this parameter
    const channelUpdates = param.channels.map(channel => ({
      channel: channel.channelNumber,
      value: value
    }));

    this.apiService.setMultipleDmxChannels(channelUpdates).subscribe();
  }

  updateColorFromWheel(event: Event): void {
    const hex = (event.target as HTMLInputElement).value;
    const rgb = this.hexToRgb(hex);
    
    this.colorControl.red = rgb.r;
    this.colorControl.green = rgb.g;
    this.colorControl.blue = rgb.b;
    
    this.updateColorChannels();
  }

  updateColorChannels(): void {
    const colorParams = this.commonParameters.filter(p => p.type === 'color');
    const updates: { channel: number; value: number }[] = [];

    colorParams.forEach(param => {
      let value = 0;
      if (param.name.toLowerCase().includes('red')) {
        value = this.colorControl.red;
        param.value = value;
      } else if (param.name.toLowerCase().includes('green')) {
        value = this.colorControl.green;
        param.value = value;
      } else if (param.name.toLowerCase().includes('blue')) {
        value = this.colorControl.blue;
        param.value = value;
      } else if (param.name.toLowerCase().includes('amber') && this.colorControl.amber !== undefined) {
        value = this.colorControl.amber;
        param.value = value;
      }

      param.channels.forEach(channel => {
        updates.push({
          channel: channel.channelNumber,
          value: value
        });
      });
    });

    if (updates.length > 0) {
      this.apiService.setMultipleDmxChannels(updates).subscribe();
    }
  }

  blackoutSelected(): void {
    const selectedLights = this.getSelectedLights();
    const updates: { channel: number; value: number }[] = [];

    selectedLights.forEach(light => {
      for (let i = 0; i < light.template.channelCount; i++) {
        updates.push({
          channel: light.patch.startAddress + i,
          value: 0
        });
      }
    });

    this.apiService.setMultipleDmxChannels(updates).subscribe();
    this.resetParameterValues();
  }

  fullOnSelected(): void {
    const selectedLights = this.getSelectedLights();
    const updates: { channel: number; value: number }[] = [];

    selectedLights.forEach(light => {
      light.channels.forEach(channel => {
        if (channel.type === 'dimmer') {
          updates.push({
            channel: light.patch.startAddress + channel.channelOffset - 1,
            value: 255
          });
        }
      });
    });

    this.apiService.setMultipleDmxChannels(updates).subscribe();
    this.updateParameterValuesFromAction();
  }

  resetParameterValues(): void {
    this.commonParameters.forEach(param => param.value = 0);
    this.colorControl = { red: 0, green: 0, blue: 0, amber: 0 };
  }

  updateParameterValuesFromAction(): void {
    this.commonParameters.forEach(param => {
      if (param.type === 'dimmer') {
        param.value = 255;
      }
    });
  }

  rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  saveAsPreset(): void {
    this.apiService.getDmxValues().subscribe(dmxValues => {
      this.presetChannelData = this.buildPresetChannelData(dmxValues);
      this.newPresetName = '';
      this.newPresetDescription = '';
      this.showPresetModal = true;
    });
  }

  buildPresetChannelData(dmxValues: number[]): PresetChannelValue[] {
    const channelData: PresetChannelValue[] = [];

    dmxValues.forEach((value, index) => {
      if (value > 0) {
        const channelNumber = index + 1;
        const patchInfo = this.findPatchForChannel(channelNumber);
        
        channelData.push({
          channel: channelNumber,
          value: value,
          patchId: patchInfo?.patch.id,
          patchName: patchInfo?.patch.name,
          channelName: patchInfo?.channelName
        });
      }
    });

    return channelData;
  }

  findPatchForChannel(channelNumber: number): { patch: Patch; channelName?: string } | null {
    for (const light of this.lights) {
      const startAddress = light.patch.startAddress;
      const endAddress = startAddress + light.template.channelCount - 1;
      
      if (channelNumber >= startAddress && channelNumber <= endAddress) {
        const channelOffset = channelNumber - startAddress + 1;
        const templateChannel = light.template.channels.find(ch => ch.channelOffset === channelOffset);
        
        return {
          patch: light.patch,
          channelName: templateChannel?.name
        };
      }
    }
    return null;
  }

  confirmSavePreset(): void {
    const preset: Omit<Preset, 'id' | 'createdAt'> = {
      name: this.newPresetName,
      description: this.newPresetDescription || undefined,
      fadeMs: this.newPresetFadeMs,
      channelValues: this.presetChannelData
    };

    this.apiService.createPreset(preset).subscribe(
      response => {
        console.log('Preset created successfully:', response);
        this.cancelPresetModal();
      },
      error => {
        console.error('Error creating preset:', error);
      }
    );
  }

  cancelPresetModal(): void {
    this.showPresetModal = false;
    this.newPresetName = '';
    this.newPresetDescription = '';
    this.newPresetFadeMs = undefined;
    this.presetChannelData = [];
  }

  dmxToPercentage(dmxValue: number): number {
    return Math.round((dmxValue / 255) * 100);
  }

  percentageToDmx(percentage: number): number {
    return Math.round((percentage / 100) * 255);
  }

  hasColorControl(): boolean {
    return this.commonParameters.some(param => param.type === 'color');
  }

  getNonColorParameters(): CommonParameter[] {
    return this.commonParameters.filter(param => param.type !== 'color');
  }
}