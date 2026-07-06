const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
  PageBreak, convertInchesToTwip, LevelFormat, Header, Footer, PageNumber,
} = require("docx");

// ── Color palette ──────────────────────────────────────────────────────────
const FOREST = "137e5b";
const FOREST_DARK = "0f4d3a";
const IVORY = "faf7f2";
const INK = "181613";
const INK_500 = "6b655c";
const BORDER_COLOR = "e7e2d8";
const SURFACE = "fffdf9";

// ── Helpers ────────────────────────────────────────────────────────────────
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, color: FOREST_DARK })],
  });
}

function subheading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, color: FOREST })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22, color: opts.color || INK, ...opts })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22, color: INK })],
  });
}

function placeholderBox(label, width = 6, height = 2.5) {
  const heightTwip = convertInchesToTwip(height);
  const widthTwip = convertInchesToTwip(width);

  return new Table({
    width: { size: widthTwip, type: WidthType.DXA },
    rows: [
      new TableRow({
        height: { value: heightTwip, rule: "atLeast" },
        children: [
          new TableCell({
            width: { size: widthTwip, type: WidthType.DXA },
            verticalAlign: "center",
            shading: { type: ShadingType.CLEAR, fill: IVORY },
            borders: {
              top: { style: BorderStyle.DASHED, size: 1, color: BORDER_COLOR },
              bottom: { style: BorderStyle.DASHED, size: 1, color: BORDER_COLOR },
              left: { style: BorderStyle.DASHED, size: 1, color: BORDER_COLOR },
              right: { style: BorderStyle.DASHED, size: 1, color: BORDER_COLOR },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  new TextRun({ text: label, size: 20, color: INK_500, italics: true }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "(Masukkan screenshot di sini)", size: 18, color: INK_500, italics: true }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(height = 200) {
  return new Paragraph({ spacing: { after: height }, children: [] });
}

function specTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, i) =>
      new TableRow({
        children: row.map((cell, j) =>
          new TableCell({
            width: { size: j === 0 ? 30 : 70, type: WidthType.PERCENTAGE },
            shading: i === 0
              ? { type: ShadingType.CLEAR, fill: FOREST }
              : i % 2 === 0
                ? { type: ShadingType.CLEAR, fill: SURFACE }
                : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
              right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
            },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                indent: { left: 120 },
                children: [
                  new TextRun({
                    text: cell,
                    size: 20,
                    bold: i === 0 || j === 0,
                    color: i === 0 ? "ffffff" : j === 0 ? FOREST_DARK : INK,
                  }),
                ],
              }),
            ],
          })
        ),
      })
    ),
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR } },
    children: [],
  });
}

// ── Document ───────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { size: 22, font: "Calibri", color: INK },
        paragraph: { spacing: { line: 276 } },
      },
      heading1: {
        run: { size: 32, bold: true, font: "Calibri", color: FOREST_DARK },
        paragraph: { spacing: { before: 360, after: 200 } },
      },
      heading2: {
        run: { size: 26, bold: true, font: "Calibri", color: FOREST },
        paragraph: { spacing: { before: 280, after: 160 } },
      },
    },
  },
  sections: [
    // ── COVER PAGE ─────────────────────────────────────────────────────
    {
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) },
        },
      },
      children: [
        spacer(2400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: "DOMBI", size: 72, bold: true, color: FOREST, font: "Calibri" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "Susu Kambing Premium", size: 28, color: INK_500 })],
        }),
        spacer(600),
        divider(),
        spacer(200),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [new TextRun({ text: "PANDUAN ASSET", size: 44, bold: true, color: INK })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Persiapan Asset untuk Landing Page & CMS", size: 24, color: INK_500 })],
        }),
        spacer(400),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: "Versi 1.0 — Juli 2026", size: 22, color: INK_500 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Disiapkan untuk: Tim Dombi", size: 22, color: INK_500 })],
        }),
      ],
    },

    // ── MAIN CONTENT ───────────────────────────────────────────────────
    {
      properties: {
        page: {
          margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(1), left: convertInchesToTwip(1.2), right: convertInchesToTwip(1.2) },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "Dombi — Panduan Asset", size: 18, color: INK_500, italics: true }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Halaman ", size: 18, color: INK_500 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, color: INK_500 }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ── DAFTAR ISI ─────────────────────────────────────────────────
        heading("Daftar Isi"),
        body("1. Ikhtisar"),
        body("2. Spesifikasi Umum Asset"),
        body("3. Logo & Branding"),
        body("4. Hero / Banner Utama"),
        body("5. Foto Produk"),
        body("6. Foto Proses (Farm Story)"),
        body("7. Sertifikasi & Legalitas"),
        body("8. Halaman Tentang Kami"),
        body("9. Artikel / Blog"),
        body("10. Download App Banner"),
        body("11. Promo Popup"),
        body("12. Foto Testimoni Pelanggan"),
        body("13. Icon Kategori Produk"),
        body("14. Footer — Pengiriman & Pembayaran"),
        body("15. Checklist Pengiriman Asset"),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 1. IKHTISAR ───────────────────────────────────────────────
        heading("1. Ikhtisar"),
        body("Dokumen ini menjelaskan semua asset visual yang dibutuhkan untuk melengkapi landing page dan CMS Dombi. Setiap bagian mencakup:"),
        bullet("Deskripsi asset dan kegunaannya"),
        bullet("Spesifikasi teknis (format, ukuran, dimensi, resolusi)"),
        bullet("Contoh referensi gaya visual"),
        bullet("Placeholder untuk screenshot referensi"),
        spacer(100),
        body("Kirim semua asset melalui WhatsApp atau email ke tim pengembang. Pastikan file sesuai spesifikasi agar tidak perlu resize ulang.", { bold: true }),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 2. SPESIFIKASI UMUM ────────────────────────────────────────
        heading("2. Spesifikasi Umum Asset"),
        body("Berikut standar teknis yang berlaku untuk semua asset yang dikirimkan:"),
        spacer(100),
        specTable([
          ["Parameter", "Spesifikasi"],
          ["Format Foto", "JPG / JPEG (kualitas ≥ 80%) atau WebP"],
          ["Format Logo", "SVG (utama) + PNG (backup, transparan background)"],
          ["Format Ikon", "SVG atau PNG transparan"],
          ["Resolusi Minimum", "1920×1080px untuk banner, 800×800px untuk produk"],
          ["Resolusi Ideal", "2560×1440px untuk banner, 1200×1200px untuk produk"],
          ["Ukuran File Maks", "2MB per file (foto), 500KB per file (ikon/logo)"],
          ["Color Profile", "sRGB"],
          ["Naming", "nama-aset-ukuran.jpg (contoh: hero-banner-2560x1440.jpg)"],
          ["Watermark", "Tidak diperlukan — semua foto digunakan internal"],
        ]),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 3. LOGO & BRANDING ────────────────────────────────────────
        heading("3. Logo & Branding"),
        subheading("3.1 Logo Utama"),
        body("Logo utama Dombi digunakan di header navbar, footer, dan berbagai halaman. Diperlukan dalam beberapa varian:"),
        spacer(100),
        specTable([
          ["Varian", "Keterangan"],
          ["Logo Utama (Light)", "Logo di atas background terang (ivory/putih). Format SVG + PNG transparan."],
          ["Logo Utama (Dark)", "Logo di atas background gelap (untuk footer). Format SVG + PNG transparan."],
          ["Logo Icon / Favicon", "Ikon untuk favicon browser dan app icon. Dimensi minimal 512×512px. Format PNG + SVG."],
          ["Logo Monokrom", "Logo satu warna (hitam atau putih) untuk penggunaan khusus."],
        ]),
        spacer(100),
        body("Dimensi logo:"),
        bullet("Lebar minimal logo utama: 400px (tinggi minimal 80px)"),
        bullet("Favicon: 512×512px, 192×192px, 32×32px"),
        bullet("Format SVG harus scalable, tidak pakai raster embedding"),
        spacer(100),
        placeholderBox("Upload screenshot logo di sini — contoh varian light, dark, icon", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 4. HERO / BANNER ───────────────────────────────────────────
        heading("4. Hero / Banner Utama"),
        body("Section hero adalah hal pertama yang dilihat pengunjung. Saat ini hero menggunakan gambar placeholder dari Unsplash. Diperlukan foto produk Dombi yang sesuai."),
        subheading("4.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "Minimal 2 foto (opsional: 3 untuk carousel)"],
          ["Dimensi", "800×1067px (rasio 3:4, portrait) atau 1200×900px (rasio 4:3, landscape)"],
          ["Resolusi", "Minimal 1200px lebar"],
          ["Konten", "Foto produk susu kambing Dombi — produk jadi, gelas susu, atau suasana peternakan"],
          ["Gaya", "Natural, hangat, nuansa hijau-krem. Hindari filter berlebihan."],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot referensi hero — contoh suasana/gaya foto yang diinginkan", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 5. FOTO PRODUK ─────────────────────────────────────────────
        heading("5. Foto Produk"),
        body("Setiap produk membutuhkan minimal 1 foto utama. Untuk pengalaman lebih baik, disarankan 2-3 foto per produk (ganti sudut pandang)."),
        subheading("5.1 Spesifikasi per Produk"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah Minimal", "1 foto per produk"],
          ["Jumlah Ideal", "2-3 foto per produk (depan, samping, detail)"],
          ["Dimensi", "1200×1200px (rasio 1:1) atau 1200×900px (rasio 4:3)"],
          ["Resolusi", "Minimal 800px lebar"],
          ["Background", "Putih atau light gray (#f5f5f5) — bersih dan profesional"],
          ["Gaya", "Product photography profesional. Tidak ada watermark."],
          ["File Naming", "produk-nama-tampilan.jpg (contoh: domilk-original-depan.jpg)"],
        ]),
        spacer(100),
        subheading("5.2 Daftar Produk yang Dibutuhkan"),
        body("Saat ini ada 4 produk di CMS. Foto untuk setiap produk beserta variannya:"),
        spacer(80),
        specTable([
          ["Produk", "Variasi yang Dibutuhkan"],
          ["Domilk Original", "1 foto utama + foto per varian rasa jika ada"],
          ["Domilk Premium Taste", "1 foto utama + foto per varian rasa jika ada"],
          ["Biogoat", "1 foto utama"],
          ["(Produk tambahan)", "Ikuti pola yang sama — 1 foto utama per produk"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot contoh foto produk — gaya product photography yang diinginkan", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 6. FOTO PROSES (FARM STORY) ────────────────────────────────
        heading("6. Foto Proses (Farm Story)"),
        body("Section \"Dari Peternakan ke Meja Anda\" menampilkan 4-5 langkah proses produksi. Setiap langkah butuh 1 foto."),
        subheading("6.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "4-5 foto (satu per langkah proses)"],
          ["Dimensi", "1200×800px (rasio 3:2) atau 1600×900px (16:9)"],
          ["Resolusi", "Minimal 1200px lebar"],
          ["Gaya", "Dokumenter — foto asli proses di peternakan/pabrik. Natural lighting."],
        ]),
        spacer(100),
        subheading("6.2 Daftar Langkah yang Dibutuhkan"),
        specTable([
          ["No", "Langkah", "Deskripsi Foto"],
          ["1", "Perawatan Kambing", "Foto kambing Etawa di peternakan, pakan organik"],
          ["2", "Pemerahan Higienis", "Proses pemerahan susu dengan peralatan modern"],
          ["3", "Pengolahan Segar", "Proses pengolahan/pasteurisasi susu"],
          ["4", "Pengemasan Aman", "Proses pengemasan produk ke dalam kemasan"],
          ["5", "Pengiriman Cepat", "Pengemasan untuk pengiriman / kurir"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot contoh foto proses — suasana peternakan/proses produksi", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 7. SERTIFIKASI & LEGALITAS ─────────────────────────────────
        heading("7. Sertifikasi & Legalitas"),
        body("Section sertifikasi menampilkan 4 kartu berisi informasi legalitas produk. Diperlukan logo/badge sertifikasi."),
        subheading("7.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "4 logo/badge sertifikasi"],
          ["Dimensi", "Minimal 400×400px (persegi)"],
          ["Format", "PNG transparan atau SVG"],
          ["Background", "Transparan atau putih bersih"],
        ]),
        spacer(100),
        subheading("7.2 Sertifikasi yang Ditampilkan"),
        body("Tentukan 4 sertifikasi utama yang ingin ditampilkan, contoh:"),
        bullet("Sertifikat Halal (BPJPH)"),
        bullet("Sertifikat Edar BPOM"),
        bullet("Sertifikat ISO / HACCP"),
        bullet("Sertifikat Organik (jika ada)"),
        spacer(100),
        placeholderBox("Upload screenshot logo sertifikasi yang akan ditampilkan", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 8. HALAMAN TENTANG KAMI ────────────────────────────────────
        heading("8. Halaman Tentang Kami"),
        subheading("8.1 Hero Image About"),
        specTable([
          ["Parameter", "Nilai"],
          ["Dimensi", "1920×800px (rasio landscape lebar)"],
          ["Konten", "Suasana peternakan, panorama alam, atau tim Dombi"],
          ["Gaya", "Natural, warm, menunjukkan keaslian"],
        ]),
        spacer(100),
        subheading("8.2 Foto Tambahan About"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "2-3 foto pendukung"],
          ["Konten", "Tim, fasilitas, atau momen operasional"],
          ["Dimensi", "Minimal 1200×800px"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot referensi foto about — suasana peternakan/tim", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 9. ARTIKEL / BLOG ──────────────────────────────────────────
        heading("9. Artikel / Blog"),
        body("Setiap artikel membutuhkan featured image (gambar utama) sebagai thumbnail di halaman listing."),
        subheading("9.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "Minimal 1 per artikel (opsional: 2-3 untuk konten kaya)"],
          ["Dimensi", "1200×750px (rasio 16:10)"],
          ["Format", "JPG atau WebP"],
          ["Ukuran Maks", "1.5MB per gambar"],
          ["Gaya", "Relevan dengan topik artikel, nuansa natural"],
        ]),
        spacer(100),
        body("Catatan: Article images bisa di-upload langsung melalui CMS Admin saat membuat artikel baru. Tidak perlu disiapkan sekarang, namun tim konten harus menyiapkan foto-foto berikut:"),
        bullet("Foto ilustrasi tips kesehatan / nutrisi"),
        bullet("Foto produk dalam konten lifestyle"),
        bullet("Foto suasana peternakan untuk artikel cerita"),
        spacer(100),
        placeholderBox("Upload screenshot contoh artikel dengan featured image", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 10. DOWNLOAD APP ───────────────────────────────────────────
        heading("10. Download App Banner"),
        body("Section \"Pesan Lebih Mudah dengan Dombi App\" membutuhkan mockup aplikasi di HP."),
        subheading("10.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Dimensi", "Minimal 600×1200px (rasio 1:2, portrait phone mockup)"],
          ["Format", "PNG transparan atau SVG"],
          ["Konten", "Screenshot tampilan utama aplikasi Dombi di dalam frame HP"],
          ["Catatan", "Jika belum ada app, bisa gunakan placeholder atau grid ikon fitur"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot mockup app Dombi atau referensi tampilan app", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 11. PROMO POPUP ────────────────────────────────────────────
        heading("11. Promo Popup"),
        body("Popup promo muncul sekali saat pengunjung pertama kali membuka website. Diperlukan 1 gambar promo."),
        subheading("11.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Dimensi", "800×600px atau 1080×1080px (persegi)"],
          ["Format", "JPG atau PNG"],
          ["Ukuran Maks", "1MB"],
          ["Konten", "Banner promo terkini — diskon, produk baru, atau event khusus"],
          ["Gaya", "Menarik perhatian, tetap sesuai brand guideline Dombi"],
        ]),
        spacer(100),
        body("Catatan: Gambar promo bisa di-update melalui CMS Admin kapan saja. Siapkan 1 gambar untuk launch pertama."),
        spacer(100),
        placeholderBox("Upload screenshot contoh promo popup — desain banner promo", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 12. FOTO TESTIMONI ─────────────────────────────────────────
        heading("12. Foto Testimoni Pelanggan"),
        body("Section testimoni menampilkan ulasan pelanggan. Saat ini menggunakan avatar placeholder. Untuk tampilan lebih personal, bisa upload foto asli pelanggan."),
        subheading("12.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "Minimal 3-5 foto (opsional — bisa tetap pakai placeholder)"],
          ["Dimensi", "200×200px (persegi)"],
          ["Format", "JPG"],
          ["Konten", "Foto wajah pelanggan yang memberikan testimoni"],
          ["Catatan", "Pastikan izin dari pelanggan untuk menggunakan fotonya"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot contoh testimoni dengan foto pelanggan", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 13. ICON KATEGORI ──────────────────────────────────────────
        heading("13. Icon Kategori Produk"),
        body("Jika ingin menampilkan grid kategori produk di beranda (seperti Gajah Print), diperlukan ikon per kategori."),
        subheading("13.1 Spesifikasi"),
        specTable([
          ["Parameter", "Nilai"],
          ["Jumlah", "Sesuai jumlah kategori produk (minimal 4-6)"],
          ["Dimensi", "128×128px atau 256×256px"],
          ["Format", "SVG (utama) atau PNG transparan"],
          ["Gaya", "Ikon filled/outline, warna forest green (#137e5b) atau monokrom"],
        ]),
        spacer(100),
        body("Contoh kategori yang membutuhkan ikon:"),
        bullet("Susu Kambing"),
        bullet("Yogurt"),
        bullet("Produk Olahan Lainnya"),
        bullet("Paket / Bundling"),
        spacer(100),
        placeholderBox("Upload screenshot ikon kategori — contoh gaya ikon yang diinginkan", 6, 2),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 14. FOOTER ─────────────────────────────────────────────────
        heading("14. Footer — Pengiriman & Pembayaran"),
        body("Footer menampilkan logo jasa pengiriman dan metode pembayaran untuk membangun trust."),
        subheading("14.1 Logo Jasa Pengiriman"),
        specTable([
          ["Parameter", "Nilai"],
          ["Format", "PNG transparan atau SVG"],
          ["Dimensi", "Tinggi minimal 40px, lebar proporsional"],
          ["Jasa", "JNE, J&T Express, SiCepat, Grab, GoSend (atau yang digunakan)"],
        ]),
        spacer(100),
        subheading("14.2 Logo Metode Pembayaran"),
        specTable([
          ["Parameter", "Nilai"],
          ["Format", "PNG transparan atau SVG"],
          ["Dimensi", "Tinggi minimal 30px, lebar proporsional"],
          ["Metode", "BCA, Mandiri, BRI, BNI, QRIS, GoPay, OVO (atau yang diterima)"],
        ]),
        spacer(100),
        placeholderBox("Upload screenshot logo pengiriman dan pembayaran yang digunakan", 6, 2.5),
        new Paragraph({ children: [new PageBreak()] }),

        // ── 15. CHECKLIST ──────────────────────────────────────────────
        heading("15. Checklist Pengiriman Asset"),
        body("Gunakan checklist ini saat menyiapkan dan mengirimkan asset kepada tim pengembang:"),
        spacer(100),
        specTable([
          ["No", "Asset", "Status"],
          ["1", "Logo utama (light + dark + icon + monokrom)", "☐"],
          ["2", "Hero image (minimal 2 foto)", "☐"],
          ["3", "Foto produk (minimal 1 per produk × 4 produk)", "☐"],
          ["4", "Foto proses farm story (4-5 foto)", "☐"],
          ["5", "Logo sertifikasi (4 logo)", "☐"],
          ["6", "Hero image About page", "☐"],
          ["7", "Mockup app / placeholder", "☐"],
          ["8", "Gambar promo popup (1 gambar)", "☐"],
          ["9", "Foto testimoni pelanggan (3-5 foto, opsional)", "☐"],
          ["10", "Ikon kategori produk (4-6 ikon)", "☐"],
          ["11", "Logo jasa pengiriman", "☐"],
          ["12", "Logo metode pembayaran", "☐"],
        ]),
        spacer(200),
        divider(),
        spacer(100),
        body("Kirim semua asset ke tim pengembang melalui WhatsApp atau email."),
        spacer(100),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200 },
          children: [new TextRun({ text: "— End of Document —", size: 20, color: INK_500, italics: true })],
        }),
      ],
    },
  ],
});

// ── Generate ───────────────────────────────────────────────────────────────
async function main() {
  const buffer = await Packer.toBuffer(doc);
  const outPath = "/sessions/peaceful-eloquent-lamport/mnt/outputs/Panduan-Asset-Dombi.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("✅ Document created:", outPath);
}

main().catch(console.error);
