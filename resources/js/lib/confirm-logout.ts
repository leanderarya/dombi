import { router } from '@inertiajs/react';
import Swal from 'sweetalert2';

/**
 * Shared logout confirmation modal.
 * Used by both Owner and Customer pages.
 * Styled to match Dombi operational design system.
 */
export function confirmLogout(): void {
    Swal.fire({
        title: 'Keluar dari akun?',
        text: 'Sesi Anda akan diakhiri dan perlu login kembali untuk mengakses aplikasi.',
        icon: undefined,
        showCancelButton: true,
        confirmButtonText: 'Keluar',
        cancelButtonText: 'Batal',
        reverseButtons: true,
        customClass: {
            popup: 'dombi-swal-popup',
            title: 'dombi-swal-title',
            htmlContainer: 'dombi-swal-text',
            confirmButton: 'dombi-swal-confirm',
            cancelButton: 'dombi-swal-cancel',
            actions: 'dombi-swal-actions',
        },
        buttonsStyling: false,
        showClass: { popup: 'animate-[fadeIn_150ms_ease-out]' },
        hideClass: { popup: 'animate-[fadeOut_100ms_ease-in]' },
    }).then((result) => {
        if (result.isConfirmed) {
            router.post('/logout');
        }
    });
}
