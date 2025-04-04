<?php
/**
 * Plugin Name: PDF Archive Downloader
 * Plugin URI: https://madeiraoweb.com.br
 * Description: Plugin para gerenciar e disponibilizar o download de PDFs de edições do jornal por data.
 * Version: 1.0.0
 * Author: Marcelo Pereira
 * Author URI: https://madeiraoweb.com.br
 * Text Domain: pdf-archive-downloader
 */

defined('ABSPATH') || exit;

class PDF_Archive_Downloader {
    
    private static $instance = null;
    const GITHUB_REPO = 'madeirao/pdf';
    const GITHUB_BRANCH = 'main';
    
    public static function get_instance() {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        add_shortcode('pdf_downloader', [$this, 'render_shortcode']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_assets']);
        add_action('wp_ajax_fetch_pdfs', [$this, 'ajax_fetch_pdfs']);
        add_action('wp_ajax_nopriv_fetch_pdfs', [$this, 'ajax_fetch_pdfs']);
    }
    
    public function enqueue_assets() {
        wp_register_style('pdf-downloader-css', plugins_url('assets/css/pdf-downloader.css', __FILE__));
        wp_register_script('pdf-downloader-js', plugins_url('assets/js/pdf-downloader.js', __FILE__), ['jquery'], null, true);
        
        wp_localize_script('pdf-downloader-js', 'pdfDownloader', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('pdf_downloader_nonce'),
            'github_url' => 'https://raw.githubusercontent.com/'.self::GITHUB_REPO.'/'.self::GITHUB_BRANCH.'/'
        ]);
    }
    
    public function render_shortcode() {
        wp_enqueue_style('pdf-downloader-css');
        wp_enqueue_script('pdf-downloader-js');
        
        ob_start(); ?>
        <div class="pdf-download-container">
            <div class="pdf-header">
                <h2>Pesquisar por data</h2>
                <div class="pdf-search-group">
                    <input type="date" id="pdf-date-picker" max="<?php echo date('Y-m-d'); ?>">
                    <button id="pdf-search-btn">Pesquisar</button>
                </div>
            </div>
            
            <div id="pdf-result"></div>
            
            <div class="pdf-month-list-container">
                <h2>Listar edições por mês</h2>
                <div id="pdf-month-list" class="pdf-month-list"></div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
    
    public function ajax_fetch_pdfs() {
        check_ajax_referer('pdf_downloader_nonce', 'nonce');
        
        $type = $_GET['type'] ?? 'months';
        $month = $_GET['month'] ?? '';
        
        if ($type === 'months') {
            wp_send_json_success($this->get_github_months());
        } else {
            wp_send_json_success($this->get_github_days($month));
        }
    }
    
    private function get_github_months() {
        // Remova completamente o sistema de transient
        $response = wp_remote_get('https://api.github.com/repos/'.self::GITHUB_REPO.'/contents', [
            'headers' => ['User-Agent' => 'WordPress']
        ]);
        
        if (is_wp_error($response)) {
            return [];
        }
        
        $body = json_decode(wp_remote_retrieve_body($response), true);
        $months = [];
        $meses_pt = [
            'January' => 'Janeiro', 'February' => 'Fevereiro', 'March' => 'Março',
            'April' => 'Abril', 'May' => 'Maio', 'June' => 'Junho',
            'July' => 'Julho', 'August' => 'Agosto', 'September' => 'Setembro',
            'October' => 'Outubro', 'November' => 'Novembro', 'December' => 'Dezembro'
        ];
        
        foreach ($body as $item) {
            if ($item['type'] === 'dir' && preg_match('/^\d{6}$/', $item['name'])) {
                $data = DateTime::createFromFormat('Ymd', $item['name'].'01');
                $mes_en = $data->format('F');
                
                $months[] = [
                    'name' => $item['name'],
                    'label' => $meses_pt[$mes_en] . ' ' . $data->format('Y'),
                    'year' => $data->format('Y'),
                    'month' => $data->format('m')
                ];
            }
        }
        
        usort($months, fn($a, $b) => $b['name'] <=> $a['name']);
        return $months;
    }
    
    private function get_github_days($month) {
        // Cache reduzido para 10 minutos (600 segundos)
        $transient = get_transient('pdf_days_'.$month);
        
        if (!$transient) {
            $response = wp_remote_get('https://api.github.com/repos/'.self::GITHUB_REPO.'/contents/'.$month, [
                'headers' => ['User-Agent' => 'WordPress']
            ]);
            
            if (is_wp_error($response)) {
                return [];
            }
            
            $body = json_decode(wp_remote_retrieve_body($response), true);
            $days = [];
            
            foreach ($body as $item) {
                if ($item['type'] === 'file' && preg_match('/^(\d{8})\.pdf$/', $item['name'], $matches)) {
                    $days[] = [
                        'date' => $matches[1],
                        'url' => $item['download_url'],
                        'label' => date('d/m/Y', strtotime($matches[1]))
                    ];
                }
            }
            
            usort($days, fn($a, $b) => $b['date'] <=> $a['date']);
            set_transient('pdf_days_'.$month, $days, 600); // 10 minutos
            return $days;
        }
        
        return $transient;
    }
    
    public function clear_cache() {
        global $wpdb;
        $wpdb->query("DELETE FROM $wpdb->options WHERE option_name LIKE '_transient_pdf_days_%'");
    }
}

add_action('admin_init', function() {
    if (isset($_GET['clear_pdf_cache']) && current_user_can('manage_options')) {
        PDF_Archive_Downloader::get_instance()->clear_cache();
        wp_redirect(admin_url('admin.php?page=pdf-archive-downloader&cache_cleared=1'));
        exit;
    }
});

PDF_Archive_Downloader::get_instance();
