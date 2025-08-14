import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { PresetChannelValue } from '../models/fixture.model';

export interface ActiveElement {
  id: string;
  type: 'button' | 'fader';
  presetIds: string[];
  value: number; // 0-100 for faders, 0 or 100 for buttons
  activatedAt: number;
}

export interface DmxChannelValue {
  channel: number;
  value: number;
  source: {
    elementId: string;
    presetId: string;
    activatedAt: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DmxCalculationService {
  private activeElements = new Map<string, ActiveElement>();
  private presetCache = new Map<string, PresetChannelValue[]>();
  private currentDmxValues = new Map<number, DmxChannelValue>();
  private dmxMode: 'HTP' | 'LTP' = 'HTP';
  private allKnownChannels = new Set<number>(); // Track all channels we've ever used
  
  private dmxValuesSubject = new BehaviorSubject<Map<number, number>>(new Map());
  public dmxValues$ = this.dmxValuesSubject.asObservable();

  constructor() {
    this.loadSettings();
    this.watchSettingsChanges();
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('luminetDmxSettings');
    if (saved) {
      const settings = JSON.parse(saved);
      this.dmxMode = settings.dmxMode || 'HTP';
    }
  }

  private watchSettingsChanges(): void {
    // Watch for custom settings change event
    window.addEventListener('luminetDmxSettingsChanged', (e: any) => {
      this.dmxMode = e.detail.dmxMode || 'HTP';
      this.recalculateDmxValues();
    });
    
    // Also watch for localStorage changes (for cross-tab sync)
    window.addEventListener('storage', (e) => {
      if (e.key === 'luminetDmxSettings') {
        this.loadSettings();
        this.recalculateDmxValues();
      }
    });
  }

  setDmxMode(mode: 'HTP' | 'LTP'): void {
    this.dmxMode = mode;
    this.recalculateDmxValues();
  }

  updateActiveElement(element: ActiveElement): void {
    if (element.value === 0) {
      // Remove elements with zero value (faders at 0 or buttons toggled off)
      this.activeElements.delete(element.id);
    } else {
      // Add or update active elements
      this.activeElements.set(element.id, element);
    }
    
    this.recalculateDmxValues();
  }

  removeActiveElement(elementId: string): void {
    this.activeElements.delete(elementId);
    this.recalculateDmxValues();
  }

  setPresetData(presetId: string, channelValues: PresetChannelValue[]): void {
    this.presetCache.set(presetId, channelValues);
    
    // Track all channels from this preset
    channelValues.forEach(cv => this.allKnownChannels.add(cv.channel));
    
    this.recalculateDmxValues();
  }

  private recalculateDmxValues(): void {
    const newDmxValues = new Map<number, DmxChannelValue>();
    
    // Process all active elements
    for (const element of this.activeElements.values()) {
      for (const presetId of element.presetIds) {
        const presetChannels = this.presetCache.get(presetId);
        if (!presetChannels) continue;

        // Calculate effective values for this preset within the element
        const elementChannels = this.calculateElementChannelValues(presetChannels, element.value);
        
        // Apply HTP within the element (presets in same element always use HTP)
        for (const channelValue of elementChannels) {
          const channel = channelValue.channel;
          const existingElementChannel = newDmxValues.get(channel);
          
          if (!existingElementChannel || 
              existingElementChannel.source.elementId !== element.id) {
            // New channel or from different element
            const newValue: DmxChannelValue = {
              channel,
              value: channelValue.value,
              source: {
                elementId: element.id,
                presetId,
                activatedAt: element.activatedAt
              }
            };
            
            if (existingElementChannel) {
              // Apply HTP/LTP between elements
              const shouldReplace = this.dmxMode === 'LTP' 
                ? element.activatedAt > existingElementChannel.source.activatedAt
                : channelValue.value > existingElementChannel.value;
              
              if (shouldReplace) {
                newDmxValues.set(channel, newValue);
              }
            } else {
              newDmxValues.set(channel, newValue);
            }
          } else {
            // Same element, apply HTP within element
            if (channelValue.value > existingElementChannel.value) {
              existingElementChannel.value = channelValue.value;
              existingElementChannel.source.presetId = presetId;
            }
          }
        }
      }
    }

    this.currentDmxValues = newDmxValues;
    
    // Convert to simple channel->value map for emission
    // Include ALL known channels, setting inactive ones to 0
    const outputValues = new Map<number, number>();
    
    // Set all known channels to their current value or 0 if not active
    for (const channel of this.allKnownChannels) {
      const dmxValue = newDmxValues.get(channel);
      outputValues.set(channel, dmxValue ? dmxValue.value : 0);
    }
    
    this.dmxValuesSubject.next(outputValues);
  }

  private calculateElementChannelValues(
    presetChannels: PresetChannelValue[], 
    elementValue: number
  ): PresetChannelValue[] {
    // For faders, scale the preset values by the fader position
    const scaleFactor = elementValue / 100;
    
    return presetChannels.map(channel => ({
      ...channel,
      value: Math.round(channel.value * scaleFactor)
    }));
  }

  getCurrentDmxValues(): Map<number, number> {
    const values = new Map<number, number>();
    for (const [channel, dmxValue] of this.currentDmxValues) {
      values.set(channel, dmxValue.value);
    }
    return values;
  }

  getDmxChannelInfo(channel: number): DmxChannelValue | undefined {
    return this.currentDmxValues.get(channel);
  }

  getActiveElements(): ActiveElement[] {
    return Array.from(this.activeElements.values());
  }

  clearAll(): void {
    this.activeElements.clear();
    this.recalculateDmxValues();
  }
}