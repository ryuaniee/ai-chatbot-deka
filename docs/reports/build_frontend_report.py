from __future__ import annotations

import html
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "frontend-progress-lanjutan-admin.odt"
ASSETS = ROOT / "assets"


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def p(text: str, style: str = "Text_20_body") -> str:
    return f'<text:p text:style-name="{style}">{esc(text)}</text:p>'


def h(text: str, level: int = 1) -> str:
    style = "Heading_20_1" if level == 1 else "Heading_20_2"
    return f'<text:h text:outline-level="{level}" text:style-name="{style}">{esc(text)}</text:h>'


def bullet(items: list[str]) -> str:
    body = "".join(
        "<text:list-item>"
        f"{p(item)}"
        "</text:list-item>"
        for item in items
    )

    return f'<text:list text:style-name="BulletList">{body}</text:list>'


def page_break() -> str:
    return '<text:p text:style-name="PageBreak"/>'


def table(headers: list[str], rows: list[list[str]]) -> str:
    cells = []

    for header in headers:
        cells.append(
            "<table:table-cell office:value-type=\"string\" table:style-name=\"TableHeaderCell\">"
            f"{p(header, 'TableHeader')}"
            "</table:table-cell>"
        )

    header_row = f"<table:table-row>{''.join(cells)}</table:table-row>"
    data_rows = []

    for row in rows:
        row_cells = []
        for cell in row:
            row_cells.append(
                "<table:table-cell office:value-type=\"string\" table:style-name=\"TableCell\">"
                f"{p(cell, 'TableText')}"
                "</table:table-cell>"
            )
        data_rows.append(f"<table:table-row>{''.join(row_cells)}</table:table-row>")

    return (
        '<table:table table:name="RincianFitur" table:style-name="ReportTable">'
        f"{header_row}{''.join(data_rows)}"
        "</table:table>"
    )


def image(path: str, width_cm: float, height_cm: float) -> str:
    name = Path(path).name

    return (
        '<text:p text:style-name="ImageParagraph">'
        '<draw:frame draw:style-name="ImageFrame" draw:name="'
        f'{esc(name)}" text:anchor-type="paragraph" svg:width="{width_cm:.2f}cm" '
        f'svg:height="{height_cm:.2f}cm" draw:z-index="0">'
        f'<draw:image xlink:href="Pictures/{esc(name)}" xlink:type="simple" '
        'xlink:show="embed" xlink:actuate="onLoad"/>'
        "</draw:frame>"
        "</text:p>"
    )


def caption(text: str) -> str:
    return p(text, "Caption")


def content_xml() -> str:
    rows = [
        [
            "Tambah pengguna",
            "Selesai",
            "Admin bisa membuat akun user atau admin baru melalui modal di dashboard.",
        ],
        [
            "Edit pengguna",
            "Selesai",
            "Data nama, email, role, dan password dapat diperbarui dari tabel pengguna.",
        ],
        [
            "Hapus pengguna",
            "Selesai",
            "Aksi hapus tersedia per baris dengan konfirmasi dan proteksi akun admin.",
        ],
        [
            "Settings admin",
            "Selesai",
            "Dropdown profile admin membuka settings modal yang sama dengan user area.",
        ],
        [
            "Distribusi token",
            "Selesai dasar",
            "Chart menampilkan empty state saat belum ada token, lalu otomatis menjadi pie chart saat data tersedia.",
        ],
    ]

    parts = [
        p("Lanjutan Progres Frontend", "Eyebrow"),
        h("Chatbot Deka - Update Frontend Admin"),
        p(
            "Dokumen ini melanjutkan laporan frontend sebelumnya dengan progres terbaru pada area admin dashboard, "
            "khususnya Kelola Pengguna, menu settings admin, dan perbaikan tampilan chart saat data masih kosong.",
            "Lead",
        ),
        h("Status Akhir Terbaru", 2),
        bullet(
            [
                "Halaman admin sudah memiliki menu Kelola Pengguna yang terhubung dengan data user dari backend.",
                "Admin dapat membuat user baru dengan nama, email, role, password, dan konfirmasi password.",
                "Admin dapat mengedit nama, email, role, dan password pengguna. Password pada mode edit bisa dikosongkan.",
                "Admin dapat menghapus pengguna, dengan proteksi agar tidak menghapus akun sendiri.",
                "Backend menjaga minimal tetap ada satu akun admin sehingga akses dashboard tidak terkunci.",
                "Menu profile admin membuka settings modal seperti user biasa, bukan pindah ke section lain.",
                "Chart token usage memiliki empty state yang menjelaskan kenapa grafik belum muncul.",
            ]
        ),
        h("Ringkasan Area Baru", 2),
        table(
            ["Area", "Status", "Keterangan"],
            [
                ["Admin Dashboard", "Selesai dasar", "Sidebar, header, metric cards, chart, dan tabel admin sudah dipakai sebagai area kerja utama."],
                ["Kelola Pengguna", "CRUD", "Admin dapat menambah, mengubah, dan menghapus pengguna dari section Kelola Pengguna."],
                ["UX Empty State", "Selesai", "Distribusi token menampilkan empty state saat belum ada pemakaian token."],
            ],
        ),
        p("Chatbot Deka - Frontend Report | Lanjutan Admin 1", "Footer"),
        page_break(),
        h("Timeline Tambahan"),
        table(
            ["Tahap", "Progres"],
            [
                ["Admin Profile Menu", "Dropdown profile admin dipertahankan seperti pola user menu dan item Settings membuka modal pengaturan akun."],
                ["Users Section", "Tabel daftar pengguna dilengkapi tombol tambah, aksi edit, aksi hapus, dan kolom aksi yang konsisten."],
                ["User Form Modal", "Form reusable dipakai untuk tambah dan edit, lengkap dengan validasi error dari backend."],
                ["Token Empty State", "Area chart diganti dengan pesan kosong saat total token masih 0 agar dashboard tidak terlihat blank."],
            ],
        ),
        h("Alur CRUD Kelola Pengguna", 2),
        table(
            ["Langkah", "Keterangan"],
            [
                ["1. Admin", "Buka menu Kelola Pengguna."],
                ["2. Form", "Tambah atau edit data user."],
                ["3. Inertia", "Submit ke route admin users."],
                ["4. Backend", "Validasi dan simpan data."],
                ["5. UI", "Tabel refresh dan toast tampil."],
            ],
        ),
        h("Rincian Fitur Admin", 2),
        table(["Area", "Status", "Keterangan"], rows),
        p("Chatbot Deka - Frontend Report | Lanjutan Admin 2", "Footer"),
        page_break(),
        h("Dokumentasi UI - Kelola Pengguna"),
        image("admin-users-crud.png", 17.0, 8.54),
        caption(
            "Gambar 8. Section Kelola Pengguna pada admin dashboard berisi metric user, daftar pengguna, role, status, total chat, aktivitas terakhir, dan area aksi CRUD."
        ),
        p("Chatbot Deka - Frontend Report | Lanjutan Admin 3", "Footer"),
        page_break(),
        h("Dokumentasi UI - Empty State Distribusi Token"),
        image("admin-token-empty-state.png", 16.2, 11.16),
        caption(
            "Gambar 9. Area Distribusi Token diperbaiki agar tidak terlihat kosong saat belum ada data token. Empty state menjelaskan bahwa data akan muncul setelah percakapan tersimpan dengan pemakaian token."
        ),
        p("Chatbot Deka - Frontend Report | Lanjutan Admin 4", "Footer"),
    ]

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
    xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
    office:version="1.2">
    <office:automatic-styles>
        <style:style style:name="PageBreak" style:family="paragraph">
            <style:paragraph-properties fo:break-before="page"/>
        </style:style>
        <style:style style:name="Eyebrow" style:family="paragraph">
            <style:text-properties fo:color="#2f80ed" fo:font-size="10pt" fo:font-weight="bold"/>
        </style:style>
        <style:style style:name="Lead" style:family="paragraph">
            <style:paragraph-properties fo:margin-bottom="0.35cm"/>
            <style:text-properties fo:color="#60728d" fo:font-size="12pt"/>
        </style:style>
        <style:style style:name="Caption" style:family="paragraph">
            <style:paragraph-properties fo:text-align="center" fo:margin-top="0.25cm"/>
            <style:text-properties fo:color="#60728d" fo:font-size="9pt"/>
        </style:style>
        <style:style style:name="Footer" style:family="paragraph">
            <style:paragraph-properties fo:text-align="right" fo:margin-top="0.4cm"/>
            <style:text-properties fo:color="#60728d" fo:font-size="8pt"/>
        </style:style>
        <style:style style:name="ImageParagraph" style:family="paragraph">
            <style:paragraph-properties fo:text-align="center" fo:margin-top="0.3cm"/>
        </style:style>
        <style:style style:name="ReportTable" style:family="table">
            <style:table-properties table:align="margins"/>
        </style:style>
        <style:style style:name="TableHeaderCell" style:family="table-cell">
            <style:table-cell-properties fo:background-color="#f4f8fd" fo:border="0.4pt solid #d8e3f2" fo:padding="0.12cm"/>
        </style:style>
        <style:style style:name="TableCell" style:family="table-cell">
            <style:table-cell-properties fo:border="0.4pt solid #d8e3f2" fo:padding="0.12cm"/>
        </style:style>
        <style:style style:name="TableHeader" style:family="paragraph">
            <style:text-properties fo:color="#526780" fo:font-size="8pt" fo:font-weight="bold"/>
        </style:style>
        <style:style style:name="TableText" style:family="paragraph">
            <style:text-properties fo:font-size="9pt"/>
        </style:style>
        <style:style style:name="ImageFrame" style:family="graphic">
            <style:graphic-properties style:wrap="none" style:vertical-pos="top" style:vertical-rel="paragraph" style:horizontal-pos="center" style:horizontal-rel="paragraph"/>
        </style:style>
    </office:automatic-styles>
    <office:body>
        <office:text>
            {''.join(parts)}
        </office:text>
    </office:body>
</office:document-content>
"""


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
    xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
    xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
    xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
    office:version="1.2">
    <office:styles>
        <style:style style:name="Heading_20_1" style:family="paragraph">
            <style:paragraph-properties fo:margin-top="0.25cm" fo:margin-bottom="0.25cm"/>
            <style:text-properties fo:font-size="22pt" fo:font-weight="bold" fo:color="#142033"/>
        </style:style>
        <style:style style:name="Heading_20_2" style:family="paragraph">
            <style:paragraph-properties fo:margin-top="0.45cm" fo:margin-bottom="0.18cm"/>
            <style:text-properties fo:font-size="15pt" fo:font-weight="bold" fo:color="#142033"/>
        </style:style>
        <style:style style:name="Text_20_body" style:family="paragraph">
            <style:paragraph-properties fo:margin-bottom="0.13cm"/>
            <style:text-properties fo:font-size="10pt" fo:color="#142033"/>
        </style:style>
        <text:list-style style:name="BulletList">
            <text:list-level-style-bullet text:level="1" text:bullet-char="•">
                <style:list-level-properties text:min-label-width="0.5cm"/>
            </text:list-level-style-bullet>
        </text:list-style>
    </office:styles>
    <office:automatic-styles>
        <style:page-layout style:name="A4">
            <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="1.8cm" fo:margin-bottom="1.6cm" fo:margin-left="1.6cm" fo:margin-right="1.6cm"/>
        </style:page-layout>
    </office:automatic-styles>
    <office:master-styles>
        <style:master-page style:name="Standard" style:page-layout-name="A4"/>
    </office:master-styles>
</office:document-styles>
"""


def manifest_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
    xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
    manifest:version="1.2">
    <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
    <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
    <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
    <manifest:file-entry manifest:full-path="Pictures/admin-users-crud.png" manifest:media-type="image/png"/>
    <manifest:file-entry manifest:full-path="Pictures/admin-token-empty-state.png" manifest:media-type="image/png"/>
</manifest:manifest>
"""


def main() -> None:
    with zipfile.ZipFile(OUTPUT, "w") as odt:
        odt.writestr(
            zipfile.ZipInfo("mimetype"),
            "application/vnd.oasis.opendocument.text",
            compress_type=zipfile.ZIP_STORED,
        )
        odt.writestr("content.xml", content_xml())
        odt.writestr("styles.xml", styles_xml())
        odt.writestr("META-INF/manifest.xml", manifest_xml())
        odt.write(ASSETS / "admin-users-crud.png", "Pictures/admin-users-crud.png")
        odt.write(ASSETS / "admin-token-empty-state.png", "Pictures/admin-token-empty-state.png")

    print(OUTPUT)


if __name__ == "__main__":
    main()
