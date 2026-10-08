const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'watermark-config.json');

const DEFAULT_CONFIG = {
  watermarkType: 'text',
  watermarkText: '© BmScriptsBox',
  fontFamily: 'Arial',
  fontSize: 48,
  textColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  watermarkImagePath: '',
  watermarkScale: 20,
  opacity: 0.7,
  rotation: 0,
  position: 'c',
  tileMode: false,
  outputPath: '',
  suffix: '_watermarked',
};

function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ ...DEFAULT_CONFIG, ...config }, null, 2), 'utf8');
  } catch {}
}

module.exports = { CONFIG_PATH, DEFAULT_CONFIG, loadConfig, saveConfig };
