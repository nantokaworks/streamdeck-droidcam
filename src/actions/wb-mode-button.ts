import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface WBModeButtonSettings {
  ipAddress?: string;
  port?: number;
  targetMode?: number;
  manualValue?: number;
  [key: string]: any;
}

// ホワイトバランスモードの定義
const WB_MODES = [
  { mode: 0, name: 'Auto', icon: 'wb-auto' },
  { mode: 1, name: 'Incandescent', icon: 'wb-incandescent' },
  { mode: 2, name: 'Fluorescent', icon: 'wb-fluorescent' },
  { mode: 3, name: 'Warm Fluor.', icon: 'wb-warm-fluorescent' },
  { mode: 4, name: 'Daylight', icon: 'wb-daylight' },
  { mode: 5, name: 'Cloudy', icon: 'wb-cloudy' },
  { mode: 6, name: 'Twilight', icon: 'wb-twilight' },
  { mode: 7, name: 'Shade', icon: 'wb-shade' },
  { mode: 8, name: 'Manual', icon: 'wb-manual' }
];

/**
 * WB Modeボタンアクション（ホワイトバランスモード切り替え）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.wb-mode-button' })
export class WBModeButtonAction extends SingletonAction<WBModeButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private currentMode: number = 0;
  private targetMode: number = 0;
  private readonly logger = streamDeck.logger.createScope('WBModeButton');
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<WBModeButtonAction>();

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    WBModeButtonAction.pollingInstances.add(this);
    
    if (!WBModeButtonAction.pollingTimer) {
      this.logger.info(`Starting API polling for WBModeButton`);
      WBModeButtonAction.pollingTimer = setInterval(() => {
        WBModeButtonAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (WBModeButtonAction.pollingInstances.size === 0) return;
    
    // 最初のインスタンスを使ってAPIを呼ぶ
    const firstInstance = Array.from(WBModeButtonAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      firstInstance.logger.debug(`[WBModeButton] Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        firstInstance.logger.debug(`[WBModeButton] No camera info available`);
        return;
      }
      
      const apiWBMode = cameraInfo.wbMode || 0;
      firstInstance.logger.debug(`[WBModeButton] API WB mode: ${apiWBMode}`);
      
      // 全インスタンスで変更をチェック
      for (const instance of WBModeButtonAction.pollingInstances) {
        const wbInstance = instance as WBModeButtonAction;
        
        // 値が変わっていたら更新
        if (wbInstance.currentMode !== apiWBMode) {
          firstInstance.logger.info(`WB mode changed from API - old: ${wbInstance.currentMode}, new: ${apiWBMode}`);
          
          // 値を更新して同期
          wbInstance.currentMode = apiWBMode;
          await wbInstance.syncModeToAllInstances(apiWBMode);
        }
      }
    } catch (error) {
      firstInstance.logger.error(`[WBModeButton] Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    WBModeButtonAction.pollingInstances.delete(this);
    
    if (WBModeButtonAction.pollingInstances.size === 0 && WBModeButtonAction.pollingTimer) {
      this.logger.info(`Stopping API polling`);
      clearInterval(WBModeButtonAction.pollingTimer);
      WBModeButtonAction.pollingTimer = undefined;
    }
  }

  // 全てのインスタンスに直接値を同期
  private async syncModeToAllInstances(newMode: number): Promise<void> {
    this.logger.info(`Syncing WB mode to all instances: ${newMode}`);
    
    // 自分自身も含めて全インスタンスを更新
    const updatePromises = Array.from(this.actions).map(async (action) => {
      // SingletonActionのインスタンスをキャスト
      const wbAction = action as any;
      if (wbAction) {
        // 値を直接更新
        wbAction.currentMode = newMode;
        
        // UIを更新（各インスタンスの設定に基づいてアイコンを表示）
        if (action.isKey()) {
          const settings = await action.getSettings();
          const targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
          const modeInfo = WB_MODES.find(m => m.mode === targetMode) || WB_MODES[0];
          await action.setImage(`icons/${modeInfo.icon}.svg`);
          await action.setTitle(modeInfo.name);
        }
      }
    });
    
    await Promise.all(updatePromises);
    this.logger.info(`Synced to ${Array.from(this.actions).length} instances`);
  }

  private async initializeFromGlobalSettings(): Promise<void> {
    if (this.isInitialized) return;
    
    // Pollingで値が取得されるのを待つ
    this.logger.info(`Initialized with defaults, waiting for API polling`);
    
    this.isInitialized = true;
  }

  override async onWillAppear(ev: WillAppearEvent<WBModeButtonSettings>): Promise<void> {
    this.logger.info(`WB Mode Button appeared`);
    
    // 最初にGlobalSettingsから状態を初期化
    await this.initializeFromGlobalSettings();
    
    const settings = await ev.action.getSettings();
    
    // targetModeを取得・設定
    this.targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
    
    // デフォルト設定の保存
    if (settings.targetMode === undefined) {
      settings.targetMode = 0;
      await ev.action.setSettings(settings);
    }
    
    // 設定がある場合は接続を確認
    if (settings.ipAddress) {
      this.logger.info(`IP address configured: ${settings.ipAddress}:${settings.port || 4747}`);
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.logger.info(`No IP address configured, showing default icon`);
      this.isConnected = false;
      if (ev.action.isKey()) {
        const modeInfo = WB_MODES.find(m => m.mode === this.targetMode) || WB_MODES[0];
        await ev.action.setImage(`icons/${modeInfo.icon}.svg`);
        await ev.action.setTitle(modeInfo.name);
        this.logger.info(`Set default icon: ${modeInfo.icon}`);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<WBModeButtonSettings>): Promise<void> {
    this.logger.info(`WB Mode Button pressed`);
    
    const settings = await ev.action.getSettings();
    
    if (!settings.ipAddress) {
      await ev.action.showAlert();
      return;
    }
    
    // APIクライアントを初期化
    if (!this.api || this.api.host !== settings.ipAddress) {
      this.api = new DroidCamAPI(settings.ipAddress, (settings.port as number) || 4747);
    }
    
    // まず接続をチェック
    const connectionTest = await this.api.testConnection();
    if (!connectionTest) {
      this.logger.error(`Device not connected`);
      this.isConnected = false;
      await this.updateButtonState(ev.action, false);
      await ev.action.showAlert();
      return;
    }
    
    // 設定されたターゲットモードを使用
    const targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
    
    this.logger.info(`Setting WB mode to: ${targetMode}`);
    
    // Manual（モード8）の場合はWB値を設定
    if (targetMode === 8) {
      const manualValue = settings.manualValue !== undefined ? settings.manualValue : 60;
      this.logger.info(`Manual mode selected - setting WB level to ${manualValue}`);
      
      // WB値を設定（自動的にManualモードになる）
      const success = await this.api.setWhiteBalance(manualValue);
      
      if (success) {
        this.currentMode = targetMode;
        this.isConnected = true;
        this.logger.info(`WB level set to ${manualValue}`);
        
        // 同じUUID内の全インスタンスに同期
        await this.syncModeToAllInstances(targetMode);
        
        if (ev.action.isKey()) {
          await ev.action.showOk();
        }
      } else {
        this.logger.error(`Failed to set WB level to ${manualValue}`);
        if (ev.action.isKey()) {
          await ev.action.showAlert();
        }
      }
      return;
    }
    
    // ホワイトバランスモードを設定（0-7のみ）
    const success = await this.api.setWhiteBalanceMode(targetMode);
    
    if (success) {
      this.currentMode = targetMode;
      this.logger.info(`WB mode set to ${targetMode}`);
      this.isConnected = true;
      
      // 同じUUID内の全インスタンスに同期
      await this.syncModeToAllInstances(targetMode);
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    } else {
      this.logger.error(`Failed to set WB mode to ${targetMode}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WBModeButtonSettings>): Promise<void> {
    this.logger.info(`WB Mode Button settings updated`);
    
    const settings = ev.payload.settings;
    
    // targetModeを更新
    this.targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
    
    // APIインスタンスをリセット
    this.api = undefined;
    
    if (settings.ipAddress) {
      await this.checkConnectionAndUpdateState(ev.action, settings);
    } else {
      // IPアドレスが設定されていない場合は通常のアイコンを表示
      this.isConnected = false;
      if (ev.action.isKey()) {
        const modeInfo = WB_MODES.find(m => m.mode === this.targetMode) || WB_MODES[0];
        await ev.action.setImage(`icons/${modeInfo.icon}.svg`);
        await ev.action.setTitle(modeInfo.name);
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, WBModeButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: WBModeButtonSettings): Promise<void> {
    if (!settings.ipAddress) return;
    
    const port = settings.port || 4747;
    this.logger.info(`Checking connection to ${settings.ipAddress}:${port}`);
    
    if (!this.api || this.api.host !== settings.ipAddress || this.api.port !== port) {
      this.api = new DroidCamAPI(settings.ipAddress, port);
      this.logger.info(`Created new API instance`);
    }
    
    try {
      this.logger.info(`Testing connection...`);
      const connectionTest = await this.api.testConnection();
      this.logger.info(`Connection test result: ${connectionTest}`);
      
      if (connectionTest) {
        this.isConnected = true;
        
        // 現在のWBモードを取得
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo && cameraInfo.wbMode !== undefined) {
          const apiMode = cameraInfo.wbMode;
          if (this.currentMode !== apiMode) {
            this.logger.info(`API WB mode (${apiMode}) differs from current mode (${this.currentMode})`);
          }
          
          this.logger.info(`Connected to DroidCam. Current WB mode: ${this.currentMode}`);
          
          if (action.isKey()) {
            // 設定されたターゲットモードのアイコンを表示
            const settings = await action.getSettings();
            const targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
            const modeInfo = WB_MODES.find(m => m.mode === targetMode) || WB_MODES[0];
            await action.setImage(`icons/${modeInfo.icon}.svg`);
            await action.setTitle(modeInfo.name);
          }
        }
      } else {
        this.isConnected = false;
        await this.updateButtonState(action, false);
      }
    } catch (error) {
      this.logger.error(`Error checking connection:`, error);
      this.isConnected = false;
      await this.updateButtonState(action, false);
    }
  }

  private async updateButtonState(action: any, connected: boolean): Promise<void> {
    if (!action.isKey()) return;
    
    if (!connected) {
      // 非接続時：切断状態のアイコンを表示
      await action.setImage('icons/disconnected');
      await action.setTitle('');
    }
  }
}