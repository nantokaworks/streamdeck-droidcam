import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface StopRestartButtonSettings {
  ipAddress?: string;
  port?: number;
  [key: string]: any;
}

/**
 * Stop/Restartボタンアクション（DroidCam停止/再開切り替え）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.stop-restart-button' })
export class StopRestartButtonAction extends SingletonAction<StopRestartButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private isStopped: boolean = false;
  private isProcessing: boolean = false;
  private pollingInterval?: NodeJS.Timeout;
  private readonly logger = streamDeck.logger.createScope('StopRestartButton');

  override async onWillAppear(ev: WillAppearEvent<StopRestartButtonSettings>): Promise<void> {
    this.logger.info('Stop/Restart Button appeared');
    
    const settings = await ev.action.getSettings();
    
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
        await this.updateButtonState(ev.action, false, false);
      }
    }
  }

  override async onWillDisappear(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  override async onKeyDown(ev: KeyDownEvent<StopRestartButtonSettings>): Promise<void> {
    this.logger.info(`Stop/Restart Button pressed`);
    
    // 処理中の場合は無視
    if (this.isProcessing) {
      this.logger.info(`Already processing, ignoring press`);
      return;
    }
    
    const settings = await ev.action.getSettings();
    
    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }
    
    // APIクライアントを初期化
    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }
    
    this.isProcessing = true;
    
    // 現在の状態を確認
    const stopped = await this.api.isStopped();
    
    if (stopped) {
      // 停止中なら再開
      this.logger.info(`Restarting DroidCam`);
      await this.updateButtonState(ev.action, true, false);
      
      const success = await this.api.restartDroidCam();
      
      if (success) {
        this.logger.info(`DroidCam restart initiated`);
        this.isStopped = false;
        
        if (ev.action.isKey()) {
          await ev.action.showOk();
        }
        
        // 再開完了を待つ
        setTimeout(async () => {
          this.isProcessing = false;
          await this.checkConnectionAndUpdateState(ev.action, settings);
        }, 2000);
      } else {
        this.logger.error(`Failed to restart DroidCam`);
        this.isProcessing = false;
        if (ev.action.isKey()) {
          await ev.action.showAlert();
        }
      }
    } else {
      // 動作中なら停止
      this.logger.info(`Stopping DroidCam`);
      await this.updateButtonState(ev.action, true, true);
      
      const success = await this.api.stopDroidCam();
      
      if (success) {
        this.logger.info(`DroidCam stopped`);
        this.isStopped = true;
        
        if (ev.action.isKey()) {
          await ev.action.showOk();
        }
        
        setTimeout(async () => {
          this.isProcessing = false;
          await this.updateButtonState(ev.action, true, true);
        }, 500);
      } else {
        this.logger.error(`Failed to stop DroidCam`);
        this.isProcessing = false;
        if (ev.action.isKey()) {
          await ev.action.showAlert();
        }
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<StopRestartButtonSettings>): Promise<void> {
    this.logger.info(`Stop/Restart Button settings updated`);
    
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
        await this.updateButtonState(ev.action, false, false);
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, StopRestartButtonSettings>): Promise<void> {
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

  private async checkConnectionAndUpdateState(action: any, settings: StopRestartButtonSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    this.logger.info(`Checking connection to ${settings.ipAddress}:${port}`);
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
      this.logger.info(`Created new API instance`);
    }
    
    try {
      // 停止状態を確認
      const stopped = await this.api.isStopped();
      this.isStopped = stopped;
      this.isConnected = true;
      
      this.logger.info(`DroidCam state: ${stopped ? 'stopped' : 'running'}`);
      await this.updateButtonState(action, true, stopped);
    } catch (error) {
      this.logger.error(`Error checking connection:`, error);
      this.isConnected = false;
      await this.updateButtonState(action, false, false);
    }
  }

  private startPolling(action: any, settings: StopRestartButtonSettings): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.pollingInterval = setInterval(async () => {
      if (!this.api || !this.isConnected || this.isProcessing) return;
      
      try {
        const stopped = await this.api.isStopped();
        if (stopped !== this.isStopped) {
          this.isStopped = stopped;
          await this.updateButtonState(action, true, stopped);
          this.logger.info(`State changed to: ${stopped ? 'stopped' : 'running'}`);
        }
      } catch (error) {
        this.logger.error(`Polling error:`, error);
      }
    }, API_POLLING_INTERVAL);
  }

  private async updateButtonState(action: any, connected: boolean, stopped: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    } else if (stopped) {
      // 停止中：再生アイコン
      await action.setImage('icons/stop-restart.svg');
      await action.setTitle('START');
    } else {
      // 動作中：停止アイコン
      await action.setImage('icons/stop.svg');
      await action.setTitle('STOP');
    }
  }
}