import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { FixtureTemplate, FixtureChannel } from '../../models/fixture.model';

@Component({
  selector: 'app-fixtures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h1 class="text-xl">Fixture Templates</h1>
        <div class="header-controls">
          <button class="btn btn-primary" (click)="showAddForm = true">Add Template</button>
        </div>
      </div>

      <div class="fixture-grid" *ngIf="!showAddForm && !editingTemplate">
        <div class="card fixture-card" *ngFor="let template of templates">
          <div class="fixture-header">
            <h3>{{ template.name }}</h3>
            <div class="fixture-meta">
              <span class="manufacturer">{{ template.manufacturer }}</span>
              <span class="model">{{ template.model }}</span>
            </div>
          </div>
          
          <div class="fixture-info">
            <div class="channel-count">
              <strong>{{ template.channelCount }}</strong> channels
            </div>
            <div class="channel-list">
              <div class="channel-item" *ngFor="let channel of template.channels">
                <span class="channel-name">{{ channel.name }}</span>
                <span class="channel-type">{{ channel.type }}</span>
              </div>
            </div>
          </div>
          
          <div class="fixture-actions">
            <button class="btn btn-secondary" (click)="editTemplate(template)">Edit</button>
            <button class="btn btn-danger" (click)="deleteTemplate(template.id)">Delete</button>
          </div>
        </div>
      </div>

      <div class="form-container" *ngIf="showAddForm || editingTemplate">
        <div class="card">
          <h2 class="text-lg mb-4">{{ editingTemplate ? 'Edit' : 'Add' }} Fixture Template</h2>
          
          <form (ngSubmit)="saveTemplate()" #templateForm="ngForm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Name</label>
                <input type="text" class="input" [(ngModel)]="currentTemplate.name" name="name" required>
              </div>
              <div>
                <label class="label">Manufacturer</label>
                <input type="text" class="input" [(ngModel)]="currentTemplate.manufacturer" name="manufacturer" required>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Model</label>
                <input type="text" class="input" [(ngModel)]="currentTemplate.model" name="model" required>
              </div>
              <div>
                <label class="label">Channel Count</label>
                <input type="number" class="input" [(ngModel)]="currentTemplate.channelCount" name="channelCount" 
                       (change)="updateChannelCount()" min="1" max="512" required>
              </div>
            </div>
            
            <div class="channels-section">
              <h3 class="text-lg mb-4">Channels</h3>
              <div class="channel-editor" *ngFor="let channel of currentTemplate.channels; let i = index">
                <div class="channel-header">
                  <span>Channel {{ i + 1 }}</span>
                </div>
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <label class="label">Name</label>
                    <input type="text" class="input" [(ngModel)]="channel.name" [name]="'channelName' + i">
                  </div>
                  <div>
                    <label class="label">Type</label>
                    <select class="input" [(ngModel)]="channel.type" [name]="'channelType' + i">
                      <option value="dimmer">Dimmer</option>
                      <option value="color">Color</option>
                      <option value="position">Position</option>
                      <option value="gobo">Gobo</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label class="label">Default Value</label>
                    <input type="number" class="input" [(ngModel)]="channel.defaultValue" 
                           [name]="'channelDefault' + i" min="0" max="255">
                  </div>
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="!templateForm.valid">Save</button>
            </div>
          </form>
        </div>
      </div>

      <div class="empty-state" *ngIf="templates.length === 0 && !showAddForm && !editingTemplate">
        <div class="card text-center">
          <h3>No fixture templates created</h3>
          <p>Create your first fixture template to define light types and their DMX channels.</p>
          <button class="btn btn-primary" (click)="showAddForm = true">Create First Template</button>
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

    .fixture-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }

    .fixture-card {
      transition: transform 0.2s ease;
    }

    .fixture-card:hover {
      transform: translateY(-4px);
    }

    .fixture-header h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #e2e8f0;
    }

    .fixture-meta {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .manufacturer, .model {
      font-size: 14px;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .fixture-info {
      margin-bottom: 20px;
    }

    .channel-count {
      font-size: 16px;
      color: #3b82f6;
      margin-bottom: 12px;
    }

    .channel-list {
      max-height: 150px;
      overflow-y: auto;
    }

    .channel-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .channel-name {
      font-weight: 500;
    }

    .channel-type {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
    }

    .fixture-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .form-container {
      max-width: 800px;
    }

    .channels-section {
      margin-bottom: 24px;
    }

    .channel-editor {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .channel-header {
      font-weight: 500;
      margin-bottom: 12px;
      color: #cbd5e1;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    @media (max-width: 768px) {
      .fixture-grid {
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
  `]
})
export class FixturesComponent implements OnInit {
  templates: FixtureTemplate[] = [];
  showAddForm = false;
  editingTemplate: FixtureTemplate | null = null;
  currentTemplate: Partial<FixtureTemplate> = this.getEmptyTemplate();

  constructor(private apiService: ApiService, private confirm: ConfirmService) {}

  ngOnInit(): void {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.apiService.getFixtureTemplates().subscribe(
      templates => this.templates = templates
    );
  }

  getEmptyTemplate(): Partial<FixtureTemplate> {
    return {
      name: '',
      manufacturer: '',
      model: '',
      channelCount: 1,
      channels: [this.createEmptyChannel(1)]
    };
  }

  createEmptyChannel(offset: number): FixtureChannel {
    return {
      name: `Channel ${offset}`,
      channelOffset: offset,
      type: 'dimmer',
      defaultValue: 0,
      minValue: 0,
      maxValue: 255
    };
  }

  updateChannelCount(): void {
    const count = this.currentTemplate.channelCount || 1;
    const channels = this.currentTemplate.channels || [];
    
    if (channels.length < count) {
      for (let i = channels.length; i < count; i++) {
        channels.push(this.createEmptyChannel(i + 1));
      }
    } else if (channels.length > count) {
      this.currentTemplate.channels = channels.slice(0, count);
    }
    
    this.currentTemplate.channels = channels;
  }

  editTemplate(template: FixtureTemplate): void {
    this.editingTemplate = template;
    this.currentTemplate = { ...template };
    this.showAddForm = false;
  }

  saveTemplate(): void {
    if (this.editingTemplate) {
      this.apiService.updateFixtureTemplate(this.editingTemplate.id, this.currentTemplate).subscribe(
        () => {
          this.loadTemplates();
          this.cancelEdit();
        }
      );
    } else {
      this.apiService.createFixtureTemplate(this.currentTemplate as Omit<FixtureTemplate, 'id' | 'createdAt'>).subscribe(
        () => {
          this.loadTemplates();
          this.cancelEdit();
        }
      );
    }
  }

  deleteTemplate(id: string): void {
    this.confirm.ask({
      title: 'Delete Fixture Template',
      message: 'Are you sure you want to delete this template? This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteFixtureTemplate(id).subscribe(() => this.loadTemplates());
      }
    });
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingTemplate = null;
    this.currentTemplate = this.getEmptyTemplate();
  }
}