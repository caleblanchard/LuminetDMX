import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { DmxCalculationService, ActiveElement } from '../../services/dmx-calculation.service';
import { Preset } from '../../models/fixture.model';
import { Subscription } from 'rxjs';

interface VirtualButton {
  id: string;
  name: string;
  presetIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  isActive: boolean;
  activatedAt?: number;
  fadeMs?: number;
}

interface VirtualFader {
  id: string;
  name: string;
  presetIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
  activatedAt?: number;
}

interface VirtualConsoleLayout {
  buttons: VirtualButton[];
  faders: VirtualFader[];
}

@Component({
  selector: 'app-virtual-console',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <div class="header-title">
          <h1 class="text-xl">Virtual Console</h1>
          <div class="dmx-mode-indicator">
            <span class="mode-label">DMX Mode:</span>
            <span class="mode-value" [class]="'mode-' + dmxMode.toLowerCase()">{{ dmxMode }}</span>
          </div>
        </div>
        <div class="header-controls">
          <button class="btn btn-secondary" (click)="toggleEditMode()">
            {{ editMode ? 'Exit Edit' : 'Edit Layout' }}
          </button>
          <button class="btn btn-primary" *ngIf="editMode" (click)="showAddModal = true">
            Add Element
          </button>
        </div>
      </div>

      <div class="console-area" 
           [class.edit-mode]="editMode"
           (click)="onConsoleClick($event)">
        
        <!-- Virtual Buttons -->
        <div *ngFor="let button of layout.buttons; trackBy: trackByButtonId"
             class="virtual-button"
             [class.active]="button.isActive"
             [class.editable]="editMode"
             [class.selected]="editMode && selectedElement?.type === 'button' && selectedElement?.id === button.id"
             [style.left.px]="button.x"
             [style.top.px]="button.y"
             [style.width.px]="button.width"
             [style.height.px]="button.height"
             (click)="editMode ? selectElement('button', button.id) : toggleButton(button)"
             (mousedown)="editMode ? onElementMouseDown($event, 'button', button.id) : null">
          <div class="button-content">
            <div class="element-name">{{ button.name }}</div>
            <div class="preset-count">{{ button.presetIds.length }} preset(s)</div>
          </div>
          <div class="resize-handles" *ngIf="editMode && resizingElement?.type === 'button' && resizingElement?.id === button.id">
            <div class="resize-handle nw" (mousedown)="startResize($event, 'nw')"></div>
            <div class="resize-handle ne" (mousedown)="startResize($event, 'ne')"></div>
            <div class="resize-handle sw" (mousedown)="startResize($event, 'sw')"></div>
            <div class="resize-handle se" (mousedown)="startResize($event, 'se')"></div>
            <div class="resize-handle n" (mousedown)="startResize($event, 'n')"></div>
            <div class="resize-handle s" (mousedown)="startResize($event, 's')"></div>
            <div class="resize-handle e" (mousedown)="startResize($event, 'e')"></div>
            <div class="resize-handle w" (mousedown)="startResize($event, 'w')"></div>
          </div>
          <div class="control-buttons" *ngIf="editMode">
            <button class="control-btn edit-btn" (click)="editElement('button', button.id); $event.stopPropagation()" title="Edit">✏️</button>
            <button class="control-btn resize-btn" 
                    [class.active]="resizingElement?.type === 'button' && resizingElement?.id === button.id"
                    (click)="toggleResize('button', button.id); $event.stopPropagation()" 
                    title="Resize">⤢</button>
            <button class="control-btn delete-btn" (click)="deleteElement('button', button.id); $event.stopPropagation()" title="Delete">×</button>
          </div>
        </div>

        <!-- Virtual Faders -->
        <div *ngFor="let fader of layout.faders; trackBy: trackByFaderId"
             class="virtual-fader"
             [class.editable]="editMode"
             [class.selected]="editMode && selectedElement?.type === 'fader' && selectedElement?.id === fader.id"
             [style.left.px]="fader.x"
             [style.top.px]="fader.y"
             [style.width.px]="fader.width"
             [style.height.px]="fader.height"
             (click)="editMode ? selectElement('fader', fader.id) : null"
             (mousedown)="editMode ? onElementMouseDown($event, 'fader', fader.id) : null">
          <div class="fader-content">
            <div class="element-name">{{ fader.name }}</div>
            <input type="range" 
                   class="fader-slider vertical" 
                   min="0" 
                   max="100" 
                   [(ngModel)]="fader.value"
                   (input)="onFaderChange(fader)"
                   (click)="$event.stopPropagation()"
                   [disabled]="editMode">
            <div class="fader-value">{{ fader.value }}%</div>
            <div class="preset-count">{{ fader.presetIds.length }} preset(s)</div>
          </div>
          <div class="resize-handles" *ngIf="editMode && resizingElement?.type === 'fader' && resizingElement?.id === fader.id">
            <div class="resize-handle nw" (mousedown)="startResize($event, 'nw')"></div>
            <div class="resize-handle ne" (mousedown)="startResize($event, 'ne')"></div>
            <div class="resize-handle sw" (mousedown)="startResize($event, 'sw')"></div>
            <div class="resize-handle se" (mousedown)="startResize($event, 'se')"></div>
            <div class="resize-handle n" (mousedown)="startResize($event, 'n')"></div>
            <div class="resize-handle s" (mousedown)="startResize($event, 's')"></div>
            <div class="resize-handle e" (mousedown)="startResize($event, 'e')"></div>
            <div class="resize-handle w" (mousedown)="startResize($event, 'w')"></div>
          </div>
          <div class="control-buttons" *ngIf="editMode">
            <button class="control-btn edit-btn" (click)="editElement('fader', fader.id); $event.stopPropagation()" title="Edit">✏️</button>
            <button class="control-btn resize-btn" 
                    [class.active]="resizingElement?.type === 'fader' && resizingElement?.id === fader.id"
                    (click)="toggleResize('fader', fader.id); $event.stopPropagation()" 
                    title="Resize">⤢</button>
            <button class="control-btn delete-btn" (click)="deleteElement('fader', fader.id); $event.stopPropagation()" title="Delete">×</button>
          </div>
        </div>
      </div>

      <!-- Add Element Modal -->
      <div class="modal-overlay" *ngIf="showAddModal" (click)="showAddModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Add New Element</h3>
          <div class="modal-content">
            <div class="form-group">
              <label>Element Type</label>
              <select [(ngModel)]="newElement.type" class="input">
                <option value="button">Button</option>
                <option value="fader">Fader</option>
              </select>
            </div>
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="newElement.name" class="input" placeholder="Element name">
            </div>
            <div class="form-group">
              <label>Presets</label>
              <div class="preset-selection">
                <div *ngFor="let preset of presets" class="preset-checkbox">
                  <label>
                    <input type="checkbox" 
                           [checked]="newElement.presetIds.includes(preset.id)"
                           (change)="togglePresetSelection(preset.id)">
                    {{ preset.name }}
                  </label>
                </div>
              </div>
            </div>
            <div class="form-group" *ngIf="newElement.type === 'button'">
              <label>Fade Duration (ms)</label>
              <input type="number" 
                     [(ngModel)]="newElement.fadeMs" 
                     class="input" 
                     placeholder="e.g. 1000 (optional)"
                     min="0" 
                     step="50">
              <div class="form-help">Duration for fade in/out transitions when button is pressed or released. Leave empty for instant changes.</div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showAddModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="addElement()" [disabled]="!newElement.name">Add</button>
          </div>
        </div>
      </div>

      <!-- Edit Element Modal -->
      <div class="modal-overlay" *ngIf="showEditModal" (click)="showEditModal = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Edit Element</h3>
          <div class="modal-content">
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="editingElement.name" class="input">
            </div>
            <div class="form-group">
              <label>Presets</label>
              <div class="preset-selection">
                <div *ngFor="let preset of presets" class="preset-checkbox">
                  <label>
                    <input type="checkbox" 
                           [checked]="editingElement.presetIds?.includes(preset.id)"
                           (change)="toggleEditPresetSelection(preset.id)">
                    {{ preset.name }}
                  </label>
                </div>
              </div>
            </div>
            <div class="form-group" *ngIf="selectedElement?.type === 'button'">
              <label>Fade Duration (ms)</label>
              <input type="number" 
                     [(ngModel)]="editingElement.fadeMs" 
                     class="input" 
                     placeholder="e.g. 1000 (optional)"
                     min="0" 
                     step="50">
              <div class="form-help">Duration for fade in/out transitions when button is pressed or released. Leave empty for instant changes.</div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" (click)="showEditModal = false">Cancel</button>
            <button class="btn btn-primary" (click)="saveElementEdit()">Save</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding: 20px 0 16px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .header-title {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dmx-mode-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }

    .mode-label {
      color: #94a3b8;
    }

    .mode-value {
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }

    .mode-value.mode-htp {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .mode-value.mode-ltp {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .console-area {
      position: relative;
      width: 100%;
      height: 600px;
      background: rgba(15, 23, 42, 0.3);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      overflow: hidden;
    }

    .console-area.edit-mode {
      background: rgba(15, 23, 42, 0.5);
      border: 2px dashed rgba(59, 130, 246, 0.3);
    }

    .virtual-button {
      position: absolute;
      background: rgba(30, 41, 59, 0.8);
      border: 2px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }

    .virtual-button:hover {
      border-color: rgba(59, 130, 246, 0.4);
      transform: translateY(-1px);
    }

    .virtual-button.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.5);
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);
    }

    .virtual-button.editable {
      border-style: dashed;
    }

    .virtual-button.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .virtual-fader {
      position: absolute;
      background: rgba(30, 41, 59, 0.8);
      border: 2px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 12px;
      user-select: none;
    }

    .virtual-fader:hover {
      border-color: rgba(59, 130, 246, 0.4);
    }

    .virtual-fader.editable {
      border-style: dashed;
    }

    .virtual-fader.selected {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }

    .button-content, .fader-content {
      text-align: center;
      color: #e2e8f0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    }

    .element-name {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .preset-count {
      font-size: 12px;
      color: #94a3b8;
    }

    .fader-slider {
      margin: 8px 0;
      accent-color: #3b82f6;
    }
    
    .fader-slider.vertical {
      -webkit-appearance: slider-vertical;
      width: 10px;
      height: 120px;
      background: linear-gradient(to top, #1e293b 0%, #475569 100%);
      outline: none;
      border-radius: 5px;
      cursor: pointer;
    }
    
    .fader-slider.vertical::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 3px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      cursor: pointer;
      border: 1px solid #1e40af;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    
    .fader-slider.vertical::-moz-range-track {
      width: 10px;
      height: 120px;
      background: linear-gradient(to top, #1e293b 0%, #475569 100%);
      border-radius: 5px;
      border: none;
    }
    
    .fader-slider.vertical::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 3px;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      cursor: pointer;
      border: 1px solid #1e40af;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    .fader-value {
      font-size: 14px;
      font-weight: 600;
      margin: 4px 0;
      color: #3b82f6;
    }

    .resize-handles {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }

    .resize-handle {
      position: absolute;
      width: 8px;
      height: 8px;
      background: #3b82f6;
      border: 1px solid white;
      border-radius: 2px;
      pointer-events: all;
      cursor: pointer;
    }

    .resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
    .resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
    .resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
    .resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
    .resize-handle.n { top: -4px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
    .resize-handle.s { bottom: -4px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
    .resize-handle.e { right: -4px; top: 50%; transform: translateY(-50%); cursor: e-resize; }
    .resize-handle.w { left: -4px; top: 50%; transform: translateY(-50%); cursor: w-resize; }

    .control-buttons {
      position: absolute;
      top: -8px;
      right: -8px;
      display: flex;
      gap: 4px;
    }

    .control-btn {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .edit-btn {
      background: #3b82f6;
    }

    .edit-btn:hover {
      background: #2563eb;
    }

    .resize-btn {
      background: #10b981;
      font-size: 14px;
    }

    .resize-btn:hover {
      background: #059669;
    }

    .resize-btn.active {
      background: #059669;
      box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
    }

    .delete-btn {
      background: #ef4444;
    }

    .delete-btn:hover {
      background: #dc2626;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal h3 {
      margin: 0 0 20px 0;
      color: #e2e8f0;
    }

    .modal-content {
      margin-bottom: 20px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #cbd5e1;
    }

    .form-help {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
      line-height: 1.4;
    }

    .preset-selection {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 4px;
      padding: 8px;
    }

    .preset-checkbox {
      margin-bottom: 8px;
    }

    .preset-checkbox label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      margin-bottom: 0;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    @media (max-width: 768px) {
      .console-area {
        height: 400px;
      }
      
      .header-controls {
        flex-direction: column;
        gap: 8px;
      }
      
      .header-controls .btn {
        width: 100%;
      }
      
      .page-header {
        flex-direction: column;
        align-items: stretch;
        gap: 16px;
      }
    }
  `]
})
export class VirtualConsoleComponent implements OnInit, OnDestroy {
  layout: VirtualConsoleLayout = {
    buttons: [],
    faders: []
  };
  
  presets: Preset[] = [];
  editMode = false;
  showAddModal = false;
  showEditModal = false;
  
  selectedElement: { type: 'button' | 'fader', id: string } | null = null;
  
  newElement = {
    type: 'button' as 'button' | 'fader',
    name: '',
    presetIds: [] as string[],
    fadeMs: undefined as number | undefined
  };
  
  editingElement: any = {};
  
  isDragging = false;
  isResizing = false;
  dragStartPos = { x: 0, y: 0 };
  elementStartPos = { x: 0, y: 0 };
  elementStartSize = { width: 0, height: 0 };
  resizeDirection = '';
  
  private dmxSubscription: Subscription | null = null;
  private clearAllListener: ((event: Event) => void) | null = null;
  private isFading = false;
  dmxMode: 'HTP' | 'LTP' = 'HTP';
  resizingElement: { type: 'button' | 'fader', id: string } | null = null;

  constructor(
    private apiService: ApiService,
    private confirm: ConfirmService,
    private dmxCalculation: DmxCalculationService
  ) {}

  ngOnInit(): void {
    this.loadPresets();
    this.loadLayout();
    this.setupDmxSubscription();
    this.loadDmxMode();
    this.setupSettingsListener();
    this.setupBeforeUnloadHandler();
    this.setupClearAllListener();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.dmxSubscription) {
      this.dmxSubscription.unsubscribe();
    }
    // Save current control states when leaving the page
    this.saveControlStates();
  }

  loadPresets(): void {
    this.apiService.getPresets().subscribe(presets => {
      this.presets = presets;
      
      // Cache preset data in the DMX calculation service
      presets.forEach(preset => {
        this.dmxCalculation.setPresetData(preset.id, preset.channelValues);
      });
    });
  }

  setupDmxSubscription(): void {
    this.dmxSubscription = this.dmxCalculation.dmxValues$.subscribe(dmxValues => {
      // Send DMX values to backend
      this.sendDmxValues(dmxValues);
    });
  }

  private sendDmxValues(dmxValues: Map<number, number>): void {
    // Don't send DMX values if we're in the middle of a fade operation
    if (this.isFading) {
      return;
    }
    
    // Convert to array format expected by backend
    const channels: { channel: number; value: number }[] = [];
    for (const [channel, value] of dmxValues) {
      channels.push({ channel, value });
    }
    
    // Send all channels including zero values to properly turn off lights
    this.apiService.setMultipleDmxChannels(channels).subscribe();
  }

  loadDmxMode(): void {
    const saved = localStorage.getItem('luminetDmxSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      this.dmxMode = settings.dmxMode || 'HTP';
    }
  }

  setupSettingsListener(): void {
    window.addEventListener('luminetDmxSettingsChanged', (e: any) => {
      this.dmxMode = e.detail.dmxMode || 'HTP';
    });
  }

  setupBeforeUnloadHandler(): void {
    // Save states when browser tab is closed or page is refreshed
    window.addEventListener('beforeunload', () => {
      this.saveControlStates();
    });
  }

  setupClearAllListener(): void {
    // Store the listener so we can remove it later
    this.clearAllListener = () => {
      this.clearAllElements();
    };
    // Listen for clear all event from blackout service
    window.addEventListener('clearAllChannels', this.clearAllListener);
  }

  clearAllElements(): void {
    // Reset all buttons to inactive
    this.layout.buttons.forEach(button => {
      button.isActive = false;
      button.activatedAt = undefined;
    });

    // Reset all faders to 0
    this.layout.faders.forEach(fader => {
      fader.value = 0;
      fader.activatedAt = undefined;
    });

    // Clear all active elements from DMX calculation service
    this.dmxCalculation.clearAll();

    // Save the updated states
    this.saveControlStates();
  }

  loadLayout(): void {
    const saved = localStorage.getItem('virtualConsoleLayout');
    if (saved) {
      this.layout = JSON.parse(saved);
    }
    this.loadControlStates();
  }

  loadControlStates(): void {
    const savedStates = localStorage.getItem('virtualConsoleStates');
    if (savedStates) {
      const states = JSON.parse(savedStates);
      
      // Restore button states
      if (states.buttons) {
        this.layout.buttons.forEach(button => {
          const savedState = states.buttons[button.id];
          if (savedState !== undefined) {
            button.isActive = savedState.isActive;
            button.activatedAt = savedState.activatedAt;
          }
        });
      }
      
      // Restore fader values
      if (states.faders) {
        this.layout.faders.forEach(fader => {
          const savedState = states.faders[fader.id];
          if (savedState !== undefined) {
            fader.value = savedState.value;
            fader.activatedAt = savedState.activatedAt;
          }
        });
      }
      
      // Restore DMX values after loading states
      this.updateDmxCalculation();
    }
  }

  saveControlStates(): void {
    const states = {
      buttons: {} as { [key: string]: { isActive: boolean; activatedAt?: number } },
      faders: {} as { [key: string]: { value: number; activatedAt?: number } }
    };
    
    // Save button states
    this.layout.buttons.forEach(button => {
      states.buttons[button.id] = {
        isActive: button.isActive,
        activatedAt: button.activatedAt
      };
    });
    
    // Save fader values
    this.layout.faders.forEach(fader => {
      states.faders[fader.id] = {
        value: fader.value,
        activatedAt: fader.activatedAt
      };
    });
    
    localStorage.setItem('virtualConsoleStates', JSON.stringify(states));
  }

  saveLayout(): void {
    localStorage.setItem('virtualConsoleLayout', JSON.stringify(this.layout));
    this.saveControlStates();
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;
    this.selectedElement = null;
    this.resizingElement = null;
    
    // Auto-save layout when exiting edit mode
    if (!this.editMode) {
      this.saveLayout();
    }
  }

  toggleResize(type: 'button' | 'fader', id: string): void {
    if (this.resizingElement?.type === type && this.resizingElement?.id === id) {
      // Turn off resize mode for this element
      this.resizingElement = null;
    } else {
      // Turn on resize mode for this element
      this.resizingElement = { type, id };
      this.selectedElement = { type, id }; // Also select it for visual feedback
    }
  }

  trackByButtonId(index: number, button: VirtualButton): string {
    return button.id;
  }

  trackByFaderId(index: number, fader: VirtualFader): string {
    return fader.id;
  }

  onConsoleClick(event: MouseEvent): void {
    if (!this.editMode) return;
    
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    this.selectedElement = null;
  }

  selectElement(type: 'button' | 'fader', id: string): void {
    if (!this.editMode) return;
    
    // Only select for dragging or resize mode - don't auto-edit
    this.selectedElement = { type, id };
  }

  editElement(type: 'button' | 'fader', id: string): void {
    const element = type === 'button' 
      ? this.layout.buttons.find(b => b.id === id)
      : this.layout.faders.find(f => f.id === id);
    
    if (element) {
      this.editingElement = { ...element };
      this.showEditModal = true;
    }
  }

  onElementMouseDown(event: MouseEvent, type: 'button' | 'fader', id: string): void {
    if (!this.editMode) return;
    
    // Don't allow dragging if this element is in resize mode
    if (this.resizingElement?.type === type && this.resizingElement?.id === id) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.selectedElement = { type, id };
    this.isDragging = true;
    
    this.dragStartPos = { x: event.clientX, y: event.clientY };
    
    const element = type === 'button' 
      ? this.layout.buttons.find(b => b.id === id)
      : this.layout.faders.find(f => f.id === id);
    
    if (element) {
      this.elementStartPos = { x: element.x, y: element.y };
    }
    
    this.addEventListeners();
  }

  startResize(event: MouseEvent, direction: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.isResizing = true;
    this.resizeDirection = direction;
    
    this.dragStartPos = { x: event.clientX, y: event.clientY };
    
    if (this.resizingElement) {
      const element = this.resizingElement.type === 'button' 
        ? this.layout.buttons.find(b => b.id === this.resizingElement!.id)
        : this.layout.faders.find(f => f.id === this.resizingElement!.id);
      
      if (element) {
        this.elementStartPos = { x: element.x, y: element.y };
        this.elementStartSize = { width: element.width, height: element.height };
      }
    }
    
    this.addEventListeners();
  }

  private addEventListeners(): void {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private removeEventListeners(): void {
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    
    // Remove clear all listener
    if (this.clearAllListener) {
      window.removeEventListener('clearAllChannels', this.clearAllListener);
      this.clearAllListener = null;
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const deltaX = event.clientX - this.dragStartPos.x;
    const deltaY = event.clientY - this.dragStartPos.y;
    
    if (this.isDragging && this.selectedElement) {
      const element = this.selectedElement.type === 'button' 
        ? this.layout.buttons.find(b => b.id === this.selectedElement!.id)
        : this.layout.faders.find(f => f.id === this.selectedElement!.id);
      
      if (element) {
        element.x = Math.max(0, this.elementStartPos.x + deltaX);
        element.y = Math.max(0, this.elementStartPos.y + deltaY);
      }
    } else if (this.isResizing && this.resizingElement) {
      const element = this.resizingElement.type === 'button' 
        ? this.layout.buttons.find(b => b.id === this.resizingElement!.id)
        : this.layout.faders.find(f => f.id === this.resizingElement!.id);
      
      if (!element) return;
      // Handle resizing based on direction
      const minSize = 60;
      
      switch (this.resizeDirection) {
        case 'se':
          element.width = Math.max(minSize, this.elementStartSize.width + deltaX);
          element.height = Math.max(minSize, this.elementStartSize.height + deltaY);
          break;
        case 'sw':
          const newWidthSW = this.elementStartSize.width - deltaX;
          if (newWidthSW >= minSize) {
            element.width = newWidthSW;
            element.x = this.elementStartPos.x + deltaX;
          }
          element.height = Math.max(minSize, this.elementStartSize.height + deltaY);
          break;
        case 'ne':
          element.width = Math.max(minSize, this.elementStartSize.width + deltaX);
          const newHeightNE = this.elementStartSize.height - deltaY;
          if (newHeightNE >= minSize) {
            element.height = newHeightNE;
            element.y = this.elementStartPos.y + deltaY;
          }
          break;
        case 'nw':
          const newWidthNW = this.elementStartSize.width - deltaX;
          const newHeightNW = this.elementStartSize.height - deltaY;
          if (newWidthNW >= minSize) {
            element.width = newWidthNW;
            element.x = this.elementStartPos.x + deltaX;
          }
          if (newHeightNW >= minSize) {
            element.height = newHeightNW;
            element.y = this.elementStartPos.y + deltaY;
          }
          break;
        case 'n':
          const newHeightN = this.elementStartSize.height - deltaY;
          if (newHeightN >= minSize) {
            element.height = newHeightN;
            element.y = this.elementStartPos.y + deltaY;
          }
          break;
        case 's':
          element.height = Math.max(minSize, this.elementStartSize.height + deltaY);
          break;
        case 'e':
          element.width = Math.max(minSize, this.elementStartSize.width + deltaX);
          break;
        case 'w':
          const newWidthW = this.elementStartSize.width - deltaX;
          if (newWidthW >= minSize) {
            element.width = newWidthW;
            element.x = this.elementStartPos.x + deltaX;
          }
          break;
      }
    }
  }

  private onMouseUp(): void {
    this.isDragging = false;
    this.isResizing = false;
    this.removeEventListeners();
  }

  toggleButton(button: VirtualButton): void {
    if (this.editMode) return;
    
    button.isActive = !button.isActive;
    button.activatedAt = button.isActive ? Date.now() : undefined;
    
    // If button has fade duration, handle fade directly for both on and off
    if (button.fadeMs && button.fadeMs > 0) {
      this.applyButtonWithFade(button);
    } else {
      // Normal DMX calculation for instant changes
      this.updateDmxCalculation();
    }
    
    this.saveControlStates();
  }

  private applyButtonWithFade(button: VirtualButton): void {
    // Set fading flag to prevent automatic DMX sending
    this.isFading = true;
    
    // Update the DMX calculation service to reflect the new button state
    // This won't send values to backend because of the fading flag
    this.updateDmxCalculation();
    
    // Get the target values that the DMX calculation service would produce
    const currentDmxMap = this.dmxCalculation.getCurrentDmxValues();
    const channels: { channel: number; value: number }[] = [];
    
    // Convert the map to the array format expected by the API
    for (const [channel, value] of currentDmxMap) {
      channels.push({ channel, value });
    }
    
    if (channels.length > 0) {
      // Send with fade to backend
      this.apiService.setMultipleDmxChannels(channels, button.fadeMs).subscribe({
        next: () => {
          // Fade completed successfully
          this.isFading = false;
          console.log(`Button "${button.name}" fade completed`);
        },
        error: (error) => {
          // Reset fading flag even on error
          this.isFading = false;
          console.error('Error applying button with fade:', error);
        }
      });
    } else {
      // No channels to fade, just reset the flag
      this.isFading = false;
    }
  }

  onFaderChange(fader: VirtualFader): void {
    if (this.editMode) return;
    
    fader.activatedAt = Date.now();
    this.updateDmxCalculation();
    this.saveControlStates();
  }

  private updateDmxCalculation(): void {
    // Update active buttons
    this.layout.buttons.forEach(button => {
      const activeElement: ActiveElement = {
        id: button.id,
        type: 'button',
        presetIds: button.presetIds,
        value: button.isActive ? 100 : 0,
        activatedAt: button.activatedAt || Date.now()
      };
      
      this.dmxCalculation.updateActiveElement(activeElement);
    });
    
    // Update active faders
    this.layout.faders.forEach(fader => {
      const activeElement: ActiveElement = {
        id: fader.id,
        type: 'fader',
        presetIds: fader.presetIds,
        value: fader.value,
        activatedAt: fader.activatedAt || Date.now()
      };
      
      this.dmxCalculation.updateActiveElement(activeElement);
    });
  }

  togglePresetSelection(presetId: string): void {
    const index = this.newElement.presetIds.indexOf(presetId);
    if (index > -1) {
      this.newElement.presetIds.splice(index, 1);
    } else {
      this.newElement.presetIds.push(presetId);
    }
  }

  toggleEditPresetSelection(presetId: string): void {
    const index = this.editingElement.presetIds.indexOf(presetId);
    if (index > -1) {
      this.editingElement.presetIds.splice(index, 1);
    } else {
      this.editingElement.presetIds.push(presetId);
    }
  }

  addElement(): void {
    const id = this.generateUUID();
    
    if (this.newElement.type === 'button') {
      const button: VirtualButton = {
        id,
        name: this.newElement.name,
        presetIds: [...this.newElement.presetIds],
        x: 50,
        y: 50,
        width: 120,
        height: 80,
        isActive: false,
        fadeMs: this.newElement.fadeMs
      };
      this.layout.buttons.push(button);
    } else {
      const fader: VirtualFader = {
        id,
        name: this.newElement.name,
        presetIds: [...this.newElement.presetIds],
        x: 50,
        y: 50,
        width: 80,
        height: 220,
        value: 0
      };
      this.layout.faders.push(fader);
    }
    
    this.newElement = {
      type: 'button',
      name: '',
      presetIds: [],
      fadeMs: undefined
    };
    
    this.showAddModal = false;
    
    // Save the new layout and initial states
    this.saveLayout();
  }

  saveElementEdit(): void {
    if (this.selectedElement) {
      const element = this.selectedElement.type === 'button' 
        ? this.layout.buttons.find(b => b.id === this.selectedElement!.id)
        : this.layout.faders.find(f => f.id === this.selectedElement!.id);
      
      if (element) {
        element.name = this.editingElement.name;
        element.presetIds = [...this.editingElement.presetIds];
        
        // Only update fadeMs for buttons
        if (this.selectedElement.type === 'button' && 'fadeMs' in element) {
          (element as VirtualButton).fadeMs = this.editingElement.fadeMs;
        }
      }
    }
    
    this.showEditModal = false;
    this.editingElement = {};
  }

  deleteElement(type: 'button' | 'fader', id: string): void {
    this.confirm.ask({
      title: 'Delete Element',
      message: 'Are you sure you want to delete this element?',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        if (type === 'button') {
          this.layout.buttons = this.layout.buttons.filter(b => b.id !== id);
        } else {
          this.layout.faders = this.layout.faders.filter(f => f.id !== id);
        }
        
        if (this.selectedElement?.type === type && this.selectedElement?.id === id) {
          this.selectedElement = null;
        }
        
        if (this.resizingElement?.type === type && this.resizingElement?.id === id) {
          this.resizingElement = null;
        }
        
        // Clean up saved states and update DMX
        this.saveControlStates();
        this.updateDmxCalculation();
      }
    });
  }

  private generateUUID(): string {
    // Try to use crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback to manual UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}