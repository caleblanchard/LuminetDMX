import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { Preset, PresetChannelValue, Patch, FixtureTemplate } from '../../models/fixture.model';

@Component({
  selector: 'app-presets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h1 class="text-xl">Presets</h1>
        <div class="header-controls">
          <button class="btn btn-primary" (click)="showAddForm = true">Create Preset</button>
        </div>
      </div>

      <div class="presets-grid" *ngIf="!showAddForm && !editingPreset">
        <div class="card preset-card" *ngFor="let preset of presets">
          <div class="preset-header">
            <h3>{{ preset.name }}</h3>
            <div class="preset-meta">
              <span class="channel-count">{{ preset.channelValues.length }} channels</span>
              <span class="created-date">{{ formatDate(preset.createdAt) }}</span>
              <span class="fade" *ngIf="preset.fadeMs !== undefined && preset.fadeMs !== null">Fade: {{ preset.fadeMs }} ms</span>
            </div>
          </div>
          
          <div class="preset-description" *ngIf="preset.description">
            <p>{{ preset.description }}</p>
          </div>
          
          <div class="preset-preview">
            <div class="channel-preview">
              <div class="channel-value" 
                   *ngFor="let channel of getPreviewChannels(preset); let i = index"
                   [style.width.%]="(channel.value / 255) * 100"
                   [title]="getChannelTitle(channel)">
                <span class="channel-label">{{ channel.channel }}</span>
              </div>
            </div>
            <div class="preview-info" *ngIf="preset.channelValues.length > 8">
              +{{ preset.channelValues.length - 8 }} more channels
            </div>
          </div>
          
          <div class="preset-actions">
            <button class="btn btn-primary toggle" (click)="togglePreset(preset)" [class.active]="isActive(preset)">
              {{ isActive(preset) ? 'On' : 'Off' }}
            </button>
            <button class="btn btn-secondary" (click)="editPreset(preset)">Edit</button>
            <button class="btn btn-danger" (click)="deletePreset(preset.id)">Delete</button>
          </div>
        </div>
      </div>

      <div class="form-container" *ngIf="showAddForm || editingPreset">
        <div class="card">
          <h2 class="text-lg mb-4">{{ editingPreset ? 'Edit' : 'Create' }} Preset</h2>
          
          <form (ngSubmit)="savePreset()" #presetForm="ngForm">
            <div class="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label class="label">Preset Name</label>
                <input type="text" class="input" [(ngModel)]="currentPreset.name" name="name" required>
              </div>
              <div>
                <label class="label">Description (optional)</label>
                <textarea class="input" [(ngModel)]="currentPreset.description" name="description" 
                          rows="3" placeholder="Describe this preset..."></textarea>
              </div>
            </div>
            
            <div class="channels-section">
              <h3 class="text-lg mb-4">Channel Values</h3>
              <div class="channels-info">
                <p class="info-text">
                  This preset will save the current state of {{ currentPreset.channelValues?.length || 0 }} DMX channels.
                  Only channels with non-zero values are included.
                </p>
              </div>
              
              <div class="channels-grid" *ngIf="currentPreset.channelValues && currentPreset.channelValues.length > 0">
                <div class="channel-editor" *ngFor="let channel of currentPreset.channelValues; let i = index">
                  <div class="channel-header">
                    <span class="channel-number">Ch {{ channel.channel }}</span>
                    <span class="patch-info" *ngIf="channel.patchName">{{ channel.patchName }}</span>
                    <button type="button" class="btn-remove" (click)="removeChannel(i)">×</button>
                  </div>
                  <div class="channel-controls">
                    <label class="channel-label">{{ channel.channelName || 'Channel ' + channel.channel }}</label>
                    <div class="value-control">
                      <input type="range" min="0" max="255" 
                             [(ngModel)]="channel.value" 
                             [name]="'channel-' + i"
                             class="channel-slider">
                      <input type="number" min="0" max="255" 
                             [(ngModel)]="channel.value"
                             [name]="'channelValue-' + i"
                             class="value-input">
                    </div>
                  </div>
                </div>
              </div>

              <div class="empty-channels" *ngIf="!currentPreset.channelValues || currentPreset.channelValues.length === 0">
                <p>No channel data. Use the Light Control page to set up lights, then create a preset from there.</p>
              </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label class="label">Fade Duration (ms)</label>
                <input type="number" class="input" min="0" step="50" [(ngModel)]="currentPreset.fadeMs" name="fadeMs" placeholder="e.g. 1000">
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
              <button type="submit" class="btn btn-primary" 
                      [disabled]="!presetForm.valid || !currentPreset.channelValues?.length">
                {{ editingPreset ? 'Update' : 'Create' }} Preset
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="empty-state" *ngIf="presets.length === 0 && !showAddForm && !editingPreset">
        <div class="card text-center">
          <h3>No presets created</h3>
          <p>Create presets to save and recall lighting configurations quickly.</p>
          <p class="help-text">Set up your lights in Light Control, then save the configuration as a preset.</p>
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

    .header-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }

    .preset-card {
      transition: transform 0.2s ease;
      position: relative;
    }

    .preset-card:hover {
      transform: translateY(-4px);
    }

    .preset-header h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #e2e8f0;
    }

    .preset-meta {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .preset-meta .fade { color: #94a3b8; font-size: 12px; }

    .channel-count {
      font-size: 12px;
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .created-date {
      font-size: 12px;
      color: #94a3b8;
    }

    .preset-description {
      margin-bottom: 16px;
    }

    .preset-description p {
      font-size: 14px;
      color: #cbd5e1;
      line-height: 1.4;
      margin: 0;
    }

    .preset-preview {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
    }

    .channel-preview {
      display: flex;
      gap: 4px;
      margin-bottom: 8px;
      height: 30px;
    }

    .channel-value {
      background: linear-gradient(45deg, #3b82f6, #60a5fa);
      border-radius: 3px;
      position: relative;
      min-width: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .channel-label {
      font-size: 10px;
      color: white;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }

    .preview-info {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }

    .preset-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    .btn.toggle.active { background: #10b981; }

    .form-container {
      max-width: 800px;
    }

    .channels-section {
      margin-bottom: 24px;
    }

    .channels-info {
      background: rgba(59, 130, 246, 0.05);
      border: 1px solid rgba(59, 130, 246, 0.1);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .info-text {
      color: #cbd5e1;
      margin: 0;
      font-size: 14px;
    }

    .channels-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .channel-editor {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .channel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .channel-number {
      font-size: 14px;
      font-weight: 600;
      color: #3b82f6;
    }

    .patch-info {
      font-size: 12px;
      color: #94a3b8;
    }

    .btn-remove {
      background: #ef4444;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
    }

    .channel-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .channel-label {
      font-size: 14px;
      color: #cbd5e1;
      font-weight: 500;
    }

    .value-control {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .channel-slider {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: rgba(15, 23, 42, 0.8);
      outline: none;
      -webkit-appearance: none;
    }

    .channel-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #3b82f6;
      cursor: pointer;
    }

    .value-input {
      width: 60px;
      padding: 6px 8px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.5);
      color: #e2e8f0;
      text-align: center;
    }

    .empty-channels {
      text-align: center;
      padding: 40px 20px;
      color: #94a3b8;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
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
      margin-bottom: 12px;
    }

    .help-text {
      font-size: 14px;
      color: #94a3b8;
    }

    @media (max-width: 768px) {
      .presets-grid {
        grid-template-columns: 1fr;
      }
      
      .page-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      
      .header-controls {
        justify-content: center;
      }

      .channels-grid {
        grid-template-columns: 1fr;
      }

      .preset-actions {
        flex-wrap: wrap;
        justify-content: center;
      }
    }
  `]
})
export class PresetsComponent implements OnInit {
  presets: Preset[] = [];
  activePresetIds: Set<string> = new Set<string>();
  patches: Patch[] = [];
  templates: FixtureTemplate[] = [];
  showAddForm = false;
  editingPreset: Preset | null = null;
  currentPreset: Partial<Preset> = this.getEmptyPreset();

  constructor(private apiService: ApiService, private confirm: ConfirmService) {}

  ngOnInit(): void {
    this.loadPresets();
    this.loadPatches();
    this.loadTemplates();
  }

  loadPresets(): void {
    this.apiService.getPresets().subscribe(
      presets => this.presets = presets
    );
  }

  loadPatches(): void {
    this.apiService.getPatches().subscribe(
      patches => this.patches = patches
    );
  }

  loadTemplates(): void {
    this.apiService.getFixtureTemplates().subscribe(
      templates => this.templates = templates
    );
  }

  getEmptyPreset(): Partial<Preset> {
    return {
      name: '',
      description: '',
      channelValues: []
    };
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString();
  }

  getPreviewChannels(preset: Preset): PresetChannelValue[] {
    return preset.channelValues
      .filter(ch => ch.value > 0)
      .sort((a, b) => a.channel - b.channel)
      .slice(0, 8);
  }

  getChannelTitle(channel: PresetChannelValue): string {
    let title = `Channel ${channel.channel}: ${channel.value}`;
    if (channel.patchName) {
      title += ` (${channel.patchName}`;
      if (channel.channelName) {
        title += ` - ${channel.channelName}`;
      }
      title += ')';
    }
    return title;
  }

  editPreset(preset: Preset): void {
    this.editingPreset = preset;
    this.currentPreset = { 
      ...preset,
      channelValues: [...preset.channelValues]
    };
    this.showAddForm = false;
  }

  savePreset(): void {
    if (this.editingPreset) {
      this.apiService.updatePreset(this.editingPreset.id, this.currentPreset).subscribe(
        () => {
          this.loadPresets();
          this.cancelEdit();
        }
      );
    } else {
      this.apiService.createPreset(this.currentPreset as Omit<Preset, 'id' | 'createdAt'>).subscribe(
        () => {
          this.loadPresets();
          this.cancelEdit();
        }
      );
    }
  }

  deletePreset(id: string): void {
    this.confirm.ask({
      title: 'Delete Preset',
      message: 'Are you sure you want to delete this preset? This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deletePreset(id).subscribe(() => this.loadPresets());
      }
    });
  }

  togglePreset(preset: Preset): void {
    const isActive = this.activePresetIds.has(preset.id);
    const fadeMs = preset.fadeMs;
    const req$ = isActive
      ? this.apiService.clearPreset(preset.id, fadeMs)
      : this.apiService.applyPreset(preset.id, fadeMs);

    req$.subscribe(
      () => {
        if (isActive) {
          this.activePresetIds.delete(preset.id);
        } else {
          this.activePresetIds.add(preset.id);
        }
      },
      (error) => {
        console.error('Preset toggle error:', error);
      }
    );
  }

  isActive(preset: Preset): boolean {
    return this.activePresetIds.has(preset.id);
  }

  removeChannel(index: number): void {
    this.currentPreset.channelValues?.splice(index, 1);
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingPreset = null;
    this.currentPreset = this.getEmptyPreset();
  }
}