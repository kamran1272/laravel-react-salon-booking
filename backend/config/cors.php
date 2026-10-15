<?php

$frontendUrl = env('FRONTEND_URL', 'http://localhost:5173');

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_unique(array_filter([
        $frontendUrl,
        // Browsers send only scheme + host as the Origin header, so also
        // allow the bare origin when the frontend lives under a sub-path
        // (e.g. https://user.github.io/my-app).
        preg_replace('#^([a-z]+://[^/]+).*$#i', '$1', $frontendUrl),
    ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
