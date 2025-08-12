# DroidCam Stream Deck Plugin

> ⚠️ **UNOFFICIAL PLUGIN**  
> This is an unofficial plugin and is **NOT affiliated** with Dev47Apps (makers of DroidCam).  
> DroidCam is a trademark of Dev47Apps.

Control [DroidCam](https://www.dev47apps.com/) from your Stream Deck

<div align="center">
  <img src="docs/images/banner.png" alt="DroidCam Stream Deck Plugin" width="600">
</div>

## 🌟 Features

### 📱 Connection Management
- **Connection Status Monitor** - Real-time display of DroidCam connection status
- **Battery Status** - Monitor device battery level and charging status

### 📸 Basic Camera Control
- **Camera Switch** - One-touch switching between front/back cameras
- **LED Flash** - ON/OFF control of LED light
- **Microphone Control** - Mute/unmute microphone

### 🎯 Focus Control
- **Autofocus** - AF trigger button
- **Focus Mode** - Switch between Normal/Macro/Continuous/Infinity modes

### 🎨 White Balance Control
- **WB Mode** - 9 presets (Auto/Incandescent/Fluorescent/etc.)
- **Manual WB Adjustment** - Fine adjustment in 0-100 range
- **WB Lock** - Lock/unlock white balance

### 📊 Exposure & Zoom Control
- **Zoom Control** - Stepless adjustment from 1.0x to 8.0x with dial operation
- **Exposure Compensation** - Fine adjustment from -2.0 to +2.0 EV with dial operation
- **Preset Buttons** - One-touch switching of frequently used zoom/exposure values
- **Exposure Lock** - Lock/unlock exposure

### ⚙️ System Control
- **Stop/Restart** - Stop and restart DroidCam application

## 🚀 Installation

### Requirements
- Stream Deck 6.6 or later
- macOS 10.15 or later, or Windows 10 or later
- Bun 1.0 or later (development only)
- DroidCam (smartphone app)
- DroidCam Pro version (for zoom/exposure control features)

### Installation Steps

1. Download the latest version from [Releases page](https://github.com/nantokaworks/streamdeck-droidcam/releases)
2. Double-click the `works.nantoka.droidcam.streamDeckPlugin` file
3. It will be automatically installed in Stream Deck software

## 📖 Usage

### Initial Setup

1. Launch DroidCam app on your smartphone
2. For Wi-Fi connection, note down the displayed IP address
3. Add "Connection Status" action in Stream Deck
4. Set IP address and port (usually 4747) in Property Inspector
5. Test connection with "Test Connection" button

### Example Action Layout

```
[Connection] [Battery]  [Stop/Start]
[Camera SW]  [LED]      [Mic]
[AF Trigger] [AF Mode]  [WB Mode]
[Zoom 🎛]    [Exposure🎛] [Exp Lock]
```

### Using with Stream Deck+

Encoder (dial) compatible actions:
- **Zoom Control** - Rotate for zoom adjustment, press to reset to 1.0x
- **Exposure Control** - Rotate for exposure compensation, press to reset to ±0

## 🌍 Internationalization

This plugin supports both Japanese and English. It automatically switches according to your Stream Deck system language settings.

Supported languages:
- 🇺🇸 English (en)
- 🇯🇵 Japanese (ja)

## 🛠 Development

### Build Instructions

```bash
# Install dependencies
bun install

# Build
bun run build

# Start development mode
./start-dev.sh

# Monitor logs
./watch-log.sh
```

### Project Structure

```
streamdeck-droidcam/
├── src/
│   ├── plugin.ts           # Main entry point
│   ├── actions/            # Action implementations
│   └── services/           # API communication services
├── works.nantoka.droidcam.sdPlugin/
│   ├── manifest.json       # Plugin definition
│   ├── ja.json            # Japanese translations
│   ├── en.json            # English translations
│   ├── icons/             # Icon files
│   ├── ui/                # Property Inspector
│   └── bin/plugin.js      # Built JavaScript file
└── docs/                  # Documentation
```

## 📝 Documentation

- [Stream Deck Development Guide](docs/STREAM_DECK_DEVELOPMENT.md) - Technical implementation patterns and best practices
- [Migration Guide](docs/MIGRATION_GUIDE.md) - Step-by-step migration from hello-world template
- [DroidCam API Reference](docs/DROIDCAM_API_REFERENCE.md) - API specifications and endpoint corrections
- [Coding Standards](docs/CODING_STANDARDS.md) - Stream Deck plugin-specific coding conventions
- [API Specification](docs/API.md) - Plugin API specification
- [User Guide](docs/USER_GUIDE.md) - Detailed usage guide
- [Debugging Guide](docs/DEBUGGING.md) - Debugging methods

## 🤝 Contributing

Please submit bug reports and feature requests to [Issues](https://github.com/nantokaworks/streamdeck-droidcam/issues).

### Development Guidelines

1. Follow the [Coding Standards](docs/CODING_STANDARDS.md)
2. Refer to [Stream Deck Development Guide](docs/STREAM_DECK_DEVELOPMENT.md) for implementation patterns
3. Use the [Migration Guide](docs/MIGRATION_GUIDE.md) for adding new actions
4. Update [API Reference](docs/DROIDCAM_API_REFERENCE.md) when discovering endpoint changes

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [DroidCam](https://www.dev47apps.com/) - For providing an excellent webcam application
- [Elgato Stream Deck SDK](https://docs.elgato.com/streamdeck) - For development tools and documentation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/nantokaworks/streamdeck-droidcam/issues)

## ⚠️ Disclaimer

**This plugin is unofficial**

- This plugin is **NOT affiliated** with Dev47Apps (creators of DroidCam)
- It is not approved or supported by Dev47Apps
- "DroidCam" is a trademark of Dev47Apps
- The author is not responsible for any issues arising from the use of this plugin

**For DroidCam app support**, please contact [Dev47Apps](https://www.dev47apps.com/)

**Important**: If DroidCam's API changes, this plugin may stop working

---

Made with ❤️ by nantokaworks