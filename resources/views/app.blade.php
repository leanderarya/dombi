<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no">
        <meta name="theme-color" content="#047857">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="Dombi">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        @if(config('services.vapid.public_key'))
        <meta name="vapid-public-key" content="{{ config('services.vapid.public_key') }}">
        @endif

        <link rel="icon" href="/icons/icon-192.png" type="image/png" sizes="192x192">
        <link rel="apple-touch-icon" href="/icons/icon-192.png" sizes="192x192">
        <link rel="manifest" href="/manifest.json">

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])

        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
