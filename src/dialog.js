const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function runPs(script) {
  return new Promise((resolve) => {
    const tmp = path.join(os.tmpdir(), `wm-dlg-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
    try {
      fs.writeFileSync(tmp, '\ufeff' + script, 'utf8');
    } catch {
      resolve('');
      return;
    }
    const child = spawn(
      'powershell',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', tmp],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
    );
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString('utf8'); });
    const done = () => {
      try { fs.unlinkSync(tmp); } catch {}
      resolve(out);
    };
    child.on('error', done);
    child.on('close', done);
  });
}

const OWNER = `
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
`;

const IMAGE_FILTER = '图片文件|*.png;*.jpg;*.jpeg;*.gif;*.bmp;*.webp|所有文件|*.*';

async function pickImages() {
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${OWNER}
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Multiselect = $true
$d.Filter = "${IMAGE_FILTER}"
$d.Title = "选择图片"
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write(($d.FileNames -join "\`n"))
}
$owner.Dispose()
`;
  const out = await runPs(script);
  return out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

async function pickWatermarkImage() {
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${OWNER}
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Multiselect = $false
$d.Filter = "${IMAGE_FILTER}"
$d.Title = "选择水印图片"
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($d.FileName)
}
$owner.Dispose()
`;
  const out = await runPs(script);
  return out.trim();
}

async function pickOutputDir() {
  const script = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
${OWNER}
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = "选择输出目录"
$d.ShowNewFolderButton = $true
if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($d.SelectedPath)
}
$owner.Dispose()
`;
  const out = await runPs(script);
  return out.trim();
}

module.exports = { pickImages, pickWatermarkImage, pickOutputDir };
