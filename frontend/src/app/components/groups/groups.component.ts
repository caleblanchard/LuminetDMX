import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ConfirmService } from '../../services/confirm.service';
import { Group, Patch, FixtureTemplate } from '../../models/fixture.model';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h1 class="text-xl">Fixture Groups</h1>
        <div class="header-controls">
          <button class="btn btn-primary" (click)="showAddForm = true">Create Group</button>
        </div>
      </div>

      <div class="groups-grid" *ngIf="!showAddForm && !editingGroup">
        <div class="card group-card" *ngFor="let group of groups" [style.border-left-color]="group.color">
          <div class="group-header">
            <div class="group-title">
              <div class="color-indicator" [style.background-color]="group.color"></div>
              <h3>{{ group.name }}</h3>
            </div>
            <div class="group-meta">
              {{ group.patchIds.length }} fixtures
            </div>
          </div>
          
          <div class="group-fixtures">
            <div class="fixture-item" *ngFor="let patchId of group.patchIds">
              <div *ngIf="getPatch(patchId) as patch" class="fixture-info">
                <div class="fixture-name">{{ patch.name }}</div>
                <div class="fixture-address">{{ patch.startAddress }}-{{ getEndAddress(patch) }}</div>
                <div class="fixture-template" *ngIf="getTemplate(patch.templateId) as template">
                  {{ template.name }}
                </div>
              </div>
            </div>
          </div>
          
          <div class="group-actions">
            <button class="btn btn-secondary" (click)="editGroup(group)">Edit</button>
            <button class="btn btn-danger" (click)="deleteGroup(group.id)">Delete</button>
          </div>
        </div>
      </div>

      <div class="form-container" *ngIf="showAddForm || editingGroup">
        <div class="card">
          <h2 class="text-lg mb-4">{{ editingGroup ? 'Edit' : 'Create' }} Group</h2>
          
          <form (ngSubmit)="saveGroup()" #groupForm="ngForm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Group Name</label>
                <input type="text" class="input" [(ngModel)]="currentGroup.name" name="name" required>
              </div>
              <div>
                <label class="label">Color</label>
                <div class="color-picker-container">
                  <input type="color" class="color-picker" [(ngModel)]="currentGroup.color" name="color" required>
                  <div class="color-preview" [style.background-color]="currentGroup.color"></div>
                </div>
              </div>
            </div>
            
            <div class="fixtures-selection">
              <h3 class="text-lg mb-4">Select Fixtures</h3>
              <div class="fixtures-grid">
                <div class="fixture-checkbox" *ngFor="let patch of patches">
                  <label class="checkbox-label">
                    <input type="checkbox" 
                           [value]="patch.id" 
                           [checked]="isSelected(patch.id)"
                           (change)="togglePatch(patch.id, $event)">
                    <div class="checkbox-content">
                      <div class="fixture-name">{{ patch.name }}</div>
                      <div class="fixture-details">
                        <span class="address">{{ patch.startAddress }}-{{ getEndAddress(patch) }}</span>
                        <span class="template" *ngIf="getTemplate(patch.templateId) as template">
                          {{ template.name }}
                        </span>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="!groupForm.valid || currentGroup.patchIds?.length === 0">
                Save Group
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="empty-state" *ngIf="groups.length === 0 && !showAddForm && !editingGroup">
        <div class="card text-center">
          <h3>No groups created</h3>
          <p>Create fixture groups to control multiple lights together.</p>
          <button class="btn btn-primary" (click)="showAddForm = true">Create First Group</button>
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

    .groups-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }

    .group-card {
      transition: transform 0.2s ease;
      border-left: 4px solid #3b82f6;
    }

    .group-card:hover {
      transform: translateY(-4px);
    }

    .group-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .group-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .color-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .group-title h3 {
      font-size: 18px;
      font-weight: 600;
      color: #e2e8f0;
      margin: 0;
    }

    .group-meta {
      font-size: 12px;
      color: #94a3b8;
      background: rgba(148, 163, 184, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
    }

    .group-fixtures {
      margin-bottom: 20px;
      max-height: 200px;
      overflow-y: auto;
    }

    .fixture-item {
      background: rgba(15, 23, 42, 0.3);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .fixture-name {
      font-weight: 500;
      color: #e2e8f0;
      margin-bottom: 4px;
    }

    .fixture-address {
      font-size: 12px;
      color: #3b82f6;
      font-family: 'Courier New', monospace;
      margin-bottom: 2px;
    }

    .fixture-template {
      font-size: 12px;
      color: #94a3b8;
    }

    .group-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .form-container {
      max-width: 800px;
    }

    .color-picker-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .color-picker {
      width: 50px;
      height: 40px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: none;
    }

    .color-preview {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid rgba(148, 163, 184, 0.2);
    }

    .fixtures-selection {
      margin-bottom: 24px;
    }

    .fixtures-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    .fixture-checkbox {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.1);
      transition: all 0.2s ease;
    }

    .fixture-checkbox:hover {
      border-color: rgba(59, 130, 246, 0.3);
      background: rgba(59, 130, 246, 0.05);
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      padding: 12px;
      cursor: pointer;
      width: 100%;
    }

    .checkbox-label input[type="checkbox"] {
      margin-right: 12px;
      width: 16px;
      height: 16px;
    }

    .checkbox-content {
      flex: 1;
    }

    .fixture-details {
      display: flex;
      gap: 12px;
      margin-top: 4px;
    }

    .address {
      font-size: 12px;
      color: #3b82f6;
      font-family: 'Courier New', monospace;
    }

    .template {
      font-size: 12px;
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
      margin-bottom: 20px;
    }

    @media (max-width: 768px) {
      .groups-grid,
      .fixtures-grid {
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
  `]
})
export class GroupsComponent implements OnInit {
  groups: Group[] = [];
  patches: Patch[] = [];
  templates: FixtureTemplate[] = [];
  showAddForm = false;
  editingGroup: Group | null = null;
  currentGroup: Partial<Group> = this.getEmptyGroup();

  constructor(private apiService: ApiService, private confirm: ConfirmService) {}

  ngOnInit(): void {
    this.loadGroups();
    this.loadPatches();
    this.loadTemplates();
  }

  loadGroups(): void {
    this.apiService.getGroups().subscribe(
      groups => this.groups = groups
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

  getPatch(patchId: string): Patch | undefined {
    return this.patches.find(p => p.id === patchId);
  }

  getTemplate(templateId: string): FixtureTemplate | undefined {
    return this.templates.find(t => t.id === templateId);
  }

  getEndAddress(patch: Patch): number {
    const template = this.getTemplate(patch.templateId);
    if (!template) return patch.startAddress;
    return patch.startAddress + template.channelCount - 1;
  }

  getEmptyGroup(): Partial<Group> {
    return {
      name: '',
      patchIds: [],
      color: '#3b82f6'
    };
  }

  isSelected(patchId: string): boolean {
    return this.currentGroup.patchIds?.includes(patchId) || false;
  }

  togglePatch(patchId: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    
    if (!this.currentGroup.patchIds) {
      this.currentGroup.patchIds = [];
    }

    if (isChecked) {
      if (!this.currentGroup.patchIds.includes(patchId)) {
        this.currentGroup.patchIds.push(patchId);
      }
    } else {
      this.currentGroup.patchIds = this.currentGroup.patchIds.filter(id => id !== patchId);
    }
  }

  editGroup(group: Group): void {
    this.editingGroup = group;
    this.currentGroup = { ...group };
    this.showAddForm = false;
  }

  saveGroup(): void {
    if (this.editingGroup) {
      this.apiService.updateGroup(this.editingGroup.id, this.currentGroup).subscribe(
        () => {
          this.loadGroups();
          this.cancelEdit();
        }
      );
    } else {
      this.apiService.createGroup(this.currentGroup as Omit<Group, 'id' | 'createdAt'>).subscribe(
        () => {
          this.loadGroups();
          this.cancelEdit();
        }
      );
    }
  }

  deleteGroup(id: string): void {
    this.confirm.ask({
      title: 'Delete Group',
      message: 'Are you sure you want to delete this group? This cannot be undone.',
      confirmText: 'Delete',
      danger: true
    }).subscribe(confirmed => {
      if (confirmed) {
        this.apiService.deleteGroup(id).subscribe(() => this.loadGroups());
      }
    });
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingGroup = null;
    this.currentGroup = this.getEmptyGroup();
  }
}