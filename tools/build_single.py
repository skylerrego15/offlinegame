# Builds DrownedClutch.html: the entire game (code, styles, art) in one offline file.
import os, base64, json, shutil, subprocess, tempfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp()
src = os.path.join(tmp, 'js')
shutil.copytree(os.path.join(root, 'js'), src)
assets = {}
for d in ['assets/creatures', 'assets/eggs']:
    for f in sorted(os.listdir(os.path.join(root, d))):
        assets[d + '/' + f] = 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(root, d, f), 'rb').read()).decode()
p = os.path.join(src, 'assets.js'); s = open(p).read()
s = s.replace("im.src = src;", "im.src = (window.__ASSETS && window.__ASSETS[src]) || src;")
s = s.replace("if (!mut || mut === 'normal') return `assets/creatures/${id}.webp`;", "if (!mut || mut === 'normal') return (window.__ASSETS || {})[`assets/creatures/${id}.webp`] || `assets/creatures/${id}.webp`;")
s = s.replace("export const eggURL = (tier) => `assets/eggs/egg${tier}.webp`;", "export const eggURL = (tier) => (window.__ASSETS || {})[`assets/eggs/egg${tier}.webp`] || `assets/eggs/egg${tier}.webp`;")
s = s.replace("let url = `assets/creatures/${id}.webp`;", "let url = creatureURL(id);")
open(p, 'w').write(s)
p = os.path.join(src, 'main.js'); s = open(p).read()
s = s.replace("if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {", "if (false) {")
open(p, 'w').write(s)
subprocess.run(['npx', '-y', 'esbuild@0.24.0', os.path.join(src, 'main.js'), '--bundle', '--format=iife', '--minify', '--outfile=' + os.path.join(tmp, 'bundle.js')], check=True)
h = open(os.path.join(root, 'index.html')).read()
h = h.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + open(os.path.join(root, 'css/style.css')).read() + '</style>')
for t in ['<link rel="manifest" href="manifest.webmanifest">', '<link rel="apple-touch-icon" href="assets/icons/icon180.png">', '<link rel="icon" href="assets/icons/icon192.png">']:
    h = h.replace(t, '')
h = h.replace('<script type="module" src="js/main.js"></script>', '<script>window.__ASSETS=' + json.dumps(assets) + ';</script><script>' + open(os.path.join(tmp, 'bundle.js')).read() + '</script>')
open(os.path.join(root, 'DrownedClutch.html'), 'w').write(h)
shutil.rmtree(tmp)
print('DrownedClutch.html', os.path.getsize(os.path.join(root, 'DrownedClutch.html')) // 1024, 'KB')
