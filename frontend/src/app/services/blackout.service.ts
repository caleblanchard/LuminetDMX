import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class BlackoutService {
  private blackoutState = new BehaviorSubject<boolean>(false);
  private savedDmxValues: number[] = [];
  
  public blackoutState$ = this.blackoutState.asObservable();

  constructor(private apiService: ApiService) {}

  isBlackedOut(): boolean {
    return this.blackoutState.value;
  }

  async toggleBlackout(): Promise<void> {
    const currentlyBlackedOut = this.blackoutState.value;
    
    if (currentlyBlackedOut) {
      // Restore previous values
      await this.restoreFromBlackout();
    } else {
      // Save current values and go to blackout
      await this.activateBlackout();
    }
  }

  private async activateBlackout(): Promise<void> {
    try {
      // Get current DMX values before blackout
      const values = await firstValueFrom(this.apiService.getDmxValues());
      this.savedDmxValues = [...values]; // Save a copy
      
      // Send blackout command to backend
      await firstValueFrom(this.apiService.blackout(0));
      
      this.blackoutState.next(true);
    } catch (error) {
      console.error('Error activating blackout:', error);
    }
  }

  private async restoreFromBlackout(): Promise<void> {
    try {
      // Restore the saved DMX values
      const channels: { channel: number; value: number }[] = [];
      
      this.savedDmxValues.forEach((value, index) => {
        if (value > 0) {
          channels.push({ channel: index + 1, value });
        }
      });

      if (channels.length > 0) {
        await firstValueFrom(this.apiService.setMultipleDmxChannels(channels));
      }
      
      this.blackoutState.next(false);
      this.savedDmxValues = []; // Clear saved values
    } catch (error) {
      console.error('Error restoring from blackout:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      // Clear blackout state if active
      if (this.blackoutState.value) {
        this.blackoutState.next(false);
        this.savedDmxValues = [];
      }
      
      // Send blackout command to clear all channels
      await firstValueFrom(this.apiService.blackout(0));
      
      // Broadcast clear all event for virtual console to listen to
      window.dispatchEvent(new CustomEvent('clearAllChannels'));
      
    } catch (error) {
      console.error('Error clearing all channels:', error);
    }
  }
}