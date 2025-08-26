import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-dmx-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dmx-monitor">
      <h3 class="text-lg mb-4" *ngIf="showTitle">DMX Monitor</h3>
      <div class="monitor-grid">
        <div class="monitor-channel" 
             *ngFor="let value of dmxValues.slice(0, channelCount); let i = index"
             [class.active]="value > 0">
          <div class="channel-num">{{ i + 1 }}</div>
          <div class="channel-val">{{ value }}</div>
        </div>
      </div>
      <div class="monitor-info" *ngIf="hasActiveChannels()">
        Showing channels 1-{{ channelCount }}. Active channels: {{ getActiveChannelCount() }}
      </div>
    </div>
  `,
  styles: [`
    .dmx-monitor {
      background: rgba(30, 41, 59, 0.6);
      border-radius: 12px;
      padding: 16px;
      border: 1px solid rgba(148, 163, 184, 0.1);
    }

    .monitor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
      gap: 4px;
      margin-bottom: 8px;
    }

    .monitor-channel {
      background: rgba(15, 23, 42, 0.8);
      border-radius: 4px;
      padding: 4px 2px;
      text-align: center;
      border: 1px solid rgba(148, 163, 184, 0.1);
      transition: all 0.2s ease;
    }

    .monitor-channel.active {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.3);
    }

    .channel-num {
      font-size: 10px;
      color: #94a3b8;
    }

    .channel-val {
      font-size: 12px;
      font-weight: 500;
      color: #e2e8f0;
    }

    .monitor-info {
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }

    @media (max-width: 768px) {
      .monitor-grid {
        grid-template-columns: repeat(8, 1fr);
      }
    }
  `]
})
export class DmxMonitorComponent implements OnInit, OnDestroy {
  @Input() channelCount = 64;
  @Input() showTitle = false;

  dmxValues: number[] = new Array(512).fill(0);

  private subscriptions: Subscription[] = [];

  constructor(private websocketService: WebsocketService) {}

  ngOnInit(): void {
    const dmxSub = this.websocketService.dmxValues$.subscribe(values => {
      this.dmxValues = values;
    });
    this.subscriptions.push(dmxSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  getActiveChannelCount(): number {
    return this.dmxValues.slice(0, this.channelCount).filter(v => v > 0).length;
  }

  hasActiveChannels(): boolean {
    return this.dmxValues.slice(0, this.channelCount).some(v => v > 0);
  }
}


