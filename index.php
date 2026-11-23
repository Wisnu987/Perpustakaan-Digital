<?php
declare(strict_types=1);

$cspPolicy = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' https://rntjeqcmamlzqpmmcmxi.supabase.co; object-src 'none'; base-uri 'self'; form-action 'self';";

header('Content-Type: text/html; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: {$cspPolicy}");

$assetBase = '.';
$pageTitle = 'Smart Library — SMP Negeri 1 Dramaga';
?>
<!DOCTYPE html>
<html lang="id" data-theme="light">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="<?= htmlspecialchars($cspPolicy, ENT_QUOTES, 'UTF-8') ?>" />
    <meta name="referrer" content="no-referrer" />
    <title><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="stylesheet" href="<?= $assetBase ?>/css/styles.css" />
</head>
<body data-schema-url="<?= $assetBase ?>/database/schema.sql">
    <div class="app-shell">
<?php require __DIR__ . '/partials/sidebar.php'; ?>

        <!-- ==================== KOLOM WORKSPACE UTAMA ==================== -->
        <div class="workspace-col">
<?php require __DIR__ . '/partials/topbar.php'; ?>

            <main class="app-main">
                <!-- Banner Peringatan jika schema.sql belum dijalankan di Supabase -->
                <div id="schema-setup-banner" class="notice-box notice-danger hidden u-mb-lg">
                    <div class="schema-banner-row">
                        <div>
                            <strong>Skema 11 Tabel Belum Terpasang di Supabase</strong>
                            <div class="schema-banner-desc">
                                Buka <strong>SQL Editor</strong> di dashboard Supabase project Anda, lalu jalankan isi file <code>database/schema.sql</code> sekali saja untuk membuat 11 tabel, view, trigger, dan data contoh.
                            </div>
                        </div>
                        <div class="header-btn-group">
                            <button type="button" class="btn btn-sm" id="btn-copy-schema-sql">Salin SQL</button>
                            <button type="button" class="btn btn-sm btn-primary" id="btn-recheck-schema">Cek Ulang Koneksi</button>
                        </div>
                    </div>
                </div>

                <!-- Banner Info Peran Aktif -->
                <div id="role-info-banner" class="notice-box hidden"></div>

<?php require __DIR__ . '/partials/view-circulation.php'; ?>
<?php require __DIR__ . '/partials/view-catalog.php'; ?>
<?php require __DIR__ . '/partials/view-members.php'; ?>
<?php require __DIR__ . '/partials/view-fines.php'; ?>
<?php require __DIR__ . '/partials/view-reports.php'; ?>
            </main>
        </div>
    </div>

<?php require __DIR__ . '/partials/overlays.php'; ?>

    <script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.1/dist/umd/supabase.min.js"
        integrity="sha384-rONULF7BcIpU+mBrW9/e9DhAVbCUwcewd5ivsb4/z3qqi1anKKkZ+KZpFRHHM3pG"
        crossorigin="anonymous"
    ></script>
    <script src="<?= $assetBase ?>/js/db.js"></script>
    <script src="<?= $assetBase ?>/js/app.js"></script>
</body>
</html>
