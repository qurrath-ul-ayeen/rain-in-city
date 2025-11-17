<?php
// Simple mock weather endpoint. Returns JSON with intensity and isNight.
$time = (int)date('H');
$isNight = ($time < 6 || $time >= 18) ? 1 : 0;
// intensity based on time of day for demo: higher in evening
$intensity = $isNight ? 320 : 180;
header('Content-Type: application/json');
echo json_encode(['intensity' => $intensity, 'isNight' => $isNight]);
