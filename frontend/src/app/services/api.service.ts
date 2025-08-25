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

  applyPreset(id: string, fadeMs?: number): Observable<{ message: string; channelsUpdated: number; fadeMs?: number }> {
    return this.http.post<{ message: string; channelsUpdated: number; fadeMs?: number }>(`${this.baseUrl}/presets/${id}/apply`, { fadeMs });
  }

  clearPreset(id: string, fadeMs?: number): Observable<{ message: string; channelsUpdated: number; fadeMs?: number }> {
    return this.http.post<{ message: string; channelsUpdated: number; fadeMs?: number }>(`${this.baseUrl}/presets/${id}/clear`, { fadeMs });
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

  setMultipleDmxChannels(channels: { channel: number; value: number }[], fadeMs?: number): Observable<any> {
    this.logDebug(`API: Setting ${channels.length} DMX channels${fadeMs ? ` with ${fadeMs}ms fade` : ''}`, channels);
    const body: any = { channels };
    if (fadeMs !== undefined && fadeMs > 0) {
      body.fadeMs = fadeMs;
    }
    return this.http.post(`${this.baseUrl}/dmx/set-multiple`, body).pipe(
      tap(response => this.logDebug(`API: Multiple DMX channels set successfully`, response))
    );
  }

  getDmxValues(): Observable<number[]> {
    this.logDebug('API: Getting current DMX values');
    return this.http.get<number[]>(`${this.baseUrl}/dmx/values`).pipe(
      tap(values => this.logDebug('API: Current DMX values retrieved', values))
    );
  }

  blackout(fadeMs?: number): Observable<{ message: string; fadeMs?: number }> {
    return this.http.post<{ message: string; fadeMs?: number }>(`${this.baseUrl}/dmx/blackout`, { fadeMs });
  }

  // Virtual console persistence
  getVirtualConsoleLayout(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/virtual-console/layout`).pipe(
      tap(layout => this.logDebug('API: Loaded virtual console layout', layout))
    );
  }

  saveVirtualConsoleLayout(layout: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/virtual-console/layout`, layout).pipe(
      tap(() => this.logDebug('API: Saved virtual console layout'))
    );
  }

  getVirtualConsoleStates(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/virtual-console/states`).pipe(
      tap(states => this.logDebug('API: Loaded virtual console states', states))
    );
  }

  saveVirtualConsoleStates(states: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/virtual-console/states`, states).pipe(
      tap(() => this.logDebug('API: Saved virtual console states'))
    );
  }

  private logDebug(message: string, data?: any): void {
    const settings = JSON.parse(localStorage.getItem('luminetDmxSettings') || '{}');
    if (settings.enableLogging) {
      console.log(`[LuminetDMX API] ${message}`, data);
    }
  }
}