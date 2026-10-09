import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, empty } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { FixtureTemplate, Patch, Group, UniverseConfig, Preset } from '../models/fixture.model';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = '/api';
  private enableLogging = false;

  constructor(private http: HttpClient) {
    // Load logging preference from localStorage
    try {
      const settings = JSON.parse(localStorage.getItem('luminetDmxSettings') || '{}');
      this.enableLogging = settings.enableLogging || false;
    } catch (e) {
      this.enableLogging = false;
    }
  }

  private logDebug(message: string, data?: any): void {
    if (this.enableLogging) {
      console.log(`[LuminetDMX API] ${message}`, data);
    }
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.status === 0) {
        errorMessage = 'Network error: Unable to connect to server';
      } else if (error.status >= 500) {
        errorMessage = `Server error: ${error.status} - ${error.statusText}`;
      } else if (error.status === 401) {
        errorMessage = 'Unauthorized: Please log in';
      } else if (error.status === 403) {
        errorMessage = 'Forbidden: You do not have permission';
      } else if (error.status === 404) {
        errorMessage = 'Not found: The requested resource does not exist';
      } else if (error.status === 429) {
        errorMessage = 'Rate limit exceeded: Please try again later';
      } else {
        errorMessage = `Error: ${error.message}`;
      }
      
      // Log error details for debugging
      if (this.enableLogging && error.error && typeof error.error === 'object') {
        console.error('API Error Response:', error.error);
      }
    }
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Fixture Templates
  getFixtureTemplates(): Observable<FixtureTemplate[]> {
    return this.http.get<FixtureTemplate[]>(`${this.baseUrl}/fixture-templates`)
      .pipe(
        tap(() => this.logDebug('API: Fixture templates retrieved'))
      );
  }

  createFixtureTemplate(template: Omit<FixtureTemplate, 'id' | 'createdAt'>): Observable<FixtureTemplate> {
    return this.http.post<FixtureTemplate>(`${this.baseUrl}/fixture-templates`, template)
      .pipe(
        tap(() => this.logDebug('API: Fixture template created'))
      );
  }

  updateFixtureTemplate(id: string, template: Partial<FixtureTemplate>): Observable<FixtureTemplate> {
    return this.http.put<FixtureTemplate>(`${this.baseUrl}/fixture-templates/${id}`, template)
      .pipe(
        tap(() => this.logDebug('API: Fixture template updated'))
      );
  }

  deleteFixtureTemplate(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/fixture-templates/${id}`)
      .pipe(
        tap(() => this.logDebug('API: Fixture template deleted'))
      );
  }

  // Patches
  getPatches(): Observable<Patch[]> {
    return this.http.get<Patch[]>(`${this.baseUrl}/patches`)
      .pipe(
        tap(() => this.logDebug('API: Patches retrieved'))
      );
  }

  createPatch(patch: Omit<Patch, 'id' | 'createdAt'>): Observable<Patch> {
    return this.http.post<Patch>(`${this.baseUrl}/patches`, patch)
      .pipe(
        tap(() => this.logDebug('API: Patch created'))
      );
  }

  updatePatch(id: string, patch: Partial<Patch>): Observable<Patch> {
    return this.http.put<Patch>(`${this.baseUrl}/patches/${id}`, patch)
      .pipe(
        tap(() => this.logDebug('API: Patch updated'))
      );
  }

  deletePatch(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/patches/${id}`)
      .pipe(
        tap(() => this.logDebug('API: Patch deleted'))
      );
  }

  // Bulk patch creation
  createBulkPatches(bulkData: {
    templateId: string;
    universe: number;
    startAddress?: number;
    quantity: number;
    baseName?: string;
  }): Observable<{ message: string; patches: Patch[] }> {
    return this.http.post<{ message: string; patches: Patch[] }>(`${this.baseUrl}/patches/bulk`, bulkData)
      .pipe(
        tap(() => this.logDebug('API: Bulk patches created'))
      );
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
    return this.http.post<any>(`${this.baseUrl}/patches/check-addresses`, data)
      .pipe(
        tap(() => this.logDebug('API: Address availability checked'))
      );
  }

  // Get used addresses for a universe
  getUsedAddresses(universe: number): Observable<{ usedRanges: Array<{ start: number; end: number; patchId: string }> }> {
    return this.http.get<any>(`${this.baseUrl}/patches/used-addresses/${universe}`)
      .pipe(
        tap(() => this.logDebug('API: Used addresses retrieved'))
      );
  }

  // Presets
  getPresets(): Observable<Preset[]> {
    return this.http.get<Preset[]>(`${this.baseUrl}/presets`)
      .pipe(
        tap(() => this.logDebug('API: Presets retrieved'))
      );
  }

  createPreset(preset: Omit<Preset, 'id' | 'createdAt'>): Observable<Preset> {
    return this.http.post<Preset>(`${this.baseUrl}/presets`, preset)
      .pipe(
        tap(() => this.logDebug('API: Preset created'))
      );
  }

  updatePreset(id: string, preset: Partial<Preset>): Observable<Preset> {
    return this.http.put<Preset>(`${this.baseUrl}/presets/${id}`, preset)
      .pipe(
        tap(() => this.logDebug('API: Preset updated'))
      );
  }

  deletePreset(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/presets/${id}`)
      .pipe(
        tap(() => this.logDebug('API: Preset deleted'))
      );
  }

  applyPreset(id: string, fadeMs?: number): Observable<{ message: string; channelsUpdated: number; fadeMs?: number }> {
    return this.http.post<{ message: string; channelsUpdated: number; fadeMs?: number }>(`${this.baseUrl}/presets/${id}/apply`, { fadeMs })
      .pipe(
        tap(() => this.logDebug('API: Preset applied'))
      );
  }

  clearPreset(id: string, fadeMs?: number): Observable<{ message: string; channelsUpdated: number; fadeMs?: number }> {
    return this.http.post<{ message: string; channelsUpdated: number; fadeMs?: number }>(`${this.baseUrl}/presets/${id}/clear`, { fadeMs })
      .pipe(
        tap(() => this.logDebug('API: Preset cleared'))
      );
  }

  // Groups
  getGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.baseUrl}/groups`)
      .pipe(
        tap(() => this.logDebug('API: Groups retrieved'))
      );
  }

  createGroup(group: Omit<Group, 'id' | 'createdAt'>): Observable<Group> {
    return this.http.post<Group>(`${this.baseUrl}/groups`, group)
      .pipe(
        tap(() => this.logDebug('API: Group created'))
      );
  }

  updateGroup(id: string, group: Partial<Group>): Observable<Group> {
    return this.http.put<Group>(`${this.baseUrl}/groups/${id}`, group)
      .pipe(
        tap(() => this.logDebug('API: Group updated'))
      );
  }

  deleteGroup(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/groups/${id}`)
      .pipe(
        tap(() => this.logDebug('API: Group deleted'))
      );
  }

  // Universe Configuration
  getUniverseConfig(): Observable<UniverseConfig> {
    return this.http.get<UniverseConfig>(`${this.baseUrl}/universe-config`)
      .pipe(
        tap(() => this.logDebug('API: Universe config retrieved'))
      );
  }

  updateUniverseConfig(config: UniverseConfig): Observable<UniverseConfig> {
    return this.http.post<UniverseConfig>(`${this.baseUrl}/universe-config`, config)
      .pipe(
        tap(() => this.logDebug('API: Universe config updated'))
      );
  }

  // DMX Control
  setDmxChannel(channel: number, value: number): Observable<any> {
    this.logDebug(`API: Setting DMX channel ${channel} to ${value}`);
    return this.http.post(`${this.baseUrl}/dmx/set-channel`, { channel, value })
      .pipe(
        tap(response => this.logDebug(`API: DMX channel ${channel} set successfully`, response)),
        catchError(this.handleError.bind(this))
      );
  }

  setMultipleDmxChannels(channels: { channel: number; value: number }[], fadeMs?: number): Observable<any> {
    this.logDebug(`API: Setting ${channels.length} DMX channels${fadeMs ? ` with ${fadeMs}ms fade` : ''}`, channels);
    const body: any = { channels };
    if (fadeMs !== undefined && fadeMs > 0) {
      body.fadeMs = fadeMs;
    }
    return this.http.post(`${this.baseUrl}/dmx/set-multiple`, body)
      .pipe(
        tap(response => this.logDebug(`API: Multiple DMX channels set successfully`, response)),
        catchError(this.handleError.bind(this))
      );
  }

  getDmxValues(): Observable<number[]> {
    this.logDebug('API: Getting current DMX values');
    return this.http.get<number[]>(`${this.baseUrl}/dmx/values`)
      .pipe(
        tap(values => this.logDebug('API: Current DMX values retrieved', values)),
        catchError(this.handleError.bind(this))
      );
  }

  blackout(fadeMs?: number): Observable<{ message: string; fadeMs?: number }> {
    return this.http.post<{ message: string; fadeMs?: number }>(`${this.baseUrl}/dmx/blackout`, { fadeMs })
      .pipe(
        tap(() => this.logDebug('API: Blackout initiated')),
        catchError(this.handleError.bind(this))
      );
  }

  clearAll(fadeMs?: number): Observable<{ message: string; fadeMs?: number }> {
    return this.http.post<{ message: string; fadeMs?: number }>(`${this.baseUrl}/dmx/clear-all`, { fadeMs })
      .pipe(
        tap(() => this.logDebug('API: Clear all initiated')),
        catchError(this.handleError.bind(this))
      );
  }

  // Virtual Console
  getVirtualConsoleLayout(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/virtual-console/layout`)
      .pipe(
        tap(layout => this.logDebug('API: Loaded virtual console layout', layout))
      );
  }

  saveVirtualConsoleLayout(layout: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/virtual-console/layout`, layout)
      .pipe(
        tap(() => this.logDebug('API: Saved virtual console layout'))
      );
  }

  getVirtualConsoleStates(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/virtual-console/states`)
      .pipe(
        tap(states => this.logDebug('API: Loaded virtual console states', states))
      );
  }

  saveVirtualConsoleStates(states: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/virtual-console/states`, states)
      .pipe(
        tap(() => this.logDebug('API: Saved virtual console states'))
      );
  }
}