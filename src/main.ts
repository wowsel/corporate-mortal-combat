import manifestJson from '../assets/manifest.json';
import { createAssetStore } from './assets';
import { createAudio } from './audio';
import { CONTENT } from './content';
import { validateContent } from './content/schema';
import { createEngine } from './engine';
import { createBattleScreen } from './screens/battle';
import { createEndingScreen } from './screens/ending';
import { createEventScreen } from './screens/event';
import { createStartScreen } from './screens/start';
import type { Manifest } from './types';
import './styles/base.css';
import './styles/hud.css';
import './styles/screens.css';
import './styles/battle.css';

const root = document.getElementById('app')!;
const manifest = manifestJson as Manifest;
const errors = validateContent(CONTENT.ranks, manifest);
if (errors.length) {
  root.innerHTML = `<pre style="padding:24px;color:#e66">Ошибки контента:\n${errors.join('\n')}</pre>`;
} else {
  const assets = createAssetStore(manifest);
  const audio = createAudio(assets);
  const engine = createEngine({
    root, content: CONTENT, assets, audio,
    screens: { start: createStartScreen, event: createEventScreen, battle: createBattleScreen, ending: createEndingScreen },
  });
  engine.go('start');
}
