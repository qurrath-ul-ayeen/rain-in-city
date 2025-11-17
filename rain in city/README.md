# Rain in City — Demo

This is a small demo that renders a rainy city scene using HTML, CSS, JavaScript (canvas) and a tiny PHP front controller for configuration.

Files added
- `index.php` — main entry (outputs SERVER_CONFIG such as `rainIntensity` and `isNight`).
- `assets/css/styles.css` — styles and basic UI.
- `assets/js/app.js` — canvas rendering and animations (buildings, trees, road, cars, rain).

How to run

1. Using XAMPP (recommended for Windows):
   - Place this project folder in `htdocs` (already set if you opened workspace in XAMPP path).
   - Start Apache via XAMPP Control Panel.
   - Open http://localhost/rain%20in%20city/index.php in your browser (note: space in folder name is URL-encoded as `%20`).

2. Using PHP built-in server (quick test):
   - Open a terminal in this project folder and run:

```powershell
php -S localhost:8080
```

   - Then open http://localhost:8080/index.php

Controls
- Use the slider to change rain intensity.
- Toggle night/day to see different color themes.
- Sound toggle: enable/disable ambient rain and car whoosh.
- Use `?intensity=NUMBER` in the URL to set starting intensity from server-side, e.g. `?intensity=400`.

New features added in this version
- Parallax building layers with offscreen caching for better performance.
- Some buildings use stylized SVG-like facades for variety.
- Wet-road reflections and subtle window glow at night.
- More vehicle types (compact, truck) and a simple car whoosh sound.
- Rain ambient sound (toggleable).

Removed/changed per request
- Wet-road reflection removed (disabled) to reduce visual glare and improve performance.
- Building window brightness reduced for less glare in night scenes.

Controls (updated)
- Performance select: choose `Detailed` (default) or `Fast` to reduce raindrops and disable some visual effects for lower-end devices.

Next steps / improvements
- Add higher-quality SVG or PNG assets for buildings and trees.
- Add more car models, traffic logic and signals for realism.
- Optimize caching and draw fewer raindrops on low-end devices (adaptive LOD).
- Add a server-driven weather endpoint to fetch live weather and drive intensity automatically.
