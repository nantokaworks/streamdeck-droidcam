import streamDeck, { action, SingletonAction, KeyDownEvent, WillAppearEvent, DidReceiveSettingsEvent, SendToPluginEvent, JsonValue } from '@elgato/streamdeck';
import { DroidCamAPI } from '../services/DroidCamAPI';
import { API_POLLING_INTERVAL } from '../utils/constants';

interface FocusModeButtonSettings {
  ipAddress?: string;
  port?: number;
  targetMode?: number;
  [key: string]: any;
}

// フォーカスモードの定義
const FOCUS_MODES = [
  { mode: 0, name: 'Normal', icon: 'focus-normal' },
  { mode: 1, name: 'Macro', icon: 'focus-macro' },
  { mode: 2, name: 'Continuous', icon: 'focus-continuous' },
  { mode: 3, name: 'Infinity', icon: 'focus-infinity' }
];

/**
 * Focus Modeボタンアクション（AFモード切り替え）
 */
// @ts-ignore
@action({ UUID: 'works.nantoka.droidcam.focus-mode-button' })
export class FocusModeButtonAction extends SingletonAction<FocusModeButtonSettings> {
  private api?: DroidCamAPI;
  private isConnected: boolean = false;
  private currentMode: number = 0;
  private targetMode: number = 0;
  private readonly logger = streamDeck.logger.createScope('FocusModeButton');
  private isInitialized = false;
  private static pollingTimer?: NodeJS.Timeout;
  private static pollingInstances = new Set<FocusModeButtonAction>();

  constructor() {
    super();
    this.startPollingIfNeeded();
  }

  private startPollingIfNeeded(): void {
    FocusModeButtonAction.pollingInstances.add(this);
    
    if (!FocusModeButtonAction.pollingTimer) {
      this.logger.info(`Starting API polling for FocusModeButton`);
      FocusModeButtonAction.pollingTimer = setInterval(() => {
        FocusModeButtonAction.pollAllInstances();
      }, API_POLLING_INTERVAL);
    }
  }

  private static async pollAllInstances(): Promise<void> {
    if (FocusModeButtonAction.pollingInstances.size === 0) return;
    
    // 最初のインスタンスを使ってAPIを呼ぶ
    const firstInstance = Array.from(FocusModeButtonAction.pollingInstances)[0];
    if (!firstInstance || !firstInstance.api) return;
    
    try {
      firstInstance.logger.debug(`[FocusModeButton] Polling API...`);
      const cameraInfo = await firstInstance.api.getCameraInfo();
      
      if (!cameraInfo) {
        firstInstance.logger.debug(`[FocusModeButton] No camera info available`);
        return;
      }
      
      const apiFocusMode = cameraInfo.focusMode || 0;
      firstInstance.logger.debug(`[FocusModeButton] API focus mode: ${apiFocusMode}`);
      
      // 全インスタンスで変更をチェック
      for (const instance of FocusModeButtonAction.pollingInstances) {
        const focusInstance = instance as FocusModeButtonAction;
        
        // 値が変わっていたら更新
        if (focusInstance.currentMode !== apiFocusMode) {
          firstInstance.logger.info(`Focus mode changed from API - old: ${focusInstance.currentMode}, new: ${apiFocusMode}`);
          
          // 値を更新して同期
          focusInstance.currentMode = apiFocusMode;
          await focusInstance.syncModeToAllInstances(apiFocusMode);
        }
      }
    } catch (error) {
      firstInstance.logger.error(`[FocusModeButton] Failed to poll API:`, error);
    }
  }

  override async onWillDisappear(): Promise<void> {
    FocusModeButtonAction.pollingInstances.delete(this);
    
    if (FocusModeButtonAction.pollingInstances.size === 0 && FocusModeButtonAction.pollingTimer) {
      this.logger.info(`Stopping API polling`);
      clearInterval(FocusModeButtonAction.pollingTimer);
      FocusModeButtonAction.pollingTimer = undefined;
    }
  }

  // 全てのインスタンスに直接値を同期
  private async syncModeToAllInstances(newMode: number): Promise<void> {
    this.logger.info(`Syncing focus mode to all instances: ${newMode}`);
    
    // 自分自身も含めて全インスタンスを更新
    const updatePromises = Array.from(this.actions).map(async (action) => {
      // SingletonActionのインスタンスをキャスト
      const focusAction = action as any;
      if (focusAction) {
        // 値を直接更新
        focusAction.currentMode = newMode;
        
        // UIを更新
        if (action.isKey()) {
          const modeInfo = FOCUS_MODES.find(m => m.mode === newMode) || FOCUS_MODES[0];
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

  override async onWillAppear(ev: WillAppearEvent<FocusModeButtonSettings>): Promise<void> {
    this.logger.info(`Focus Mode Button appeared`);
    
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
        const modeInfo = FOCUS_MODES.find(m => m.mode === this.targetMode) || FOCUS_MODES[0];
        await ev.action.setImage(`icons/${modeInfo.icon}.svg`);
        await ev.action.setTitle(modeInfo.name);
        this.logger.info(`Set default icon: ${modeInfo.icon}`);
      }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<FocusModeButtonSettings>): Promise<void> {
    this.logger.info(`Focus Mode Button pressed`);
    
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
    
    this.logger.info(`Setting focus mode to: ${targetMode}`);
    
    // フォーカスモードを設定
    const success = await this.api.setAutofocusMode(targetMode);
    
    if (success) {
      this.currentMode = targetMode;
      this.logger.info(`Focus mode set to ${targetMode}`);
      this.isConnected = true;
      
      // 同じUUID内の全インスタンスに同期
      await this.syncModeToAllInstances(targetMode);
      
      if (ev.action.isKey()) {
        await ev.action.showOk();
      }
    } else {
      this.logger.error(`Failed to set focus mode to ${targetMode}`);
      if (ev.action.isKey()) {
        await ev.action.showAlert();
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<FocusModeButtonSettings>): Promise<void> {
    this.logger.info(`Focus Mode Button settings updated`);
    
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
        const modeInfo = FOCUS_MODES.find(m => m.mode === this.targetMode) || FOCUS_MODES[0];
        await ev.action.setImage(`icons/${modeInfo.icon}.svg`);
        await ev.action.setTitle(modeInfo.name);
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, FocusModeButtonSettings>): Promise<void> {
    if (typeof ev.payload === 'object' && ev.payload !== null) {
      const payload = ev.payload as any;
      
      if (payload.action === 'testConnection' && payload.success) {
        this.logger.info(`Test connection successful: ${payload.deviceName}`);
        
        const settings = await ev.action.getSettings();
        await this.checkConnectionAndUpdateState(ev.action, settings);
      }
    }
  }

  private async checkConnectionAndUpdateState(action: any, settings: FocusModeButtonSettings): Promise<void> {
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
        
        // 現在のフォーカスモードを取得
        const cameraInfo = await this.api.getCameraInfo();
        if (cameraInfo && cameraInfo.focusMode !== undefined) {
          const apiMode = cameraInfo.focusMode;
          if (this.currentMode !== apiMode) {
            this.logger.info(`API focus mode (${apiMode}) differs from current mode (${this.currentMode})`);
            // 注: ここでsyncModeToAllInstancesを呼ばない（2重処理防止）
          }
          
          this.logger.info(`Connected to DroidCam. Current focus mode: ${this.currentMode}`);
          
          if (action.isKey()) {
            // 設定されたターゲットモードのアイコンを表示
            const settings = await action.getSettings();
            const targetMode = settings.targetMode !== undefined ? settings.targetMode : 0;
            const modeInfo = FOCUS_MODES.find(m => m.mode === targetMode) || FOCUS_MODES[0];
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