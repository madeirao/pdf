document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.pdf-download-container');
    if (!container) return;

    // Função para copiar texto para a área de transferência
    const copyToClipboard = async (text) => {
        try {
            // Método moderno (requer HTTPS)
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                showToast('Link copiado!');
            }
            // Fallback para navegadores antigos/HTTP
            else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('Link copiado! (método legado)');
            }
        } catch (err) {
            console.error('Erro ao copiar:', err);
            showToast('Erro ao copiar link!', true);
        }
    };

    // Função para mostrar notificação
    const showToast = (message, isError = false) => {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isError ? '#ff4444' : '#4CAF50'};
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            font-family: Arial;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    };

    const init = () => {
        fetchMonths();
        document.getElementById('pdf-search-btn').addEventListener('click', handleDateSearch);
    };

    const fetchMonths = async () => {
        try {
            const response = await fetch(pdfDownloader.ajax_url + '?action=fetch_pdfs&type=months&nonce=' + pdfDownloader.nonce);
            const data = await response.json();
            if (data.success) renderMonths(data.data);
        } catch (error) {
            console.error('Erro:', error);
        }
    };

    const renderMonths = (months) => {
        const list = document.getElementById('pdf-month-list');
        list.innerHTML = months.map(month => `
            <div class="pdf-month-item">
                <div class="pdf-month-header" data-month="${month.name}">
                    ${month.label}
                </div>
                <div class="pdf-days-container" id="days-${month.name}"></div>
            </div>
        `).join('');

        document.querySelectorAll('.pdf-month-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const month = e.currentTarget.dataset.month;
                const monthItem = e.currentTarget.closest('.pdf-month-item');

                document.querySelectorAll('.pdf-month-item').forEach(item => {
                    if (item !== monthItem) {
                        item.classList.remove('active');
                        item.querySelector('.pdf-days-container').classList.remove('active');
                    }
                });

                monthItem.classList.toggle('active');
                const daysContainer = monthItem.querySelector('.pdf-days-container');
                daysContainer.classList.toggle('active');

                if (monthItem.classList.contains('active') && daysContainer.innerHTML === '') {
                    fetchDays(month);
                }
            });
        });
    };

    const fetchDays = async (month) => {
        try {
            const response = await fetch(pdfDownloader.ajax_url + '?action=fetch_pdfs&type=days&month=' + month + '&nonce=' + pdfDownloader.nonce);
            const data = await response.json();
            if (data.success) renderDays(data.data, month);
        } catch (error) {
            console.error('Erro:', error);
        }
    };

    const renderDays = (days, month) => {
        const container = document.getElementById(`days-${month}`);
        if (container) {
            container.innerHTML = days.map(day => `
                <div class="pdf-day-item">
                    <div class="pdf-day-main">
                        <span class="pdf-day-date">${day.label}</span>
                        <div class="pdf-day-actions">
                            <button class="pdf-copy-link" data-url="${encodeURIComponent(day.url)}">
                                Copiar link
                            </button>
                            <a href="${day.url}" class="pdf-download-link" download>
                                Baixar PDF
                            </a>
                        </div>
                    </div>
                    <div class="pdf-day-url">
                        ${day.url}
                    </div>
                </div>
            `).join('');

            // Adicionar eventos de clique para copiar
            container.querySelectorAll('.pdf-copy-link').forEach(button => {
                button.addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    copyToClipboard(url);
                });
            });
        }
    };

    const handleDateSearch = async () => {
        const dateInput = document.getElementById('pdf-date-picker');
        const resultDiv = document.getElementById('pdf-result');

        resultDiv.innerHTML = '<div class="pdf-loading">Verificando edição...</div>';

        if (!dateInput.value) {
            resultDiv.innerHTML = `<div class="pdf-error">Selecione uma data válida</div>`;
            return;
        }

        const [year, month, day] = dateInput.value.split('-');
        const pad = (n) => n.padStart(2, '0');
        const formattedMonth = pad(month);
        const formattedDay = pad(day);
        const formattedDate = `${year}${formattedMonth}${formattedDay}`;

        const pdfUrl = `${pdfDownloader.github_url}${year}${formattedMonth}/${formattedDate}.pdf`;

        try {
            // Primeiro verifica se o arquivo existe
            const response = await fetch(pdfUrl, { method: 'HEAD' });

            if (response.ok) {
                // Só exibe a URL se o arquivo existir
                resultDiv.innerHTML = `
                    <div class="pdf-day-item">
                        <div class="pdf-day-main">
                            <span class="pdf-day-date">${formattedDay}/${formattedMonth}/${year}</span>
                            <div class="pdf-day-actions">
                                <button class="pdf-copy-link" data-url="${encodeURIComponent(pdfUrl)}">
                                    Copiar link
                                </button>
                                <a href="${pdfUrl}" class="pdf-download-link" download>
                                    Baixar PDF
                                </a>
                            </div>
                        </div>
                        <div class="pdf-day-url">
                            ${pdfUrl}
                        </div>
                    </div>
                `;

                // Adiciona evento de cópia
                resultDiv.querySelector('.pdf-copy-link').addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    copyToClipboard(url);
                });
            } else {
                // Exibe apenas o erro se não existir
                resultDiv.innerHTML = `<div class="pdf-error">Edição não encontrada para esta data</div>`;
            }
        } catch (error) {
            console.error('Erro:', error);
            resultDiv.innerHTML = `<div class="pdf-error">Falha na conexão. Verifique sua internet.</div>`;
        }
    };

    init();
});