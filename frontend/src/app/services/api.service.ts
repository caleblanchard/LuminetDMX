import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FixtureTemplate, Patch, Group, UniverseConfig, Preset } from '../models/fixture.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = '/api';

  constructor(private http: HttpClient) {}

  getFixtureTemplates(): Observable<FixtureTemplate[]> {
    return this.http.get<FixtureTemplate[]>(`${this.baseUrl}/fixture-templates`);
  }

  createFixtureTemplate(template: Omit<FixtureTemplate, 'id' | 'createdAt'>): Observable<FixtureTemplate> {
    return this.http.post<FixtureTemplate>(`${this.baseUrl}/fixture-templates`, template);
  }

  updateFixtureTemplate(id: string, template: Partial<FixtureTemplate>): Observable<FixtureTemplate> {
    return this.http.put<FixtureTemplate>(`${this.baseUrl}/fixture-templates/${id}`, template);
  }

  deleteFixtureTemplate(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/fixture-templates/${id}`);
  }

  getPatches(): Observable<Patch[]> {
    return this.http.get<Patch[]>(`${this.baseUrl}/patches`);
  }

  createPatch(patch: Omit<Patch, 'id' | 'createdAt'>): Observable<Patch> {
    return this.http.post<Patch>(`${this.baseUrl}/patches`, patch);
  }

  updatePatch(id: string, patch: Partial<Patch>): Observable<Patch> {
    return this.http.put<Patch>(`${this.baseUrl}/patches/${id}`, patch);
  }

  deletePatch(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/patches/${id}`);
  }

  // Bulk patch creation
  createBulkPatches(bulkData: {
    templateId: string;
    universe: number;
    startAddress?: number;
    quantity: number;
    baseName?: string;
  }): Observable<{ message: string; patches: Patch[] }> {
    return this.http.post<{ message: string; patches: Patch[] }>(`${this.baseUrl}/patches/bulk`, bulkData);
  }

  // Check address availability
  checkAddressAvailability(data: {
    templateId: string;
    universe: number;
    startAddress?: number;
    quantity: number;
  }): Observable<{
    canFit: boolean;
    addresses?: number[];
    channelsPerFixture?: number;
    totalChannels?: number;
    error?: string;
    availableAddresses?: number[];
  }> {
    return this.http.post<any>(`${this.baseUrl}/patches/check-addresses`, data);
  }

  // Get used addresses for a universe
  getUsedAddresses(universe: number): Observable<{ usedRanges: Array<{ start: number; end: number; patchId: string }> }> {
    return this.http.get<any>(`${this.baseUrl}/patches/used-addresses/${universe}`);
  }

  // Preset methods
  getPresets(): Observable<Preset[]> {
    return this.http.get<Preset[]>(`${this.baseUrl}/presets`);
  }

  createPreset(preset: Omit<Preset, 'id' | 'createdAt'>): Observable<Preset> {
    return this.http.post<Preset>(`${this.baseUrl}/presets`, preset);
  }

  updatePreset(id: string, preset: Partial<Preset>): Observable<Preset> {
    return this.http.put<Preset>(`${this.baseUrl}/presets/${id}`, preset);
  }

  deletePreset(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/presets/${id}`);
  }

  applyPreset(id: string): Observable<{ message: string; channelsUpdated: number }> {
    return this.http.post<{ message: string; channelsUpdated: number }>(`${this.baseUrl}/presets/${id}/apply`, {});
  }

  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.baseUrl}/groups`);
  }

  createGroup(group: Omit<Group, 'id' | 'createdAt'>): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/groups`, group);
  }

  updateGroup(id: string, group: Partial<Group>): Observable<Group> {
    return this.http.put<Group>(`${this.baseUrl}/groups/${id}`, group);
  }

  deleteGroup(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/groups/${id}`);
  }

  getUniverseConfig(): Observable<UniverseConfig> {
    return this.http.get<UniverseConfig>(`${this.baseUrl}/universe-config`);
  }

  updateUniverseConfig(config: UniverseConfig): Observable<UniverseConfig> {
    return this.http.post<UniverseConfig>(`${this.baseUrl}/universe-config`, config);
  }

  setDmxChannel(channel: number, value: number): Observable<any> {
    this.logDebug(`API: Setting DMX channel ${channel} to ${value}`);
    return this.http.post(`${this.baseUrl}/dmx/set-channel`, { channel, value }).pipe(
      tap(response => this.logDebug(`API: DMX channel ${channel} set successfully`, response))
    );
  }

  setMultipleDmxChannels(channels: { channel: number; value: number }[]): Observable<any> {
    this.logDebug(`API: Setting ${channels.length} DMX channels`, channels);
    return this.http.post(`${this.baseUrl}/dmx/set-multiple`, { channels }).pipe(
      tap(response => this.logDebug(`API: Multiple DMX channels set successfully`, response))
    );
  }

  getDmxValues(): Observable<number[]> {
    this.logDebug('API: Getting current DMX values');
    return this.http.get<number[]>(`${this.baseUrl}/dmx/values`).pipe(
      tap(values => this.logDebug('API: Current DMX values retrieved', values))
    );
  }

  private logDebug(message: string, data?: any): void {
    const settings = JSON.parse(localStorage.getItem('luminetDmxSettings') || '{}');
    if (settings.enableLogging) {
      console.log(`[LuminetDMX API] ${message}`, data);
    }
  }
}