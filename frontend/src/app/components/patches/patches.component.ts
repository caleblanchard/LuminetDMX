import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { FixtureTemplate, Patch } from '../../models/fixture.model';

@Component({
  selector: 'app-patches',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="page-header">
        <h1 class="text-xl">Lighting Patches</h1>
        <div class="header-controls">
          <button class="btn btn-secondary" (click)="showBulkForm = true">Bulk Create</button>
          <button class="btn btn-primary" (click)="showAddForm = true">Add Patch</button>
        </div>
      </div>

      <div class="patches-grid" *ngIf="!showAddForm && !editingPatch && !showBulkForm">
        <div class="card patch-card" *ngFor="let patch of patches">
          <div class="patch-header">
            <h3>{{ patch.name }}</h3>
            <div class="patch-address">
              <span class="universe">Universe {{ patch.universe }}</span>
              <span class="address">Address {{ patch.startAddress }}</span>
            </div>
          </div>
          
          <div class="patch-info">
            <div class="template-info" *ngIf="getTemplate(patch.templateId) as template">
              <div class="template-name">{{ template.name }}</div>
              <div class="template-meta">
                {{ template.manufacturer }} {{ template.model }}
              </div>
              <div class="channel-range">
                Channels {{ patch.startAddress }} - {{ patch.startAddress + template.channelCount - 1 }}
              </div>
            </div>
          </div>
          
          <div class="patch-actions">
            <button class="btn btn-secondary" (click)="editPatch(patch)">Edit</button>
            <button class="btn btn-danger" (click)="deletePatch(patch.id)">Delete</button>
          </div>
        </div>
      </div>

      <div class="form-container" *ngIf="showAddForm || editingPatch">
        <div class="card">
          <h2 class="text-lg mb-4">{{ editingPatch ? 'Edit' : 'Add' }} Patch</h2>
          
          <form (ngSubmit)="savePatch()" #patchForm="ngForm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Patch Name</label>
                <input type="text" class="input" [(ngModel)]="currentPatch.name" name="name" required>
              </div>
              <div>
                <label class="label">Fixture Template</label>
                <select class="input" [(ngModel)]="currentPatch.templateId" name="templateId" required>
                  <option value="">Select a template</option>
                  <option *ngFor="let template of templates" [value]="template.id">
                    {{ template.name }} ({{ template.manufacturer }} {{ template.model }})
                  </option>
                </select>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Universe</label>
                <input type="number" class="input" [(ngModel)]="currentPatch.universe" name="universe" 
                       min="0" max="32767" required>
              </div>
              <div>
                <label class="label">Start Address</label>
                <input type="number" class="input" [(ngModel)]="currentPatch.startAddress" name="startAddress" 
                       min="1" max="512" required>
              </div>
            </div>
            
            <div class="patch-preview" *ngIf="currentPatch.templateId && getTemplate(currentPatch.templateId) as template">
              <h3 class="text-lg mb-4">Channel Preview</h3>
              <div class="channel-preview-grid">
                <div class="channel-preview-item" *ngFor="let channel of template.channels; let i = index">
                  <div class="channel-number">{{ (currentPatch.startAddress || 1) + i }}</div>
                  <div class="channel-name">{{ channel.name }}</div>
                  <div class="channel-type">{{ channel.type }}</div>
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelEdit()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="!patchForm.valid">Save</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Bulk Creation Form -->
      <div class="form-container" *ngIf="showBulkForm">
        <div class="card">
          <h2 class="text-lg mb-4">Bulk Create Patches</h2>
          
          <form (ngSubmit)="createBulkPatches()" #bulkForm="ngForm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="label">Base Name</label>
                <input type="text" class="input" [(ngModel)]="bulkPatchData.baseName" name="baseName" 
                       placeholder="e.g. 'LED Par'" required>
              </div>
              <div>
                <label class="label">Fixture Template</label>
                <select class="input" [(ngModel)]="bulkPatchData.templateId" name="templateId" 
                        (change)="onBulkTemplateChange()" required>
                  <option value="">Select a template</option>
                  <option *ngFor="let template of templates" [value]="template.id">
                    {{ template.name }} ({{ template.channelCount }} ch)
                  </option>
                </select>
              </div>
            </div>
            
            <div class="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label class="label">Universe</label>
                <input type="number" class="input" [(ngModel)]="bulkPatchData.universe" name="universe" 
                       (change)="onBulkParameterChange()" min="0" max="32767" required>
              </div>
              <div>
                <label class="label">Start Address</label>
                <input type="number" class="input" [(ngModel)]="bulkPatchData.startAddress" name="startAddress" 
                       (change)="onBulkParameterChange()" min="1" max="512" required>
              </div>
              <div>
                <label class="label">Quantity</label>
                <input type="number" class="input" [(ngModel)]="bulkPatchData.quantity" name="quantity" 
                       (change)="onBulkParameterChange()" min="1" max="100" required>
              </div>
              <div class="availability-info">
                <label class="label">Address Check</label>
                <div class="availability-status" [class]="getAvailabilityClass()">
                  {{ getAvailabilityMessage() }}
                </div>
              </div>
            </div>

            <div class="address-preview" *ngIf="addressPreview && addressPreview.canFit">
              <h3 class="text-lg mb-4">Address Preview</h3>
              <div class="preview-info">
                <p><strong>Channels per fixture:</strong> {{ addressPreview.channelsPerFixture }}</p>
                <p><strong>Total channels needed:</strong> {{ addressPreview.totalChannels }}</p>
              </div>
              <div class="address-list">
                <div class="address-item" *ngFor="let address of addressPreview.addresses; let i = index">
                  <strong>{{ bulkPatchData.baseName || 'Fixture' }} {{ i + 1 }}:</strong> 
                  Channels {{ address }} - {{ address + addressPreview.channelsPerFixture - 1 }}
                </div>
              </div>
            </div>

            <div class="conflict-warning" *ngIf="addressPreview && !addressPreview.canFit">
              <h3 class="text-lg mb-2">⚠️ Address Conflict</h3>
              <p>{{ addressPreview.error }}</p>
              <div *ngIf="addressPreview.availableAddresses && addressPreview.availableAddresses.length > 0">
                <p><strong>Can only create {{ addressPreview.availableAddresses.length }} fixtures:</strong></p>
                <div class="available-addresses">
                  <span *ngFor="let addr of addressPreview.availableAddresses; let i = index">
                    {{ addr }}{{ i < addressPreview.availableAddresses.length - 1 ? ', ' : '' }}
                  </span>
                </div>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn btn-secondary" (click)="cancelBulkEdit()">Cancel</button>
              <button type="submit" class="btn btn-primary" 
                      [disabled]="!bulkForm.valid || !addressPreview?.canFit">
                Create {{ bulkPatchData.quantity || 0 }} Patches
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="empty-state" *ngIf="patches.length === 0 && !showAddForm && !editingPatch && !showBulkForm">
        <div class="card text-center">
          <h3>No patches configured</h3>
          <p>Create your first lighting patch to get started.</p>
          <button class="btn btn-primary" (click)="showAddForm = true">Add First Patch</button>
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

    .patches-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 20px;
    }

    .patch-card {
      transition: transform 0.2s ease;
    }

    .patch-card:hover {
      transform: translateY(-4px);
    }

    .patch-header h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #e2e8f0;
    }

    .patch-address {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .universe, .address {
      font-size: 12px;
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .patch-info {
      margin-bottom: 20px;
    }

    .template-name {
      font-size: 16px;
      font-weight: 600;
      color: #e2e8f0;
      margin-bottom: 4px;
    }

    .template-meta {
      font-size: 14px;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .channel-range {
      font-size: 14px;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
      padding: 6px 10px;
      border-radius: 6px;
      display: inline-block;
    }

    .patch-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .form-container {
      max-width: 800px;
    }

    .patch-preview {
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .channel-preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }

    .channel-preview-item {
      background: rgba(30, 41, 59, 0.5);
      border-radius: 6px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .channel-number {
      font-size: 18px;
      font-weight: 600;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .channel-name {
      font-size: 14px;
      color: #e2e8f0;
      margin-bottom: 2px;
    }

    .channel-type {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
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

    .availability-info {
      display: flex;
      flex-direction: column;
    }

    .availability-status {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
    }

    .availability-status.available {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    .availability-status.conflict {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.2);
    }

    .availability-status.checking {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .address-preview {
      background: rgba(16, 185, 129, 0.05);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(16, 185, 129, 0.1);
    }

    .preview-info {
      margin-bottom: 16px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .preview-info p {
      margin: 0;
      color: #e2e8f0;
      font-size: 14px;
    }

    .address-list {
      max-height: 200px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 8px;
    }

    .address-item {
      background: rgba(30, 41, 59, 0.3);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      color: #cbd5e1;
    }

    .conflict-warning {
      background: rgba(239, 68, 68, 0.05);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    .conflict-warning h3 {
      color: #ef4444;
      margin: 0 0 12px 0;
    }

    .conflict-warning p {
      margin: 0 0 12px 0;
    }

    .available-addresses {
      font-family: 'Courier New', monospace;
      background: rgba(15, 23, 42, 0.5);
      padding: 8px;
      border-radius: 4px;
      font-size: 14px;
    }

    @media (max-width: 768px) {
      .patches-grid {
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
      
      .channel-preview-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PatchesComponent implements OnInit {
  patches: Patch[] = [];
  templates: FixtureTemplate[] = [];
  showAddForm = false;
  showBulkForm = false;
  editingPatch: Patch | null = null;
  currentPatch: Partial<Patch> = this.getEmptyPatch();
  
  // Bulk creation properties
  bulkPatchData = {
    baseName: '',
    templateId: '',
    universe: 0,
    startAddress: 1,
    quantity: 1
  };
  addressPreview: any = null;
  isCheckingAddresses = false;

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadPatches();
    this.loadTemplates();
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

  getTemplate(templateId: string): FixtureTemplate | undefined {
    return this.templates.find(t => t.id === templateId);
  }

  getEmptyPatch(): Partial<Patch> {
    return {
      name: '',
      templateId: '',
      startAddress: 1,
      universe: 0
    };
  }

  editPatch(patch: Patch): void {
    this.editingPatch = patch;
    this.currentPatch = { ...patch };
    this.showAddForm = false;
  }

  savePatch(): void {
    if (this.editingPatch) {
      this.apiService.updatePatch(this.editingPatch.id, this.currentPatch).subscribe(
        () => {
          this.loadPatches();
          this.cancelEdit();
        }
      );
    } else {
      this.apiService.createPatch(this.currentPatch as Omit<Patch, 'id' | 'createdAt'>).subscribe(
        () => {
          this.loadPatches();
          this.cancelEdit();
        }
      );
    }
  }

  deletePatch(id: string): void {
    if (confirm('Are you sure you want to delete this patch?')) {
      this.apiService.deletePatch(id).subscribe(
        () => this.loadPatches()
      );
    }
  }

  cancelEdit(): void {
    this.showAddForm = false;
    this.editingPatch = null;
    this.currentPatch = this.getEmptyPatch();
  }

  // Bulk creation methods
  onBulkTemplateChange(): void {
    this.checkAddressAvailability();
  }

  onBulkParameterChange(): void {
    this.checkAddressAvailability();
  }

  checkAddressAvailability(): void {
    if (!this.bulkPatchData.templateId || !this.bulkPatchData.quantity || this.bulkPatchData.universe === undefined || !this.bulkPatchData.startAddress) {
      this.addressPreview = null;
      return;
    }

    this.isCheckingAddresses = true;
    this.addressPreview = null;

    this.apiService.checkAddressAvailability({
      templateId: this.bulkPatchData.templateId,
      universe: this.bulkPatchData.universe,
      quantity: this.bulkPatchData.quantity,
      startAddress: this.bulkPatchData.startAddress
    }).subscribe(
      (result) => {
        this.addressPreview = result;
        this.isCheckingAddresses = false;
      },
      (error) => {
        console.error('Error checking address availability:', error);
        this.addressPreview = { canFit: false, error: 'Error checking addresses' };
        this.isCheckingAddresses = false;
      }
    );
  }

  getAvailabilityClass(): string {
    if (this.isCheckingAddresses) return 'checking';
    if (!this.addressPreview) return 'checking';
    return this.addressPreview.canFit ? 'available' : 'conflict';
  }

  getAvailabilityMessage(): string {
    if (this.isCheckingAddresses) return 'Checking...';
    if (!this.addressPreview) return 'Enter details above';
    return this.addressPreview.canFit ? '✓ Available' : '✗ Conflicts exist';
  }

  createBulkPatches(): void {
    if (!this.addressPreview?.canFit) return;

    this.apiService.createBulkPatches(this.bulkPatchData).subscribe(
      (result) => {
        console.log('Bulk patches created:', result);
        this.loadPatches();
        this.cancelBulkEdit();
        // Show success message if needed
      },
      (error) => {
        console.error('Error creating bulk patches:', error);
        // Handle error - could show error message to user
      }
    );
  }

  cancelBulkEdit(): void {
    this.showBulkForm = false;
    this.bulkPatchData = {
      baseName: '',
      templateId: '',
      universe: 0,
      startAddress: 1,
      quantity: 1
    };
    this.addressPreview = null;
    this.isCheckingAddresses = false;
  }
}