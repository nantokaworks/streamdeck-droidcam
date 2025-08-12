var PICommon = (function (exports) {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise, SuppressedError, Symbol, Iterator */


    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    /**
     * Property Inspector Common Library
     * Provides base functionality for all Property Inspector pages
     */
    /**
     * Property Inspector base class
     * Handles WebSocket connection, settings management, and common operations
     */
    class PropertyInspector {
        constructor(options = {}) {
            this.websocket = null;
            this.uuid = '';
            this.actionInfo = null;
            this.settings = { ipAddress: '', port: 4747 };
            this.saveTimeout = null;
            this.settingsChangeCallbacks = [];
            this.options = Object.assign({ autoSave: true, debounceDelay: 500, debug: false }, options);
        }
        /**
         * Initialize the Property Inspector connection
         * Called by connectElgatoStreamDeckSocket
         */
        connect(port, uuid, registerEvent, info, actionInfo) {
            this.uuid = uuid;
            try {
                this.actionInfo = JSON.parse(actionInfo);
                this.settings = this.actionInfo.payload.settings || { ipAddress: '', port: 4747 };
            }
            catch (e) {
                this.log('Failed to parse action info:', e);
            }
            // Connect to Stream Deck
            this.websocket = new WebSocket(`ws://localhost:${port}`);
            this.websocket.onopen = () => {
                this.log('WebSocket connected');
                // Register with Stream Deck
                this.send({
                    event: registerEvent,
                    uuid: this.uuid
                });
                // Notify callbacks of initial settings
                this.notifySettingsChange(this.settings);
            };
            this.websocket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                }
                catch (e) {
                    this.log('Failed to parse message:', e);
                }
            };
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            this.websocket.onclose = () => {
                this.log('WebSocket closed');
                this.websocket = null;
            };
        }
        /**
         * Handle messages from Stream Deck
         */
        handleMessage(message) {
            var _a;
            switch (message.event) {
                case 'didReceiveSettings':
                    if ((_a = message.payload) === null || _a === void 0 ? void 0 : _a.settings) {
                        this.settings = message.payload.settings;
                        this.notifySettingsChange(this.settings);
                    }
                    break;
                case 'sendToPropertyInspector':
                    // Handle custom messages from plugin
                    this.handleCustomMessage(message.payload);
                    break;
                default:
                    this.log('Unhandled message:', message);
            }
        }
        /**
         * Handle custom messages from plugin
         * Override in subclass for specific handling
         */
        handleCustomMessage(payload) {
            // Default implementation - override in subclass
        }
        /**
         * Send message to Stream Deck
         */
        send(message) {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                this.websocket.send(JSON.stringify(message));
            }
            else {
                this.log('WebSocket not ready');
            }
        }
        /**
         * Save settings to Stream Deck
         */
        saveSettings(settings) {
            if (settings) {
                this.settings = Object.assign(Object.assign({}, this.settings), settings);
            }
            // Validate settings if validator provided
            if (this.options.validator && !this.options.validator(this.settings)) {
                this.log('Settings validation failed');
                return;
            }
            this.send({
                event: 'setSettings',
                context: this.uuid,
                payload: this.settings
            });
            this.log('Settings saved:', this.settings);
        }
        /**
         * Save settings with debounce
         */
        saveSettingsDebounced(settings) {
            if (!this.options.autoSave) {
                return;
            }
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            this.saveTimeout = window.setTimeout(() => {
                this.saveSettings(settings);
                this.saveTimeout = null;
            }, this.options.debounceDelay);
        }
        /**
         * Get current settings
         */
        getSettings() {
            return Object.assign({}, this.settings);
        }
        /**
         * Update specific setting
         */
        updateSetting(key, value) {
            this.settings[key] = value;
            if (this.options.autoSave) {
                this.saveSettingsDebounced();
            }
        }
        /**
         * Test DroidCam connection
         */
        testConnection(ipAddress, port) {
            return __awaiter(this, void 0, void 0, function* () {
                const ip = ipAddress || this.settings.ipAddress;
                const p = port || this.settings.port || 4747;
                if (!ip) {
                    return {
                        success: false,
                        error: 'IP address is required'
                    };
                }
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);
                    const response = yield fetch(`http://${ip}:${p}/v1/phone/name`, { signal: controller.signal });
                    clearTimeout(timeout);
                    if (response.ok) {
                        const deviceName = yield response.text();
                        return {
                            success: true,
                            deviceName: deviceName.trim()
                        };
                    }
                    else {
                        return {
                            success: false,
                            error: `HTTP ${response.status}`,
                            statusCode: response.status
                        };
                    }
                }
                catch (error) {
                    return {
                        success: false,
                        error: error.message || 'Connection failed'
                    };
                }
            });
        }
        /**
         * Register callback for settings changes
         */
        onSettingsChange(callback) {
            this.settingsChangeCallbacks.push(callback);
        }
        /**
         * Notify all callbacks of settings change
         */
        notifySettingsChange(settings) {
            this.settingsChangeCallbacks.forEach(callback => {
                try {
                    callback(settings);
                }
                catch (e) {
                    this.log('Settings change callback error:', e);
                }
            });
        }
        /**
         * Send message to plugin
         */
        sendToPlugin(payload) {
            var _a;
            this.send({
                action: (_a = this.actionInfo) === null || _a === void 0 ? void 0 : _a.action,
                event: 'sendToPlugin',
                context: this.uuid,
                payload
            });
        }
        /**
         * Get action info
         */
        getActionInfo() {
            return this.actionInfo;
        }
        /**
         * Get UUID
         */
        getUUID() {
            return this.uuid;
        }
        /**
         * Log message if debug enabled
         */
        log(...args) {
            if (this.options.debug) {
                console.log('[PI]', ...args);
            }
        }
        /**
         * Bind input element to setting
         */
        bindInput(element, settingKey, transformer) {
            // Set initial value
            const initialValue = this.settings[settingKey];
            if (initialValue !== undefined) {
                if (element instanceof HTMLInputElement && element.type === 'checkbox') {
                    element.checked = !!initialValue;
                }
                else {
                    element.value = String(initialValue);
                }
            }
            // Listen for changes
            element.addEventListener('input', () => {
                let value;
                if (element instanceof HTMLInputElement) {
                    if (element.type === 'checkbox') {
                        value = element.checked;
                    }
                    else if (element.type === 'number') {
                        value = element.valueAsNumber;
                    }
                    else {
                        value = element.value;
                    }
                }
                else {
                    value = element.value;
                }
                // Apply transformer if provided
                if (transformer) {
                    value = transformer(value);
                }
                this.updateSetting(settingKey, value);
            });
        }
        /**
         * Bind all inputs with data-setting attribute
         */
        bindAllInputs() {
            const inputs = document.querySelectorAll('[data-setting]');
            inputs.forEach(input => {
                const settingKey = input.getAttribute('data-setting');
                if (settingKey) {
                    this.bindInput(input, settingKey);
                }
            });
        }
    }
    /**
     * Export a function to set up the global connection handler
     */
    function setupPropertyInspector(piInstance) {
        window.pi = piInstance;
        window.connectElgatoStreamDeckSocket = (port, uuid, registerEvent, info, actionInfo) => {
            piInstance.connect(port, uuid, registerEvent, info, actionInfo);
        };
    }

    exports.PropertyInspector = PropertyInspector;
    exports.setupPropertyInspector = setupPropertyInspector;

    return exports;

})({});
