(function () {
  'use strict';

  var API_URL = (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_URL) || 'COLE_AQUI_A_URL_DO_WEB_APP';
  var VISIT_KEYS = ['ace_visits_v12'];

  function loadVisits() {
    var rows = [];
    VISIT_KEYS.some(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (raw) {
          rows = JSON.parse(raw);
          return true;
        }
      } catch (err) {
        rows = [];
      }
      return false;
    });
    return Array.isArray(rows) ? rows : [];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeCode(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function renderCard(data) {
    var container = document.getElementById('cardContainer');
    var signature = data.assinatura_data_url || data.signatureDataUrl || '';
    var pdfUrl = data.relatorio_pdf_url || data.pdfUrl || '';
    var cardUrl = data.card_virtual_url || data.cardVirtualUrl || window.location.href;
    var photoUrl = data.foto_url || data.photoUrl || '';
    var routeUrl = data.route_url || data.routeUrl || '';
    var qualityFlags = String(data.quality_flags || data.qualityFlags || '').trim();

    document.getElementById('cardMessage').textContent = 'Dados conferidos para este cartão de visita.';
    container.innerHTML = [
      ['Código do cartão', data.card_code || data.cardCode || '-'],
      ['Morador', data.morador || '-'],
      ['Endereço', [data.logradouro, data.numero, data.bairro].filter(Boolean).join(', ') || '-'],
      ['Microárea', data.microarea || '-'],
      ['Quarteirão', data.quarteirao || '-'],
      ['Agente', data.agente || '-'],
      ['Data e hora', [data.data, data.hora].filter(Boolean).join(' • ') || '-'],
      ['Situação', data.situacao || '-'],
      ['Foco', (data.foco || data.focusFound || 'Não') + ' • ' + (data.focus_count || data.focusQty || 0) + ' foco(s)'],
      ['Caixa d\'água', data.acessou_caixa_agua || data.waterAccess || '-'],
      ['Território GPS', [data.gps_territory || data.gpsTerritory, data.gps_quarteirao || data.gpsQuarteirao].filter(Boolean).join(' • ') || '-'],
      ['Controle de qualidade', qualityFlags || 'Registro sem alertas adicionais'],
      ['Observação', data.obs || '-']
    ].map(function (item) {
      return '<div><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1]) + '</strong></div>';
    }).join('');

    container.innerHTML += '<div><small>Link do cartão</small><strong><a href="' + escapeHtml(cardUrl) + '" target="_blank" rel="noopener noreferrer">Abrir cartão virtual</a></strong></div>';
    container.innerHTML += '<div><small>Relatório PDF</small><strong>' + (pdfUrl ? '<a href="' + escapeHtml(pdfUrl) + '" target="_blank" rel="noopener noreferrer">Abrir relatório da visita</a>' : 'Aguardando sincronização com a base central') + '</strong></div>';
    if (routeUrl) {
      container.innerHTML += '<div><small>Rota do imóvel</small><strong><a href="' + escapeHtml(routeUrl) + '" target="_blank" rel="noopener noreferrer">Abrir navegação</a></strong></div>';
    }
    if (photoUrl) {
      container.innerHTML += '<div><small>Foto da visita</small><div style="margin-top:10px;border:1px solid #d6dfe2;border-radius:18px;background:#fff;padding:10px"><img src="' + escapeHtml(photoUrl) + '" alt="Foto da visita" style="width:100%;max-height:260px;object-fit:contain"></div></div>';
    }

    if (signature) {
      container.innerHTML += '<div><small>Assinatura do morador</small><div style="margin-top:10px;border:1px solid #d6dfe2;border-radius:18px;background:#fff;padding:10px"><img src="' + escapeHtml(signature) + '" alt="Assinatura do morador" style="width:100%;max-height:220px;object-fit:contain"></div></div>';
    }
  }

  function renderEmpty(message) {
    document.getElementById('cardMessage').textContent = message;
    document.getElementById('cardContainer').innerHTML = '';
  }

  function jsonpFetch(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = 'acsCardJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      var script = document.createElement('script');
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('JSONP timeout'));
      }, 15000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (err) {}
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = function (payload) {
        cleanup();
        resolve(payload);
      };

      script.onerror = function () {
        cleanup();
        reject(new Error('JSONP error'));
      };
      script.src = url + (url.indexOf('?') > -1 ? '&' : '?') + 'callback=' + callbackName;
      document.body.appendChild(script);
    });
  }

  function fetchFromApi(code) {
    if (!API_URL || API_URL === 'COLE_AQUI_A_URL_DO_WEB_APP') {
      return Promise.resolve(null);
    }
    var url = API_URL + '?action=card&code=' + encodeURIComponent(code);
    return fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao consultar cartão');
      }
      return response.json();
    }).catch(function () {
      return jsonpFetch(url);
    }).then(function (payload) {
      return payload && payload.data ? payload.data : null;
    }).catch(function () {
      return null;
    });
  }

  function init() {
    if (!document.querySelector('.app-credit')) {
      var footer = document.createElement('footer');
      footer.className = 'app-credit';
      footer.textContent = 'Desenvolvido por Almir Lemgruber @ALMRLK';
      document.body.appendChild(footer);
    }
    var params = new URLSearchParams(window.location.search);
    var code = normalizeCode(params.get('codigo'));
    if (!code) {
      renderEmpty('Informe o parâmetro "codigo" na URL para abrir o cartão virtual.');
      return;
    }

    var local = loadVisits().find(function (visit) {
      return normalizeCode(visit.cardCode || visit.card_code) === code;
    });
    if (local) {
      renderCard(local);
      return;
    }

    fetchFromApi(code).then(function (remote) {
      if (remote) {
        renderCard(remote);
      } else {
        renderEmpty('Cartão não encontrado na base local nem na API configurada.');
      }
    });
  }

  init();
}());
