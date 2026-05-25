export const mobileShell = {
    screenPadding: 'px-4',
    sectionGap: 'space-y-6',
    contentBottomPadding: 'pb-[calc(8.5rem+env(safe-area-inset-bottom))]',
    touchTarget: 'min-h-11',
};

export const card = {
    base: 'rounded-lg border border-zinc-200 bg-white',
    interactive: 'rounded-lg border border-zinc-200 bg-white transition-colors active:bg-zinc-50',
};

export const button = {
    primary: 'min-h-11 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors active:bg-emerald-800 disabled:bg-zinc-300',
    secondary: 'min-h-11 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors active:bg-zinc-50',
};
