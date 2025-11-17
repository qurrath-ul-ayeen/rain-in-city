<?php
// Simple PHP front controller for the Rain-in-City demo
// You can pass ?intensity=NUMBER to change number of raindrops
$rainIntensity = isset($_GET['intensity']) ? (int)$_GET['intensity'] : 220;
$time = date('H');
$isNight = ($time < 6 || $time >= 18) ? 1 : 0;
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Rain in City — Demo</title>
  <link rel="stylesheet" href="assets/css/styles.css">
  <script>
    // Server-provided configuration
    const SERVER_CONFIG = {
      rainIntensity: <?= $rainIntensity ?>,
      isNight: <?= $isNight ?>
    };
  </script>
</head>
<body>
  <div id="ui">
    <h1>Rain in City</h1>
    <div class="controls">
      <label>Rain intensity <input id="intensity" type="range" min="20" max="1000" step="10"></label>
      <label>Night <input id="toggleNight" type="checkbox"></label>
      <label>Sound <input id="toggleSound" type="checkbox"></label>
      <label>Performance <select id="perfMode"><option value="detailed">Detailed</option><option value="fast">Fast</option></select></label>
      <button id="reset">Reset</button>
    </div>
    <p class="hint">Tip: open developer console to see debug info. Use ?intensity=NUM in URL to set initial intensity.</p>
  </div>

  <canvas id="scene"></canvas>

  <script src="assets/js/app.js"></script>
</body>
</html>
