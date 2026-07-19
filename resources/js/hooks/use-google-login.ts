import { router } from '@inertiajs/react';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';

const WEB_CLIENT_ID =
    '732242789854-7kvv13nq10hnkovq9j0ji9nrbmdku3oh.apps.googleusercontent.com';

export function useGoogleLogin() {
    const isNative = Capacitor.isNativePlatform();

    const login = async () => {
        if (isNative) {
            try {
                await GoogleSignIn.initialize({ clientId: WEB_CLIENT_ID });
                const result = await GoogleSignIn.signIn();

                if (!result.idToken) {
                    alert('Login gagal: tidak mendapat token dari Google.');
                    return;
                }

                const res = await fetch('/api/auth/google-token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ id_token: result.idToken }),
                });

                const text = await res.text();
                let data: any;

                try {
                    data = JSON.parse(text);
                } catch {
                    alert('Login gagal: response bukan JSON.\n' + text.substring(0, 200));
                    return;
                }

                if (data.success) {
                    router.visit(data.redirect || '/customer/home');
                } else {
                    alert(
                        'Login gagal: ' +
                            (data.error || JSON.stringify(data)),
                    );
                }
            } catch (err: any) {
                console.error('Google Sign-In error:', err);
                alert('Login gagal: ' + (err?.message || JSON.stringify(err)));
            }
        } else {
            window.location.href = '/oauth/google';
        }
    };

    return { login, isNative };
}
