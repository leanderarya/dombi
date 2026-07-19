import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: process.env.CAP_APP_ID || 'com.dombi.customer',
    appName: process.env.CAP_APP_NAME || 'Dombi',
    webDir: 'public/build',
    server: {
        url:
            (process.env.CAP_SERVER_URL || 'https://staging.dombicenter.com') +
            (process.env.CAP_START_PATH || ''),
        cleartext: false,
        androidScheme: 'https',
    },
    plugins: {
        Camera: {
            androidPermissions: ['android.permission.CAMERA'],
        },
        PushNotifications: {
            presentationOptions: ['badge', 'sound', 'alert'],
        },
        Geolocation: {
            androidPermissions: [
                'android.permission.ACCESS_COARSE_LOCATION',
                'android.permission.ACCESS_FINE_LOCATION',
            ],
        },
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#047857',
            showSpinner: false,
            androidSplashResourceName: 'splash',
            androidScaleType: 'CENTER_CROP',
        },
        StatusBar: {
            style: 'DARK',
            backgroundColor: '#047857',
        },
    },
    android: {
        allowMixedContent: false,
        backgroundColor: '#ffffff',
        buildOptions: {
            keystorePath: undefined,
            keystorePassword: undefined,
            keystoreAlias: undefined,
            keystoreAliasPassword: undefined,
            releaseType: 'APK',
        },
    },
};

export default config;
