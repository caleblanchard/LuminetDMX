export interface FixtureChannel {
  name: string;
  channelOffset: number;
  type: 'dimmer' | 'color' | 'position' | 'gobo' | 'other';
  defaultValue: number;
  minValue: number;
  maxValue: number;
}

export interface FixtureTemplate {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  channelCount: number;
  channels: FixtureChannel[];
  createdAt: string;
}

export interface Patch {
  id: string;
  name: string;
  templateId: string;
  startAddress: number;
  universe: number;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  patchIds: string[];
  color: string;
  createdAt: string;
}

export interface UniverseConfig {
  universe: number;
  broadcastIP: string;
}

export interface PresetChannelValue {
  channel: number;
  value: number;
  patchId?: string;
  patchName?: string;
  channelName?: string;
}

export interface Preset {
  id: string;
  name: string;
  description?: string;
  channelValues: PresetChannelValue[];
  fadeMs?: number;
  createdAt: string;
  updatedAt?: string;
}