import streamDeck, { 
  action, 
  SingletonAction, 
  KeyDownEvent, 
  WillAppearEvent, 
  DidReceiveSettingsEvent, 
  SendToPluginEvent, 
  JsonValue 
} from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';

interface BatteryStatusSettings {
  ipAddress?: string;
  port?: number;
  showPercentage?: boolean;
  warningLevel?: number;
  criticalLevel?: number;
  pollingInterval?: number;
  title?: string;
  [key: string]: any;
}

/**
 * Battery Statusアクション（バッテリー状態表示）
 */
@action({ UUID: 'works.nantoka.droidcam.battery-status' })
export class BatteryStatusAction extends SingletonAction<BatteryStatusSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private batteryLevel: number = 0;
  private isCharging: boolean = false;
  private pollingInterval?: NodeJS.Timeout;
  private readonly logger = streamDeck.logger.createScope('BatteryStatus');

  override async onWillAppear(ev: WillAppearEvent<BatteryStatusSettings>): Promise<void> {
    this.logger.info('Battery Status appeared');
    
    const settings = ev.payload.settings;
    
    // デフォルト設定を一度にチェックして設定
    let needsUpdate = false;
    const updatedSettings = { ...settings };
    
    if (updatedSettings.showPercentage === undefined) {
      updatedSettings.showPercentage = true;
      needsUpdate = true;
    }
    if (updatedSettings.warningLevel === undefined) {
      updatedSettings.warningLevel = 30;
      needsUpdate = true;
    }
    if (updatedSettings.criticalLevel === undefined) {
      updatedSettings.criticalLevel = 15;
      needsUpdate = true;
    }
    if (updatedSettings.pollingInterval === undefined) {
      updatedSettings.pollingInterval = 10;
      needsUpdate = true;
    }
    
    // デフォルト値が設定された場合のみ保存
    if (needsUpdate) {
      await ev.action.setSettings(updatedSettings);
    }
    
    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      this.logger.info(`IP address configured: ${settings.ipAddress}:${settings.port || 4747}`);
      await this.checkConnectionAndUpdateState(ev.action, settings);
      this.startPolling(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合はデフォルトアイコンを表示
      this.logger.info('No IP address configured, showing default icon');
      this.isConnected = false;
      if (ev.action.isKey()) {
        await this.updateBatteryDisplay(ev.action, 0, false, false, settings);
      }
    }
  }

  override async onWillDisappear(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<BatteryStatusSettings>): Promise<void> {
    this.logger.info('Battery Status pressed');
    
    const settings = ev.payload.settings;
    
    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }
    
    // APIクライアントを初期化
    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }
    
    // バッテリー情報を取得
    const batteryInfo = await this.api.getBatteryInfo();
    if (batteryInfo) {
      // levelは直接パーセンテージ値
      const percentage = Math.round(batteryInfo.level);
      this.batteryLevel = percentage;
      // amps > 0 = 充電中, amps < 0 = 放電中, amps == 0 = 充電状態不明
      this.isCharging = batteryInfo.amps > 0;
      
      this.logger.info(`Battery: ${percentage}%, Charging: ${this.isCharging}`);
      
      // 表示を更新
      await this.updateBatteryDisplay(ev.action, percentage, this.isCharging, true, settings);
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    } else {
      this.logger.error('Failed to get battery info');
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<BatteryStatusSettings>): Promise<void> {
    this.logger.info('Battery Status settings updated');
    
    const settings = ev.payload.settings;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    // ポーリングを停止
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
      this.startPolling(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合はデフォルトアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        await this.updateBatteryDisplay(ev.action, 0, false, false, settings);
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, BatteryStatusSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
        
        if (!this.pollingInterval) {
          this.startPolling(ev.action, settings);
        }
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: BatteryStatusSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    this.logger.info(`Checking connection to ${settings.ipAddress}:${port}`);
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
      this.logger.info('Created new API instance');
    }
    
    try {
      this.logger.info('Testing connection...');
      const connectionTest = await this.api.testConnection();
      this.logger.info(`Connection test result: ${connectionTest}`);
      
      if (connectionTest) {
        this.isConnected = true;
        this.logger.info('Connected to DroidCam');
        
        // バッテリー情報を取得
        const batteryInfo = await this.api.getBatteryInfo();
        if (batteryInfo) {
          // levelは直接パーセンテージ値
          const percentage = Math.round(batteryInfo.level);
          this.batteryLevel = percentage;
          // amps > 0 = 充電中, amps < 0 = 放電中, amps == 0 = 充電状態不明
          this.isCharging = batteryInfo.amps > 0;
          this.logger.info(`Battery: ${percentage}%, Charging: ${this.isCharging}`);
        }
        
        await this.updateBatteryDisplay(action, this.batteryLevel, this.isCharging, true, settings);
      } else {
        this.isConnected = false;
        await this.updateBatteryDisplay(action, 0, false, false, settings);
      }
    } catch (error) {
      this.logger.error('Error checking connection:', error);
      this.isConnected = false;
      await this.updateBatteryDisplay(action, 0, false, false, settings);
    }
  }

  private startPolling(action: any, settings: BatteryStatusSettings): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    const interval = (settings.pollingInterval || 10) * 1000;
    
    this.pollingInterval = setInterval(async () => {
      if (!this.api || !this.isConnected) return;
      
      try {
        const batteryInfo = await this.api.getBatteryInfo();
        if (batteryInfo) {
          // levelは直接パーセンテージ値
          const percentage = Math.round(batteryInfo.level);
          // amps > 0 = 充電中, amps < 0 = 放電中, amps == 0 = 充電状態不明
          const charging = batteryInfo.amps > 0;
          
          if (percentage !== this.batteryLevel || charging !== this.isCharging) {
            this.batteryLevel = percentage;
            this.isCharging = charging;
            await this.updateBatteryDisplay(action, percentage, charging, true, settings);
            this.logger.info(`Battery updated: ${percentage}%, Charging: ${charging}`);
          }
        }
      } catch (error) {
        this.logger.error('Polling error:', error);
      }
    }, interval);
  }

  private async updateBatteryDisplay(action: any, level: number, charging: boolean, connected: boolean, settings: BatteryStatusSettings): Promise<void> {
    if (!action.isKey()) return;
    
    if (!connected) {
      // 未接続時
      await action.setImage('icons/disconnected');
      
      // 未接続時はタイトルを空に
      await action.setTitle('');
    } else {
      // バッテリーレベルに応じたアイコンを選択
      let iconName: string;
      if (charging) {
        iconName = 'battery-charging';
      } else if (level <= 20) {
        iconName = 'battery-0';
      } else if (level <= 40) {
        iconName = 'battery-25';
      } else if (level <= 60) {
        iconName = 'battery-50';
      } else if (level <= 80) {
        iconName = 'battery-75';
      } else {
        iconName = 'battery-100';
      }
      
      await action.setImage(`icons/${iconName}`);
      
      // カスタムタイトルがあれば使用、なければバッテリー残量
      if (settings?.title && settings.title.trim()) {
        await action.setTitle(settings.title);
      } else if (settings?.showPercentage !== false) {
        await action.setTitle(`${level}%`);
      } else {
        await action.setTitle('');
      }
    }
  }
}