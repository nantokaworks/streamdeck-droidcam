var PIComponents = (function (exports) {
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
     * Property Inspector UI Components
     * Reusable UI components for Stream Deck Property Inspector
     */
    /**
     * UI Component builder class
     */
    class PIComponents {
        /**
         * Create connection settings section (IP and Port inputs)
         */
        static createConnectionSettings(options = {}) {
            const container = document.createElement('div');
            container.className = 'connection-settings ' + (options.className || '');
            // IP Address field
            const ipField = this.createField({
                label: 'IP Address / Hostname',
                type: 'text',
                id: 'ipAddress',
                placeholder: 'e.g., 192.168.1.100',
                dataSetting: 'ipAddress',
                i18nLabel: 'settings.url',
                i18nPlaceholder: 'placeholder.url'
            });
            // Port field
            const portField = this.createField({
                label: 'Port',
                type: 'number',
                id: 'port',
                value: '4747',
                min: 1,
                max: 65535,
                dataSetting: 'port',
                i18nLabel: 'settings.port',
                i18nPlaceholder: 'placeholder.port'
            });
            container.appendChild(ipField);
            container.appendChild(portField);
            return container;
        }
        /**
         * Create test connection button with result display
         */
        static createTestConnectionButton(onTest) {
            const container = document.createElement('div');
            container.className = 'sdpi-item';
            container.style.alignItems = 'center';
            // Button
            const button = document.createElement('button');
            button.id = 'test-connection';
            button.textContent = 'Test Connection';
            button.setAttribute('data-i18n', 'button.test');
            button.style.cssText = 'flex: 0 0 auto; margin-right: 8px; align-self: center;';
            // Result display
            const resultSpan = document.createElement('span');
            resultSpan.id = 'test-result';
            resultSpan.style.cssText = 'display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 9pt; line-height: 1; vertical-align: middle;';
            // Button click handler
            if (onTest) {
                button.addEventListener('click', () => __awaiter(this, void 0, void 0, function* () {
                    this.showTestResult(resultSpan, 'testing');
                    try {
                        const result = yield onTest();
                        if (result.success) {
                            this.showTestResult(resultSpan, 'success', result.deviceName ? `Connected: ${result.deviceName}` : 'Connected successfully!');
                        }
                        else {
                            this.showTestResult(resultSpan, 'error', result.error || 'Connection failed');
                        }
                    }
                    catch (error) {
                        this.showTestResult(resultSpan, 'error', error.message || 'Test failed');
                    }
                }));
            }
            container.appendChild(button);
            container.appendChild(resultSpan);
            return container;
        }
        /**
         * Create a field with label and input
         */
        static createField(options) {
            const container = document.createElement('div');
            container.className = 'sdpi-item';
            // Label
            const label = document.createElement('div');
            label.className = 'sdpi-item-label';
            label.textContent = options.label;
            if (options.i18nLabel) {
                label.setAttribute('data-i18n', options.i18nLabel);
            }
            // Input
            const input = document.createElement('input');
            input.className = 'sdpi-item-value';
            input.type = options.type;
            input.id = options.id;
            if (options.value !== undefined) {
                input.value = options.value;
            }
            if (options.placeholder) {
                input.placeholder = options.placeholder;
            }
            if (options.i18nPlaceholder) {
                input.setAttribute('data-i18n-placeholder', options.i18nPlaceholder);
            }
            if (options.min !== undefined) {
                input.min = String(options.min);
            }
            if (options.max !== undefined) {
                input.max = String(options.max);
            }
            if (options.step !== undefined) {
                input.step = String(options.step);
            }
            if (options.dataSetting) {
                input.setAttribute('data-setting', options.dataSetting);
            }
            container.appendChild(label);
            container.appendChild(input);
            // Help text if provided
            if (options.help || options.i18nHelp) {
                const small = document.createElement('small');
                small.textContent = options.help || '';
                if (options.i18nHelp) {
                    small.setAttribute('data-i18n', options.i18nHelp);
                }
                container.appendChild(small);
            }
            return container;
        }
        /**
         * Create a select dropdown
         */
        static createSelect(options) {
            const container = document.createElement('div');
            container.className = 'sdpi-item';
            // Label
            const label = document.createElement('div');
            label.className = 'sdpi-item-label';
            label.textContent = options.label;
            if (options.i18nLabel) {
                label.setAttribute('data-i18n', options.i18nLabel);
            }
            // Select
            const select = document.createElement('select');
            select.className = 'sdpi-item-value';
            select.id = options.id;
            if (options.dataSetting) {
                select.setAttribute('data-setting', options.dataSetting);
            }
            // Options
            options.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                if (opt.i18n) {
                    option.setAttribute('data-i18n', opt.i18n);
                }
                if (options.value === opt.value) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            container.appendChild(label);
            container.appendChild(select);
            return container;
        }
        /**
         * Create a checkbox
         */
        static createCheckbox(options) {
            const container = document.createElement('div');
            container.className = 'sdpi-item';
            // Checkbox
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = options.id;
            checkbox.className = 'sdpi-item-value';
            if (options.checked) {
                checkbox.checked = true;
            }
            if (options.dataSetting) {
                checkbox.setAttribute('data-setting', options.dataSetting);
            }
            // Label
            const label = document.createElement('label');
            label.htmlFor = options.id;
            label.className = 'sdpi-item-label';
            label.textContent = options.label;
            if (options.i18nLabel) {
                label.setAttribute('data-i18n', options.i18nLabel);
            }
            container.appendChild(checkbox);
            container.appendChild(label);
            return container;
        }
        /**
         * Create a warning message
         */
        static createWarning(message, i18nKey) {
            const warning = document.createElement('div');
            warning.className = 'sdpi-item';
            const text = document.createElement('div');
            text.style.cssText = 'color: #dc3545; font-weight: bold; font-size: 10pt; margin-bottom: 8px; text-align: center;';
            text.textContent = message;
            if (i18nKey) {
                text.setAttribute('data-i18n', i18nKey);
            }
            warning.appendChild(text);
            return warning;
        }
        /**
         * Show test result in the result element
         */
        static showTestResult(element, status, message) {
            switch (status) {
                case 'testing':
                    element.textContent = message || 'Testing connection...';
                    element.style.backgroundColor = '#17a2b8';
                    element.style.color = '#ffffff';
                    element.style.display = 'inline-block';
                    break;
                case 'success':
                    element.textContent = message || 'Connected successfully!';
                    element.style.backgroundColor = '#28a745';
                    element.style.color = '#ffffff';
                    element.style.display = 'inline-block';
                    break;
                case 'error':
                    element.textContent = message || 'Connection failed';
                    element.style.backgroundColor = '#dc3545';
                    element.style.color = '#ffffff';
                    element.style.display = 'inline-block';
                    break;
            }
        }
        /**
         * Create a section divider
         */
        static createDivider(title, i18nKey) {
            const divider = document.createElement('div');
            divider.className = 'sdpi-heading';
            if (title) {
                divider.textContent = title;
                if (i18nKey) {
                    divider.setAttribute('data-i18n', i18nKey);
                }
            }
            else {
                const hr = document.createElement('hr');
                divider.appendChild(hr);
            }
            return divider;
        }
        /**
         * Create a textarea
         */
        static createTextarea(options) {
            const container = document.createElement('div');
            container.className = 'sdpi-item';
            // Label
            const label = document.createElement('div');
            label.className = 'sdpi-item-label';
            label.textContent = options.label;
            if (options.i18nLabel) {
                label.setAttribute('data-i18n', options.i18nLabel);
            }
            // Textarea
            const textarea = document.createElement('textarea');
            textarea.className = 'sdpi-item-value';
            textarea.id = options.id;
            textarea.rows = options.rows || 3;
            if (options.value) {
                textarea.value = options.value;
            }
            if (options.placeholder) {
                textarea.placeholder = options.placeholder;
            }
            if (options.i18nPlaceholder) {
                textarea.setAttribute('data-i18n-placeholder', options.i18nPlaceholder);
            }
            if (options.dataSetting) {
                textarea.setAttribute('data-setting', options.dataSetting);
            }
            container.appendChild(label);
            container.appendChild(textarea);
            return container;
        }
        /**
         * Initialize i18n for all elements
         * This should be called after i18n.js is loaded
         */
        static initializeI18n() {
            if (typeof window !== 'undefined' && window.i18n) {
                window.i18n.init();
            }
        }
    }

    exports.PIComponents = PIComponents;

    return exports;

})({});
