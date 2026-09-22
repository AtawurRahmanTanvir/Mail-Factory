/* Visual validation: pixel-compare MAIL_FACTORY/index.html against the
 * original monolith on every screen that must be visually identical.
 * Library is compared structurally (empty vs demo-by-design). */
const env = require('./helpers/env');
const { chromium } = env;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const os = require('os');
const OUT = process.env.MF_VISUAL_OUT || path.join(os.tmpdir(), 'mf-visual');
fs.mkdirSync(OUT, { recursive: true });

const SHOTS = [
  ['dashboard', () => {}],
  ['engine', 'showScreen("engine")'],
  ['generator', 'showScreen("generator")'],
  ['generator-batch', 'showScreen("generator");document.querySelector(\'.tab[data-tab="batch"]\').click()'],
  ['settings', 'showScreen("settings")'],
  ['appearance', 'showScreen("settings");openSettingsSubpage("appearance")'],
  ['language', 'showScreen("settings");openSettingsSubpage("language")'],
  ['about', 'showScreen("settings");openSettingsSubpage("aboutmailfactory")'],
  ['version', 'showScreen("settings");openSettingsSubpage("version")'],
  ['backup', 'showScreen("settings");openBackupScreen()'],
  ['helpcenter', 'showScreen("help")'],
  ['onetouch', 'showScreen("onetouch")'],
  ['logengine', 'showScreen("engine");openEngineSubpage("logengine")'],
  ['systemsettings', 'showScreen("engine");openEngineSubpage("systemsettings")'],
  ['checkroute', 'showScreen("engine");openEngineSubpage("checkroute")'],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: env.executablePath(),
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--font-render-hinting=none']
  });

  async function shoot(file, tag) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    await page.goto('file://' + file);
    await page.waitForTimeout(1200); // fonts + first paint
    for (const [name, action] of SHOTS) {
      const act = typeof action === 'string' ? action : '';
      await page.evaluate(act || action);
      await page.waitForTimeout(name === 'onetouch' ? 900 : 450);
      await page.screenshot({ path: `${OUT}/${tag}-${name}.png` });
    }
    await page.close();
  }

  await shoot(env.ORIG_SOURCE, 'orig');
  await shoot(path.join(env.PROJECT_ROOT, 'index.html'), 'mine');
  await browser.close();
  console.log('screenshots done');
})().catch(e => { console.error(e); process.exit(1); });
