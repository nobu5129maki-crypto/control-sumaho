<?php
require __DIR__ . '/auth.php';

function sumaho_deny()
{
    http_response_code(401);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "ログインが必要です\n";
    exit;
}

function sumaho_forbidden()
{
    http_response_code(403);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "Forbidden\n";
    exit;
}

function sumaho_miss()
{
    http_response_code(404);
    header('Content-Type: text/plain; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo "見つかりません\n";
    exit;
}

function sumaho_content_type($path)
{
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $map = array(
        'html' => 'text/html; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'js' => 'application/javascript; charset=UTF-8',
        'mjs' => 'application/javascript; charset=UTF-8',
        'json' => 'application/json; charset=UTF-8',
        'webmanifest' => 'application/manifest+json; charset=UTF-8',
        'txt' => 'text/plain; charset=UTF-8',
        'svg' => 'image/svg+xml',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'ico' => 'image/x-icon',
        'xml' => 'application/xml; charset=UTF-8',
        'map' => 'application/json; charset=UTF-8',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
    );
    if (isset($map[$ext])) {
        return $map[$ext];
    }
    return 'application/octet-stream';
}

function sumaho_normalize($relative)
{
    $relative = str_replace('\\', '/', (string) $relative);
    $relative = rawurldecode($relative);
    if ($relative === '' || strpos($relative, "\0") !== false) {
        return '';
    }
    $parts = explode('/', $relative);
    $safe = array();
    foreach ($parts as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..') {
            return '';
        }
        $safe[] = $part;
    }
    return implode('/', $safe);
}

function sumaho_is_install_file($relative)
{
    $relative = sumaho_normalize($relative);
    $allowed = array(
        'manifest.webmanifest' => true,
        'sw.js' => true,
        'assets/icon-192.png' => true,
        'assets/icon-512.png' => true,
        'assets/icon-maskable-192.png' => true,
        'assets/icon-maskable-512.png' => true,
    );
    return isset($allowed[$relative]);
}

function sumaho_requested_path()
{
    if (isset($_GET['mw_path'])) {
        return (string) $_GET['mw_path'];
    }
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    $path = parse_url($uri, PHP_URL_PATH);
    $path = rawurldecode(is_string($path) ? $path : '');
    $base = sumaho_cookie_path();
    if ($base !== '/' && strpos($path, $base) === 0) {
        $path = substr($path, strlen($base));
    }
    return ltrim($path, '/');
}

function sumaho_resolve($relative)
{
    $relative = sumaho_normalize($relative);
    if ($relative === '') {
        return '';
    }
    $parts = explode('/', $relative);
    foreach ($parts as $part) {
        if ($part[0] === '.') {
            return '';
        }
    }
    if (preg_match('/\.php$/i', $relative)) {
        return '';
    }
    if ($relative === 'index.html') {
        return '';
    }

    $root = realpath(__DIR__);
    if ($root === false) {
        return '';
    }
    $candidate = $root . '/' . $relative;
    if (is_dir($candidate)) {
        $candidate = rtrim($candidate, '/') . '/index.html';
    } elseif (!is_file($candidate)) {
        $asDir = $root . '/' . $relative . '/index.html';
        $asHtml = $root . '/' . $relative . '.html';
        if (is_file($asDir)) {
            $candidate = $asDir;
        } elseif (is_file($asHtml)) {
            $candidate = $asHtml;
        }
    }
    $real = realpath($candidate);
    if ($real === false || !is_file($real)) {
        return '';
    }
    $prefix = rtrim($root, '/') . '/';
    if (strpos($real, $prefix) !== 0) {
        return '';
    }
    if (substr($real, -4) === '.php') {
        return '';
    }
    if (substr($real, -10) === 'index.html') {
        return '';
    }
    return $real;
}

$requested = sumaho_normalize(sumaho_requested_path());
if ($requested === 'index.html' || $requested === 'auth.php') {
    sumaho_forbidden();
}

$publicInstall = sumaho_is_install_file($requested);

if (!$publicInstall && !sumaho_logged_in()) {
    sumaho_deny();
}

$file = sumaho_resolve($requested);
if ($file === '') {
    sumaho_miss();
}
if ($publicInstall) {
    $root = realpath(__DIR__);
    $prefix = $root === false ? '' : rtrim($root, '/') . '/';
    $suffix = $prefix !== '' && strpos($file, $prefix) === 0 ? substr($file, strlen($prefix)) : '';
    if (!sumaho_is_install_file($suffix)) {
        sumaho_miss();
    }
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
header('Content-Type: ' . sumaho_content_type($file));
header('X-Content-Type-Options: nosniff');
if ($publicInstall && $ext === 'js') {
    header('Cache-Control: no-cache');
} elseif ($publicInstall) {
    header('Cache-Control: public, max-age=3600');
} elseif ($ext === 'html') {
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
} else {
    header('Cache-Control: private, no-cache');
}
readfile($file);
