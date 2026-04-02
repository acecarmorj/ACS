(function () {
  'use strict';

  var CONFIG = {
    API_URL: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_URL) || 'COLE_AQUI_A_URL_DO_WEB_APP',
    MAP_CENTER: [-21.9325, -42.0275],
    MAP_ZOOM: 13
  };

  var STORAGE_KEYS = ['ace_visits_v11'];
  var PROPERTY_KEYS = ['ace_properties_v11'];
  var AUTO_INTERVAL = 60000;
  var PROPERTY_COMPLEMENTS = ['Normal', 'Sequencia', 'Complemento'];
  var DEPOSITS = {
    A1: 'Caixa d\'água / tambor',
    A2: 'Pneu / entulho',
    B: 'Vaso / garrafa',
    C: 'Piscina / cisterna',
    D1: 'Lixo orgânico',
    D2: 'Obra / construção',
    E: 'Natural / bromélia'
  };

  var TERRITORY_SOURCE = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
  var TERRITORY_ALIASES = {
    'caixa dagua': 'caixa dagua',
    'caixa d agua': 'caixa dagua',
    'caixa d\'agua': 'caixa dagua',
    'jd centenario': 'jardim centenario',
    'jardim centenario': 'jardim centenario',
    'val paraiso': 'val paraiso',
    'vp': 'val paraiso',
    'sto antonio': 'santo antonio',
    'santo antonio': 'santo antonio',
    'porto velho': 'porto velho do cunha',
    'pvc': 'porto velho do cunha',
    'light': 'ilha dos pombos light',
    'ilha dos pombos': 'ilha dos pombos light',
    'ilha dos pombos light': 'ilha dos pombos light'
  };

  var state = {
    source: 'local',
    allVisits: [],
    allProperties: [],
    filteredVisits: [],
    filteredProperties: [],
    selectedVisitUid: '',
    map: null,
    mapLayers: [],
    territoryPolygonLayers: [],
    territoryPointLayers: [],
    territoryPolygons: [],
    territoryPoints: [],
    mapToggles: {
      heat: true,
      visits: true,
      polygons: true,
      points: false
    },
    autoTimer: null
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function setBanner(text, kind) {
    var node = document.getElementById('panelStatus');
    node.textContent = text;
    node.style.background = kind === 'danger' ? '#8e3131' :
      kind === 'warn' ? '#8d6915' :
      kind === 'accent' ? '#355f9f' : '#203028';
  }

  function setChip(id, text, kind) {
    var chip = document.getElementById(id);
    chip.textContent = text;
    chip.className = 'chip';
    if (kind === 'ok') {
      chip.classList.add('is-ok');
    } else if (kind === 'warn') {
      chip.classList.add('is-warn');
    } else if (kind === 'danger') {
      chip.classList.add('is-danger');
    } else if (kind === 'accent') {
      chip.classList.add('is-live');
    }
  }

  function normalizeCode(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  function normalizeAreaCode(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/');
  }

  function normalizePropertyComplement(value) {
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return 'Normal';
    }
    if (label === 'normal') {
      return 'Normal';
    }
    if (label === 'sequencia' || label === 'sequência' || label === 'sequãªncia') {
      return 'Sequencia';
    }
    if (label === 'complemento') {
      return 'Complemento';
    }
    return '';
  }

  function normalizeLabel(value) {
    var label = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return TERRITORY_ALIASES[label] || label;
  }

  function normalizeQuarteirao(value) {
    return normalizeLabel(String(value || '').replace(/^q\s*[-/]?\s*/i, ''));
  }

  function getFeatureTerritoryName(feature) {
    if (!feature) {
      return '';
    }
    if (normalizeLabel(feature.folder) === 'distritos') {
      return String(feature.name || '').trim();
    }
    return String(feature.folder || feature.name || '').trim();
  }

  function normalizeCoord(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    var num = Number(String(value).replace(',', '.'));
    return isFinite(num) ? num : null;
  }

  function normalizeStatus(value) {
    var label = String(value || '').trim().toLowerCase();
    if (label.indexOf('fechado') > -1) {
      return 'Fechado';
    }
    if (label.indexOf('recuperado') > -1) {
      return 'Recuperado';
    }
    if (label.indexOf('recusa') > -1) {
      return 'Recusa';
    }
    return 'Visitado';
  }

  function normalizeVisit(visit) {
    var deposits = String(visit.deposits || '').trim();
    var focusBreakdown = String(visit.deposit_focus_breakdown || visit.depositFocusBreakdown || '').trim();
    return {
      uid: String(visit.uid || '').trim(),
      data: String(visit.data || '').trim(),
      hora: String(visit.hora || '').trim().slice(0, 5),
      agente: String(visit.agente || '').trim(),
      matricula: String(visit.matricula || '').trim(),
      bairro: String(visit.bairro || '').trim(),
      microarea: normalizeAreaCode(visit.microarea || ''),
      quarteirao: normalizeAreaCode(visit.quarteirao || ''),
      logradouro: String(visit.logradouro || '').trim(),
      numero: String(visit.numero || '').trim(),
      morador: String(visit.morador || '').trim(),
      telefone: String(visit.telefone || '').trim(),
      tipo: String(visit.tipo || '').trim(),
      situacao: normalizeStatus(visit.situacao || 'Visitado'),
      foco: String(visit.foco || visit.focusFound || '').trim() || 'Não',
      focusCount: Number(visit.focus_count || visit.focusQty || 0) || 0,
      depositCount: Number(visit.deposit_count || visit.depositTotal || 0) || 0,
      deposits: deposits,
      depositFocusCount: Number(visit.deposit_focus_count || visit.depositFocusTotal || 0) || 0,
      depositFocusBreakdown: focusBreakdown,
      waterAccess: String(visit.acessou_caixa_agua || visit.waterAccess || '').trim(),
      tubitosQty: Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0,
      gps_lat: normalizeCoord(visit.gps_lat || (visit.gps && visit.gps.lat)),
      gps_lng: normalizeCoord(visit.gps_lng || (visit.gps && visit.gps.lng)),
      gps_acc: Number(visit.gps_acc || (visit.gps && visit.gps.accuracy) || 0) || 0,
      cardCode: String(visit.card_code || visit.cardCode || '').trim(),
      cardVirtualUrl: String(visit.card_virtual_url || visit.cardVirtualUrl || '').trim(),
      pdfUrl: String(visit.relatorio_pdf_url || visit.pdfUrl || '').trim(),
      routeUrl: String(visit.route_url || visit.routeUrl || '').trim(),
      gpsTerritory: String(visit.gps_territory || visit.gpsTerritory || '').trim(),
      gpsQuarteirao: String(visit.gps_quarteirao || visit.gpsQuarteirao || '').trim(),
      qualityFlags: String(visit.quality_flags || visit.qualityFlags || '').trim(),
      signatureDataUrl: String(visit.assinatura_data_url || visit.signatureDataUrl || '').trim(),
      obs: String(visit.obs || '').trim()
    };
  }

  function normalizeProperty(property) {
    var rawComplemento = String(property.complemento || property.logradouroModo || '').trim();
    var normalizedComplemento = normalizePropertyComplement(rawComplemento);
    var referenceValue = String(property.referencia || property.ref || '').trim();
    if (!referenceValue && rawComplemento && !normalizedComplemento) {
      referenceValue = rawComplemento;
    }
    return {
      uid: String(property.uid || '').trim(),
      morador: String(property.morador || '').trim(),
      telefone: String(property.telefone || '').trim(),
      microarea: normalizeAreaCode(property.microarea || ''),
      quarteirao: normalizeAreaCode(property.quarteirao || ''),
      bairro: String(property.bairro || '').trim(),
      logradouro: String(property.logradouro || '').trim(),
      numero: String(property.numero || '').trim(),
      complemento: normalizedComplemento || 'Normal',
      referencia: referenceValue,
      tipo: String(property.tipo || '').trim()
    };
  }

  function getPropertyReferenceText(property) {
    if (!property) {
      return 'Sem referÃªncia complementar';
    }
    if (property.referencia) {
      return property.referencia;
    }
    if (property.complemento && property.complemento !== 'Normal') {
      return 'Cadastro ' + property.complemento;
    }
    return 'Sem referÃªncia complementar';
  }

  function hydrateTerritoryData() {
    if (state.territoryPolygons.length || state.territoryPoints.length) {
      return;
    }

    state.territoryPolygons = (TERRITORY_SOURCE.polygons || []).map(function (feature) {
      var territoryName = getFeatureTerritoryName(feature);
      return {
        id: String(feature.id || '').trim(),
        folder: String(feature.folder || '').trim(),
        path: Array.isArray(feature.path) ? feature.path.slice() : [],
        name: String(feature.name || '').trim(),
        description: String(feature.description || '').trim(),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : [],
        territoryName: territoryName,
        territoryKey: normalizeLabel(territoryName),
        quarteiraoKey: normalizeQuarteirao(feature.name),
        featureType: 'polygon'
      };
    }).filter(function (feature) {
      return feature.coordinates.length > 2 && feature.territoryKey !== 'carmo';
    });

    state.territoryPoints = (TERRITORY_SOURCE.points || []).map(function (feature) {
      var territoryName = getFeatureTerritoryName(feature);
      return {
        id: String(feature.id || '').trim(),
        folder: String(feature.folder || '').trim(),
        path: Array.isArray(feature.path) ? feature.path.slice() : [],
        name: String(feature.name || '').trim(),
        description: String(feature.description || '').trim(),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : [],
        territoryName: territoryName,
        territoryKey: normalizeLabel(territoryName),
        quarteiraoKey: normalizeQuarteirao(feature.name),
        featureType: 'point'
      };
    }).filter(function (feature) {
      return feature.coordinates.length === 2;
    });
  }

  function loadLocalVisits() {
    var rows = [];
    STORAGE_KEYS.some(function (key) {
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
    return Array.isArray(rows) ? rows.map(normalizeVisit) : [];
  }

  function loadLocalProperties() {
    var rows = [];
    PROPERTY_KEYS.some(function (key) {
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
    return Array.isArray(rows) ? rows.map(normalizeProperty) : [];
  }

  function isApiConfigured() {
    return CONFIG.API_URL && CONFIG.API_URL !== 'COLE_AQUI_A_URL_DO_WEB_APP';
  }

  function jsonpFetch(url) {
    return new Promise(function (resolve, reject) {
      var callbackName = 'acsDashboardJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
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

  function fetchApiVisits(start, end) {
    if (!isApiConfigured()) {
      return Promise.resolve(null);
    }
    var url = CONFIG.API_URL + '?action=dashboard_range&start=' + encodeURIComponent(start) + '&end=' + encodeURIComponent(end) + '&t=' + Date.now();
    return fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao carregar painel');
      }
      return response.json();
    }).catch(function () {
      return jsonpFetch(url);
    }).then(function (payload) {
      var rows = payload && payload.data && Array.isArray(payload.data.visits) ? payload.data.visits :
        (payload && Array.isArray(payload.visits) ? payload.visits : []);
      var properties = payload && payload.data && Array.isArray(payload.data.properties) ? payload.data.properties :
        (payload && Array.isArray(payload.properties) ? payload.properties : []);
      return {
        visits: rows.map(normalizeVisit),
        properties: properties.map(normalizeProperty)
      };
    });
  }

  function formatDateBR(value) {
    if (!value) {
      return '-';
    }
    var parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  }

  function addressKey(visit) {
    return [visit.bairro, visit.logradouro, visit.numero].join('|').toLowerCase();
  }

  function getDateRange() {
    var today = new Date().toISOString().slice(0, 10);
    return {
      start: document.getElementById('dateStart').value || today,
      end: document.getElementById('dateEnd').value || today
    };
  }

  function ensurePanelLayout() {
    var title = document.querySelector('.brand-copy h1');
    var note = document.querySelector('.brand-copy p');
    var toolbar = document.querySelector('.toolbar');
    var metricSection = document.getElementById('panelMetricGrid');
    var heatMapNode = document.getElementById('heatMap');

    if (title) {
      title.textContent = 'Painel Analitico ACE';
    }
    if (note) {
      note.textContent = 'Dashboard operacional, territorial e gerencial integrado ao app de campo, ao KMZ municipal e ao Google Sheets.';
    }

    if (toolbar && !document.getElementById('quarteiraoFilter')) {
      toolbar.insertAdjacentHTML('beforeend', '' +
        '<div class="field"><label for="quarteiraoFilter">Quarteirão</label><select id="quarteiraoFilter"></select></div>' +
        '<div class="field"><label for="logradouroFilter">Rua / logradouro</label><select id="logradouroFilter"></select></div>' +
        '<div class="field"><label for="searchFilter">Busca geral</label><input id="searchFilter" type="text" placeholder="Rua, bairro, morador, número"></div>');
    }

    if (metricSection && !document.getElementById('compareBairros')) {
      var metricCard = metricSection.closest('.card');
      if (metricCard && metricCard.parentNode) {
        metricCard.insertAdjacentHTML('afterend', '' +
          '<section class="grid two">' +
            '<div class="card">' +
              '<h2 class="section-title">Comparativo territorial</h2>' +
              '<div id="compareBairros" class="chart-list"></div>' +
              '<div style="height:12px"></div>' +
              '<div id="compareMicroareas" class="chart-list"></div>' +
            '</div>' +
            '<div class="card">' +
              '<h2 class="section-title">Comparativo por quarteirão e rua</h2>' +
              '<div id="compareQuarteiroes" class="chart-list"></div>' +
              '<div style="height:12px"></div>' +
              '<div id="compareLogradouros" class="chart-list"></div>' +
            '</div>' +
          '</section>' +
          '<section class="card">' +
            '<h2 class="section-title">Relatório analítico na tela</h2>' +
            '<div id="reportOnScreen" class="insight-list"></div>' +
          '</section>' +
          '<section class="card">' +
            '<h2 class="section-title">Drilldown operacional</h2>' +
            '<div id="drilldownPanel" class="insight-list"></div>' +
            '<div class="btn-row compact-actions" style="margin-top:16px">' +
              '<button class="btn btn-soft" id="clearDrilldownBtn" type="button">Limpar drilldown</button>' +
            '</div>' +
          '</section>');
      }
    }

    if (heatMapNode && !document.getElementById('territoryMapControls')) {
      heatMapNode.insertAdjacentHTML('beforebegin', '' +
        '<div id="territoryMapControls" class="map-toolbar">' +
          '<label class="map-toggle"><input id="togglePolygonLayer" type="checkbox" checked> QuarteirÃµes</label>' +
          '<label class="map-toggle"><input id="toggleVisitMarkers" type="checkbox" checked> Visitas GPS</label>' +
          '<label class="map-toggle"><input id="toggleHeatLayer" type="checkbox" checked> Calor</label>' +
          '<label class="map-toggle"><input id="togglePointLayer" type="checkbox"> Marcadores KMZ</label>' +
        '</div>' +
        '<div id="territoryMapSummary" class="territory-summary">Base cartogrÃ¡fica pronta para destacar quarteirÃµes, distritos e o recorte filtrado.</div>');
    }

    if (document.getElementById('togglePolygonLayer') && document.getElementById('togglePolygonLayer').parentNode) {
      document.getElementById('togglePolygonLayer').parentNode.lastChild.textContent = ' Quarteirões KMZ';
    }
    if (document.getElementById('territoryMapSummary')) {
      document.getElementById('territoryMapSummary').textContent = 'Base cartográfica pronta para destacar quarteirões, distritos e o recorte filtrado.';
    }

    if (!document.querySelector('.app-credit')) {
      var footer = document.createElement('footer');
      footer.className = 'app-credit';
      footer.textContent = 'Desenvolvido por Almir Lemgruber @ALMRLK';
      var panelStatus = document.getElementById('panelStatus');
      if (panelStatus && panelStatus.parentNode) {
        panelStatus.parentNode.insertBefore(footer, panelStatus);
      }
    }
  }

  function loadDashboard() {
    var range = getDateRange();
    setBanner('Atualizando painel...', 'accent');
    var promise = isApiConfigured() ? fetchApiVisits(range.start, range.end) : Promise.resolve({
      visits: loadLocalVisits(),
      properties: loadLocalProperties()
    });
    promise.then(function (bundle) {
      state.source = isApiConfigured() ? 'api' : 'local';
      state.allVisits = bundle && bundle.visits ? bundle.visits : [];
      state.allProperties = bundle && bundle.properties ? bundle.properties : [];
      applyFilters();
      setChip('panelModeChip', state.source === 'api' ? 'Google Sheets' : 'Modo local', state.source === 'api' ? 'ok' : 'warn');
      setChip('panelStatusChip', state.filteredVisits.length + ' visita(s)', 'accent');
      setBanner('Painel atualizado com sucesso.', 'ok');
    }).catch(function () {
      state.source = 'local';
      state.allVisits = loadLocalVisits();
      state.allProperties = loadLocalProperties();
      applyFilters();
      setChip('panelModeChip', 'Modo local', 'warn');
      setChip('panelStatusChip', 'Fallback local', 'warn');
      setBanner('API indisponível. Painel carregado no modo local.', 'warn');
    });
  }

  function buildOptions(values, label) {
    var uniques = [''].concat(Array.from(new Set(values.filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    }));
    return uniques.map(function (value) {
      return '<option value="' + escapeHtml(value) + '">' + escapeHtml(value || label) + '</option>';
    }).join('');
  }

  function getCurrentFilterValues() {
    return {
      bairro: document.getElementById('bairroFilter') ? document.getElementById('bairroFilter').value : '',
      microarea: document.getElementById('microareaFilter') ? document.getElementById('microareaFilter').value : '',
      quarteirao: document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '',
      logradouro: document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '',
      agent: document.getElementById('agentFilter') ? document.getElementById('agentFilter').value : ''
    };
  }

  function buildMicroareaQuarteiraoMap(rows) {
    var map = {};
    rows.forEach(function (row) {
      var microarea = String(row.microarea || '').trim();
      var quarteirao = String(row.quarteirao || '').trim();
      if (!microarea) {
        return;
      }
      if (!map[microarea]) {
        map[microarea] = [];
      }
      if (quarteirao) {
        map[microarea].push(quarteirao);
      }
    });
    Object.keys(map).forEach(function (key) {
      map[key] = Array.from(new Set(map[key])).sort(function (a, b) {
        return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
      });
    });
    return map;
  }

  function setSelectOptions(node, values, emptyLabel, selectedValue) {
    if (!node) {
      return '';
    }
    var cleanValues = Array.from(new Set((values || []).filter(Boolean))).sort(function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
    });
    node.innerHTML = buildOptions(cleanValues, emptyLabel);
    node.value = cleanValues.indexOf(selectedValue) > -1 ? selectedValue : '';
    return node.value;
  }

  function populateFilters() {
    var current = getCurrentFilterValues();
    var rows = state.allVisits.concat(state.allProperties);
    var bairros = rows.map(function (row) { return row.bairro; });
    var microareas = rows.map(function (row) { return row.microarea; });
    var areaMap = buildMicroareaQuarteiraoMap(rows);
    var bairro = setSelectOptions(document.getElementById('bairroFilter'), bairros, 'Todos', current.bairro);
    var microarea = setSelectOptions(document.getElementById('microareaFilter'), microareas, 'Todas', current.microarea);

    setSelectOptions(document.getElementById('agentFilter'), state.allVisits.map(function (visit) { return visit.agente; }), 'Todos', current.agent);

    if (document.getElementById('quarteiraoFilter')) {
      var quarteiroes = microarea && areaMap[microarea] ? areaMap[microarea] : [];
      var quarteirao = setSelectOptions(
        document.getElementById('quarteiraoFilter'),
        quarteiroes,
        microarea ? 'Todos' : 'Selecione a microárea',
        current.quarteirao
      );
      document.getElementById('quarteiraoFilter').disabled = !microarea;

      if (document.getElementById('logradouroFilter')) {
        var logradouros = rows.filter(function (row) {
          if (bairro && row.bairro !== bairro) { return false; }
          if (microarea && String(row.microarea || '') !== microarea) { return false; }
          if (quarteirao && String(row.quarteirao || '') !== quarteirao) { return false; }
          return true;
        }).map(function (row) { return row.logradouro; });
        setSelectOptions(document.getElementById('logradouroFilter'), logradouros, 'Todas', current.logradouro);
      }
    }
  }

  function applyFilters() {
    populateFilters();
    var bairro = document.getElementById('bairroFilter').value;
    var microarea = document.getElementById('microareaFilter').value;
    var quarteirao = document.getElementById('quarteiraoFilter') ? document.getElementById('quarteiraoFilter').value : '';
    var logradouro = document.getElementById('logradouroFilter') ? document.getElementById('logradouroFilter').value : '';
    var agent = document.getElementById('agentFilter').value;
    var search = document.getElementById('searchFilter') ? String(document.getElementById('searchFilter').value || '').trim().toLowerCase() : '';
    var range = getDateRange();

    state.filteredVisits = state.allVisits.filter(function (visit) {
      if (range.start && visit.data < range.start) { return false; }
      if (range.end && visit.data > range.end) { return false; }
      if (bairro && visit.bairro !== bairro) { return false; }
      if (microarea && String(visit.microarea) !== microarea) { return false; }
      if (quarteirao && String(visit.quarteirao) !== quarteirao) { return false; }
      if (logradouro && visit.logradouro !== logradouro) { return false; }
      if (agent && visit.agente !== agent) { return false; }
      if (search) {
        var text = [visit.bairro, visit.microarea, visit.quarteirao, visit.logradouro, visit.numero, visit.morador, visit.agente].join(' ').toLowerCase();
        if (text.indexOf(search) === -1) { return false; }
      }
      return true;
    }).sort(function (a, b) {
      return (b.data + ' ' + b.hora).localeCompare(a.data + ' ' + a.hora);
    });

    state.filteredProperties = state.allProperties.filter(function (property) {
      if (bairro && property.bairro !== bairro) { return false; }
      if (microarea && String(property.microarea) !== microarea) { return false; }
      if (quarteirao && String(property.quarteirao) !== quarteirao) { return false; }
      if (logradouro && property.logradouro !== logradouro) { return false; }
      if (search) {
        var text = [
          property.bairro,
          property.microarea,
          property.quarteirao,
          property.logradouro,
          property.numero,
          property.morador,
          property.tipo,
          property.complemento,
          property.referencia
        ].join(' ').toLowerCase();
        if (text.indexOf(search) === -1) { return false; }
      }
      return true;
    });

    renderDashboard();
  }

  function setFilterValue(id, value) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.value = value || '';
  }

  function applyDrilldown(field, value) {
    if (!value) {
      return;
    }
    if (field === 'bairro') {
      setFilterValue('bairroFilter', value);
      setFilterValue('microareaFilter', '');
      populateFilters();
      setFilterValue('quarteiraoFilter', '');
      setFilterValue('logradouroFilter', '');
    } else if (field === 'microarea') {
      setFilterValue('microareaFilter', value);
      populateFilters();
      setFilterValue('quarteiraoFilter', '');
      setFilterValue('logradouroFilter', '');
    } else if (field === 'quarteirao') {
      if (!document.getElementById('microareaFilter').value) {
        var row = state.filteredVisits.find(function (visit) { return String(visit.quarteirao || '') === value; }) ||
          state.allVisits.find(function (visit) { return String(visit.quarteirao || '') === value; });
        if (row && row.microarea) {
          setFilterValue('microareaFilter', row.microarea);
          populateFilters();
        }
      }
      setFilterValue('quarteiraoFilter', value);
      populateFilters();
      setFilterValue('logradouroFilter', '');
    } else if (field === 'logradouro') {
      setFilterValue('logradouroFilter', value);
    } else if (field === 'agente') {
      setFilterValue('agentFilter', value);
    }
    applyFilters();
  }

  function clearDrilldown() {
    ['bairroFilter', 'microareaFilter', 'quarteiraoFilter', 'logradouroFilter', 'agentFilter', 'searchFilter'].forEach(function (id) {
      if (document.getElementById(id)) {
        document.getElementById(id).value = '';
      }
    });
    state.selectedVisitUid = '';
    applyFilters();
  }

  function getSelectedVisit() {
    return state.filteredVisits.find(function (visit) { return visit.uid === state.selectedVisitUid; }) || null;
  }

  function findPropertyForVisit(visit) {
    if (!visit) {
      return null;
    }
    var key = addressKey(visit);
    return state.filteredProperties.find(function (property) {
      return addressKey(property) === key;
    }) || state.allProperties.find(function (property) {
      return addressKey(property) === key;
    }) || null;
  }

  function summarizePropertyComplements(properties) {
    var summary = { Normal: 0, Sequencia: 0, Complemento: 0 };
    (properties || []).forEach(function (property) {
      var complement = normalizePropertyComplement(property && property.complemento);
      if (Object.prototype.hasOwnProperty.call(summary, complement)) {
        summary[complement] += 1;
      }
    });
    return summary;
  }

  function aggregateAgents(visits) {
    var map = {};
    visits.forEach(function (visit) {
      var key = visit.agente || 'Sem nome';
      if (!map[key]) {
        map[key] = {
          nome: key,
          visitas: 0,
          focos: 0,
          depositos: 0,
          depositosComFoco: 0,
          gps: 0,
          retornos: 0,
          score: 0
        };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount;
      map[key].depositos += visit.depositCount;
      map[key].depositosComFoco += visit.depositFocusCount;
      map[key].gps += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
      map[key].retornos += (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') ? 1 : 0;
    });
    return Object.keys(map).map(function (key) {
      var item = map[key];
      item.gpsRate = item.visitas ? Math.round((item.gps / item.visitas) * 100) : 0;
      item.efficiency = (item.visitas * 4) + (item.depositosComFoco * 3) + (item.gps * 2) - (item.retornos * 3);
      return item;
    }).sort(function (a, b) {
      return b.visitas - a.visitas || b.focos - a.focos || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function aggregateByField(visits, field, predicate) {
    var map = {};
    visits.forEach(function (visit) {
      if (predicate && !predicate(visit)) {
        return;
      }
      var key = String(visit[field] || '').trim();
      if (!key) {
        return;
      }
      if (!map[key]) {
        map[key] = { nome: key, visitas: 0, focos: 0, gps: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount || 0;
      map[key].gps += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
    });
    return Object.keys(map).map(function (key) {
      var row = map[key];
      row.taxa = row.visitas ? Math.round((row.focos / row.visitas) * 100) : 0;
      return row;
    }).sort(function (a, b) {
      return b.focos - a.focos || b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function aggregateByDate(visits) {
    var map = {};
    visits.forEach(function (visit) {
      if (!map[visit.data]) {
        map[visit.data] = { data: visit.data, visitas: 0, focos: 0 };
      }
      map[visit.data].visitas += 1;
      map[visit.data].focos += visit.focusCount || 0;
    });
    return Object.keys(map).sort().map(function (key) { return map[key]; });
  }

  function aggregateFocusByDeposit(visits) {
    var map = { A1: 0, A2: 0, B: 0, C: 0, D1: 0, D2: 0, E: 0 };
    visits.forEach(function (visit) {
      String(visit.depositFocusBreakdown || '')
        .split('|')
        .map(function (part) { return part.trim(); })
        .filter(Boolean)
        .forEach(function (part) {
          var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i);
          if (!match) {
            return;
          }
          var code = normalizeCode(match[1]);
          if (Object.prototype.hasOwnProperty.call(map, code)) {
            map[code] += Number(match[2] || 0);
          }
        });
    });
    return Object.keys(map).map(function (code) {
      return { code: code, total: map[code], label: DEPOSITS[code] };
    }).filter(function (row) { return row.total > 0; }).sort(function (a, b) {
      return b.total - a.total || a.code.localeCompare(b.code);
    });
  }

  function computeMetrics(visits) {
    var properties = new Set();
    var latestByProperty = {};
    var gpsCount = 0;
    var deposits = 0;
    var depositsWithFocus = 0;
    var returns = 0;
    var focusVisits = 0;
    var tubitos = 0;
    var opened = 0;
    var closed = 0;
    var recovered = 0;
    var pending = 0;

    visits.forEach(function (visit) {
      var key = addressKey(visit);
      properties.add(key);
      if (!latestByProperty[key]) {
        latestByProperty[key] = visit;
      }
      gpsCount += (visit.gps_lat !== null && visit.gps_lng !== null) ? 1 : 0;
      deposits += visit.depositCount;
      depositsWithFocus += visit.depositFocusCount;
      returns += (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') ? 1 : 0;
      focusVisits += visit.foco === 'Sim' ? 1 : 0;
      tubitos += Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0;
    });

    Object.keys(latestByProperty).forEach(function (key) {
      var visit = latestByProperty[key];
      if (visit.situacao === 'Visitado') {
        opened += 1;
      }
      if (visit.situacao === 'Fechado') {
        closed += 1;
      }
      if (visit.situacao === 'Recuperado') {
        recovered += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        pending += 1;
      }
    });

    return {
      totalVisits: visits.length,
      visitedProperties: properties.size,
      totalProperties: state.filteredProperties.length || properties.size,
      opened: opened,
      closed: closed,
      recovered: recovered,
      pending: pending,
      deposits: deposits,
      depositsWithFocus: depositsWithFocus,
      tubitos: tubitos,
      infestationRate: deposits ? Number(((depositsWithFocus / deposits) * 100).toFixed(1)) : 0,
      gpsCoverage: visits.length ? Math.round((gpsCount / visits.length) * 100) : 0,
      returns: returns,
      focusVisits: focusVisits
    };
  }

  function aggregateComparative(visits, field) {
    var map = {};
    visits.forEach(function (visit) {
      var key = String(visit[field] || '').trim();
      if (!key) {
        return;
      }
      if (!map[key]) {
        map[key] = { nome: key, visitas: 0, focos: 0, fechados: 0, abertos: 0, pendencias: 0, tubitos: 0 };
      }
      map[key].visitas += 1;
      map[key].focos += visit.focusCount || 0;
      map[key].tubitos += Number(visit.tubitos_qtd || visit.tubitosQty || 0) || 0;
      if (visit.situacao === 'Visitado') {
        map[key].abertos += 1;
      }
      if (visit.situacao === 'Fechado') {
        map[key].fechados += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[key].pendencias += 1;
      }
    });
    return Object.keys(map).map(function (key) {
      return map[key];
    }).sort(function (a, b) {
      return b.focos - a.focos || b.pendencias - a.pendencias || b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
  }

  function renderBarCards(containerId, rows, cfg) {
    var node = document.getElementById(containerId);
    if (!rows.length) {
      node.innerHTML = '<div class="empty-state">Sem dados para este recorte.</div>';
      return;
    }
    var max = rows.reduce(function (acc, row) {
      return Math.max(acc, Number(cfg.value(row) || 0));
    }, 1);
    node.innerHTML = rows.slice(0, cfg.limit || rows.length).map(function (row, index) {
      var width = Math.max(8, Math.round((Number(cfg.value(row) || 0) / max) * 100));
      var drillField = cfg.drillField || '';
      var drillValue = drillField && typeof cfg.drillValue === 'function' ? cfg.drillValue(row) : (drillField ? row.nome : '');
      return '<div class="chart-card' + (drillField ? ' is-clickable' : '') + '"' +
        (drillField ? ' data-drill-field="' + escapeHtml(drillField) + '" data-drill-value="' + escapeHtml(String(drillValue || '')) + '"' : '') +
        '><strong>' + escapeHtml((index + 1) + '. ' + cfg.label(row)) + '</strong><div style="margin:8px 0;color:#66727c">' + escapeHtml(cfg.meta(row)) + '</div><div class="rank-row"><span>' + escapeHtml(String(cfg.value(row))) + '</span><div class="bar-track"><div class="bar-fill ' + (cfg.kind || '') + '" style="width:' + width + '%"></div></div><span>' + escapeHtml(cfg.suffix || '') + '</span></div></div>';
    }).join('');
  }

  function renderComparatives(visits) {
    if (!document.getElementById('compareBairros')) {
      return;
    }
    renderBarCards('compareBairros', aggregateComparative(visits, 'bairro'), {
      limit: 6,
      value: function (row) { return row.focos + row.pendencias; },
      label: function (row) { return row.nome; },
      meta: function (row) { return row.visitas + ' visita(s) • ' + row.abertos + ' abertos • ' + row.fechados + ' fechados'; },
      kind: 'is-danger',
      drillField: 'bairro'
    });
    renderBarCards('compareMicroareas', aggregateComparative(visits, 'microarea'), {
      limit: 6,
      value: function (row) { return row.focos + row.pendencias; },
      label: function (row) { return 'MA ' + row.nome; },
      meta: function (row) { return row.visitas + ' visita(s) • ' + row.tubitos + ' tubitos'; },
      kind: 'is-accent',
      drillField: 'microarea'
    });
    renderBarCards('compareQuarteiroes', aggregateComparative(visits, 'quarteirao'), {
      limit: 6,
      value: function (row) { return row.focos + row.pendencias; },
      label: function (row) { return 'Q ' + row.nome; },
      meta: function (row) { return row.visitas + ' visita(s) • ' + row.abertos + ' abertos'; },
      kind: 'is-warn',
      drillField: 'quarteirao'
    });
    renderBarCards('compareLogradouros', aggregateComparative(visits, 'logradouro'), {
      limit: 6,
      value: function (row) { return row.focos + row.pendencias; },
      label: function (row) { return row.nome; },
      meta: function (row) { return row.visitas + ' visita(s) • ' + row.pendencias + ' pendência(s)'; },
      kind: 'is-danger',
      drillField: 'logradouro'
    });
  }

  function renderOnScreenReport(metrics, agents, bairros, microareas, visits) {
    var node = document.getElementById('reportOnScreen');
    if (!node) {
      return;
    }
    var complementSummary = summarizePropertyComplements(state.filteredProperties);
    var items = [];
    items.push('O recorte atual soma ' + metrics.totalVisits + ' visitas, ' + metrics.opened + ' abertos, ' + metrics.closed + ' fechados, ' + metrics.visitedProperties + ' visitados, ' + metrics.totalProperties + ' no total, ' + metrics.recovered + ' recuperados e ' + metrics.pending + ' pendencias.');
    items.push('A taxa de infestacao esta em ' + metrics.infestationRate + '%, com ' + metrics.depositsWithFocus + ' depositos com foco e ' + metrics.tubitos + ' tubitos coletados.');
    if (state.filteredProperties.length) {
      items.push('Na base cadastral filtrada, ' + complementSummary.Normal + ' imovel(is) estao como Normal, ' + complementSummary.Sequencia + ' como Sequencia e ' + complementSummary.Complemento + ' como Complemento.');
    }
    items.push(bairros[0] ? 'O bairro mais sensivel no recorte e ' + bairros[0].nome + '.' : 'Nenhum bairro critico foi identificado no recorte atual.');
    items.push(microareas[0] ? 'A microarea com maior criticidade e a MA ' + microareas[0].nome + '.' : 'Nenhuma microarea critica foi identificada.');
    items.push(agents[0] ? agents[0].nome + ' lidera o recorte em volume operacional.' : 'Ainda nao ha lideranca operacional definida para o recorte.');
    if (!visits.length) {
      items = ['Nenhuma visita encontrada com os filtros atuais.'];
    }
    node.innerHTML = items.map(function (text) {
      return '<div class="insight-card"><strong>Relatorio em tela</strong><div style="margin-top:6px;color:#66727c">' + escapeHtml(text) + '</div></div>';
    }).join('');
  }

  function renderDashboard() {
    var visits = state.filteredVisits;
    var metrics = computeMetrics(visits);
    var agents = aggregateAgents(visits);
    var bairros = aggregateByField(visits, 'bairro', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var microareas = aggregateByField(visits, 'microarea', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var visitsByDay = aggregateByDate(visits);
    var focusByDeposit = aggregateFocusByDeposit(visits);

    document.getElementById('heroTotalVisits').textContent = metrics.totalVisits;
    document.getElementById('heroVisitsSub').textContent = metrics.visitedProperties + ' endereco(s) unicos no recorte.';
    document.getElementById('heroInfestation').textContent = metrics.infestationRate + '%';
    document.getElementById('heroInfestationSub').textContent = metrics.depositsWithFocus + ' deposito(s) com foco de ' + metrics.deposits + ' encontrados.';
    document.getElementById('heroDepositsFocus').textContent = metrics.depositsWithFocus;
    document.getElementById('heroDepositsFocusSub').textContent = 'Reservatorios positivos no recorte filtrado.';
    document.getElementById('heroGpsCoverage').textContent = metrics.gpsCoverage + '%';
    document.getElementById('heroGpsCoverageSub').textContent = metrics.totalVisits ? 'Cobertura sobre ' + metrics.totalVisits + ' visita(s).' : 'Sem rastreabilidade disponivel.';

    if (bairros[0]) {
      document.getElementById('heroPriorityTitle').textContent = bairros[0].nome + ' e o bairro mais critico.';
      document.getElementById('heroPrioritySub').textContent = bairros[0].focos + ' foco(s) em ' + bairros[0].visitas + ' visita(s).';
    } else {
      document.getElementById('heroPriorityTitle').textContent = 'Nenhum territorio critico identificado.';
      document.getElementById('heroPrioritySub').textContent = 'O painel exibira automaticamente o bairro critico quando houver foco.';
    }

    if (agents[0]) {
      document.getElementById('heroActionTitle').textContent = agents[0].nome + ' lidera o volume operacional.';
      document.getElementById('heroActionSub').textContent = metrics.returns ? metrics.returns + ' retorno(s) precisam de acompanhamento adicional.' : 'Sem retornos criticos; priorize cobertura GPS e validacao tecnica.';
    } else {
      document.getElementById('heroActionTitle').textContent = 'Sem encaminhamento automatico.';
      document.getElementById('heroActionSub').textContent = 'Carregue um recorte com producao para gerar leitura gerencial.';
    }

    document.getElementById('panelMetricGrid').innerHTML = [
      metricCard('Abertos', metrics.opened, 'ok'),
      metricCard('Fechados', metrics.closed, 'warn'),
      metricCard('Visitados', metrics.visitedProperties, 'accent'),
      metricCard('Total', metrics.totalProperties, 'accent'),
      metricCard('Recuperados', metrics.recovered, 'accent'),
      metricCard('Pendencias', metrics.pending, 'danger'),
      metricCard('Tubitos', metrics.tubitos, 'warn'),
      metricCard('Taxa de infestacao', metrics.infestationRate + '%', 'danger')
    ].join('');

    renderBarCards('rankingVisits', agents, {
      limit: 5,
      value: function (row) { return row.visitas; },
      label: function (row) { return row.nome; },
      meta: function (row) { return row.depositos + ' deposito(s) • GPS ' + row.gpsRate + '%'; },
      drillField: 'agente',
      drillValue: function (row) { return row.nome; }
    });
    renderBarCards('rankingFocus', agents.slice().sort(function (a, b) { return b.focos - a.focos || b.visitas - a.visitas; }), {
      limit: 5,
      value: function (row) { return row.focos; },
      label: function (row) { return row.nome; },
      meta: function (row) { return row.visitas + ' visita(s) • ' + row.depositosComFoco + ' deposito(s) com foco'; },
      kind: 'is-danger',
      drillField: 'agente',
      drillValue: function (row) { return row.nome; }
    });
    renderBarCards('rankingEfficiency', agents.slice().sort(function (a, b) { return b.efficiency - a.efficiency || b.visitas - a.visitas; }), {
      limit: 5,
      value: function (row) { return row.efficiency; },
      label: function (row) { return row.nome; },
      meta: function (row) { return row.retornos + ' retorno(s) • GPS ' + row.gpsRate + '%'; },
      kind: 'is-accent',
      drillField: 'agente',
      drillValue: function (row) { return row.nome; }
    });
    renderBarCards('chartVisitsByDay', visitsByDay, {
      value: function (row) { return row.visitas; },
      label: function (row) { return formatDateBR(row.data); },
      meta: function (row) { return row.focos + ' foco(s) no dia'; }
    });
    renderBarCards('chartFocusByDeposit', focusByDeposit, {
      value: function (row) { return row.total; },
      label: function (row) { return row.code + ' • ' + row.label; },
      meta: function (row) { return 'Total de depositos com foco nesse tipo'; },
      kind: 'is-danger'
    });

    renderTerritoryHighlights(bairros, microareas, metrics);
    renderDecisionList(metrics, agents, bairros);
    renderTable(visits);
    renderHeatMap(visits);
    renderComparatives(visits);
    renderOnScreenReport(metrics, agents, bairros, microareas, visits);
    renderDrilldownPanel(metrics);
  }

  function metricCard(label, value, kind) {
    return '<div class="metric-card' + (kind === 'danger' ? ' is-danger' : kind === 'accent' ? ' is-accent' : kind === 'warn' ? ' is-warn' : '') + '"><small>' + escapeHtml(label) + '</small><strong>' + escapeHtml(String(value)) + '</strong></div>';
  }

  function renderTerritoryHighlights(bairros, microareas, metrics) {
    var node = document.getElementById('territoryHighlights');
    var items = [];
    items.push(bairros[0] ? 'Bairro prioritário: ' + bairros[0].nome + ' com ' + bairros[0].focos + ' foco(s).' : 'Sem bairro prioritário no recorte.');
    items.push(microareas[0] ? 'Microárea crítica: ' + microareas[0].nome + ' com taxa de foco de ' + microareas[0].taxa + '%.' : 'Sem microárea crítica no recorte.');
    items.push('Cobertura GPS: ' + metrics.gpsCoverage + '% das visitas filtradas.');
    items.push(metrics.returns ? metrics.returns + ' retorno(s) precisam de nova abordagem.' : 'Sem retornos ou recusas no período.');
    node.innerHTML = items.map(function (text) {
      return '<div class="insight-card"><strong>Território</strong><div style="margin-top:6px;color:#66727c">' + escapeHtml(text) + '</div></div>';
    }).join('');
  }

  function renderDecisionList(metrics, agents, bairros) {
    var node = document.getElementById('decisionList');
    var items = [];
    if (metrics.infestationRate >= 20) {
      items.push('Reforçar bloqueio e visita focal no território com maior concentração de focos.');
    }
    if (metrics.gpsCoverage < 85) {
      items.push('Cobertura GPS abaixo do ideal; revisar rotina de captura com a equipe.');
    }
    if (metrics.returns > 0) {
      items.push('Há retornos/fechados no recorte. Planejar agenda de revisita por bairro.');
    }
    if (agents[0]) {
      items.push('Acompanhar o padrão operacional de ' + agents[0].nome + ' para replicar produtividade.');
    }
    if (bairros[0]) {
      items.push('Direcionar ação intensiva para ' + bairros[0].nome + '.');
    }
    if (!items.length) {
      items.push('Sem alertas críticos. Manter monitoramento territorial contínuo.');
    }
    node.innerHTML = items.map(function (text) {
      return '<div class="insight-card"><strong>Decisão sugerida</strong><div style="margin-top:6px;color:#66727c">' + escapeHtml(text) + '</div></div>';
    }).join('');
  }

  function renderTable(visits) {
    var node = document.getElementById('dashboardTable');
    if (!visits.length) {
      node.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#66727c">Nenhuma visita encontrada no recorte.</td></tr>';
      return;
    }
    if (state.selectedVisitUid && !visits.some(function (visit) { return visit.uid === state.selectedVisitUid; })) {
      state.selectedVisitUid = '';
    }
    node.innerHTML = visits.map(function (visit) {
      return '<tr data-visit-row="' + escapeHtml(visit.uid) + '"' + (state.selectedVisitUid === visit.uid ? ' class="is-active-row"' : '') + '>' +
        '<td>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</td>' +
        '<td>' + escapeHtml(visit.agente || '-') + '</td>' +
        '<td><strong>' + escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br><span style="color:#66727c">' + escapeHtml(visit.bairro + ' • MA ' + (visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-')) + '</span>' +
          ((visit.pdfUrl || visit.cardVirtualUrl) ? '<div style="margin-top:8px">' +
            (visit.pdfUrl ? '<a href="' + escapeHtml(visit.pdfUrl) + '" target="_blank" rel="noopener noreferrer">PDF</a>' : '') +
            (visit.pdfUrl && visit.cardVirtualUrl ? ' • ' : '') +
            (visit.cardVirtualUrl ? '<a href="' + escapeHtml(visit.cardVirtualUrl) + '" target="_blank" rel="noopener noreferrer">Cartão</a>' : '') +
          '</div>' : '') +
        '</td>' +
        '<td>' + escapeHtml(visit.situacao) + '</td>' +
        '<td>' + escapeHtml(visit.foco + ' • ' + visit.focusCount) + '</td>' +
        '<td>' + escapeHtml(String(visit.depositCount)) + '</td>' +
        '<td>' + escapeHtml(String(visit.depositFocusCount)) + '</td>' +
        '<td>' + escapeHtml(visit.waterAccess || '-') + '</td>' +
        '<td>' + escapeHtml(visit.gps_lat !== null && visit.gps_lng !== null ? 'Sim' : 'Não') + '</td>' +
      '</tr>';
    }).join('');
  }

  function renderDrilldownPanel(metrics) {
    var node = document.getElementById('drilldownPanel');
    if (!node) {
      return;
    }
    var selected = getSelectedVisit();
    var selectedProperty = selected ? findPropertyForVisit(selected) : null;
    var filters = [
      document.getElementById('bairroFilter').value || 'Todos os bairros',
      document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microareas',
      document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteiroes',
      document.getElementById('logradouroFilter') && document.getElementById('logradouroFilter').value ? document.getElementById('logradouroFilter').value : 'Todas as ruas',
      document.getElementById('agentFilter').value || 'Todos os agentes'
    ].join(' • ');
    var cards = [
      '<div class="insight-card"><strong>Recorte ativo</strong><div style="margin-top:6px;color:#66727c">' + escapeHtml(filters) + '</div></div>',
      '<div class="insight-card"><strong>Resumo do recorte</strong><div style="margin-top:6px;color:#66727c">' + escapeHtml(metrics.totalVisits + ' visita(s) • ' + metrics.pending + ' pendencia(s) • GPS ' + metrics.gpsCoverage + '%') + '</div></div>'
    ];
    if (selected) {
      cards.push('<div class="insight-card"><strong>Visita selecionada</strong><div style="margin-top:6px;color:#66727c">' +
        escapeHtml(selected.logradouro + ', ' + selected.numero + ' • ' + selected.bairro) +
        '</div><div style="margin-top:8px;color:#66727c">' +
        escapeHtml(selected.agente + ' • ' + selected.situacao + ' • ' + selected.foco + ' • ' + selected.focusCount + ' foco(s)') +
        '</div><div style="margin-top:8px;color:#66727c">' +
        escapeHtml((selected.gpsTerritory || 'Sem territorio por GPS') + (selected.gpsQuarteirao ? ' • Q ' + selected.gpsQuarteirao : '') + (selected.qualityFlags ? ' • ' + selected.qualityFlags : '')) +
        '</div>' +
        ((selected.pdfUrl || selected.cardVirtualUrl || selected.routeUrl) ? '<div style="margin-top:10px">' +
          (selected.pdfUrl ? '<a href="' + escapeHtml(selected.pdfUrl) + '" target="_blank" rel="noopener noreferrer">Abrir PDF</a>' : '') +
          (selected.pdfUrl && selected.cardVirtualUrl ? ' • ' : '') +
          (selected.cardVirtualUrl ? '<a href="' + escapeHtml(selected.cardVirtualUrl) + '" target="_blank" rel="noopener noreferrer">Abrir cartao</a>' : '') +
          ((selected.routeUrl && (selected.pdfUrl || selected.cardVirtualUrl)) ? ' • ' : '') +
          (selected.routeUrl ? '<a href="' + escapeHtml(selected.routeUrl) + '" target="_blank" rel="noopener noreferrer">Abrir rota</a>' : '') +
        '</div>' : '') +
      '</div>');
      cards.push('<div class="insight-card"><strong>Cadastro vinculado</strong><div style="margin-top:6px;color:#66727c">' +
        escapeHtml(selectedProperty ?
          ((selectedProperty.tipo || 'Sem tipo') + ' • ' + (selectedProperty.complemento || 'Normal') + ' • ' + getPropertyReferenceText(selectedProperty)) :
          'Nenhum cadastro encontrado para esse endereco no recorte atual.') +
        '</div>' +
        (selectedProperty && (selectedProperty.morador || selectedProperty.telefone) ? '<div style="margin-top:8px;color:#66727c">' +
          escapeHtml((selectedProperty.morador || 'Sem morador informado') + (selectedProperty.telefone ? ' • ' + selectedProperty.telefone : '')) +
        '</div>' : '') +
      '</div>');
    } else {
      cards.push('<div class="insight-card"><strong>Visita selecionada</strong><div style="margin-top:6px;color:#66727c">Clique em uma linha da tabela, em um card comparativo ou em um poligono do mapa para aprofundar a leitura.</div></div>');
      if (state.filteredProperties.length) {
        var complementSummary = summarizePropertyComplements(state.filteredProperties);
        cards.push('<div class="insight-card"><strong>Base cadastral filtrada</strong><div style="margin-top:6px;color:#66727c">' +
          escapeHtml(state.filteredProperties.length + ' cadastro(s) • ' + complementSummary.Normal + ' Normal • ' + complementSummary.Sequencia + ' Sequencia • ' + complementSummary.Complemento + ' Complemento') +
        '</div></div>');
      }
    }
    node.innerHTML = cards.join('');
  }

  function pointInsidePolygon(lat, lng, polygon) {
    var inside = false;
    var i;
    var j;
    if (!Array.isArray(polygon) || polygon.length < 3) {
      return false;
    }
    for (i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      var yi = Number(polygon[i][0]);
      var xi = Number(polygon[i][1]);
      var yj = Number(polygon[j][0]);
      var xj = Number(polygon[j][1]);
      var intersect = ((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi) / ((yj - yi) || 1e-9)) + xi);
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  function territoryMatchesCurrentFilter(feature) {
    var bairroFilter = document.getElementById('bairroFilter');
    var quarteiraoFilter = document.getElementById('quarteiraoFilter');
    var bairro = bairroFilter ? normalizeLabel(bairroFilter.value) : '';
    var quarteirao = quarteiraoFilter ? normalizeQuarteirao(quarteiraoFilter.value) : '';

    if (bairro && feature.territoryKey !== bairro) {
      return false;
    }
    if (quarteirao && feature.quarteiraoKey !== quarteirao) {
      return false;
    }
    return !!(bairro || quarteirao);
  }

  function resolvePolygonForVisit(visit) {
    var visitQuarteirao = normalizeQuarteirao(visit.quarteirao);
    var visitTerritory = normalizeLabel(visit.bairro);
    var directMatch;

    if (visitQuarteirao) {
      directMatch = state.territoryPolygons.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao && (!visitTerritory || feature.territoryKey === visitTerritory);
      });
      if (directMatch[0]) {
        return directMatch[0];
      }

      directMatch = state.territoryPolygons.filter(function (feature) {
        return feature.quarteiraoKey === visitQuarteirao;
      });
      if (directMatch.length === 1) {
        return directMatch[0];
      }
    }

    if (visit.gps_lat === null || visit.gps_lng === null) {
      return null;
    }

    return state.territoryPolygons.find(function (feature) {
      return pointInsidePolygon(visit.gps_lat, visit.gps_lng, feature.coordinates);
    }) || null;
  }

  function aggregateTerritoryMetrics(visits) {
    var map = {};
    var matchedVisits = 0;

    visits.forEach(function (visit) {
      var polygon = resolvePolygonForVisit(visit);
      if (!polygon) {
        return;
      }
      matchedVisits += 1;
      if (!map[polygon.id]) {
        map[polygon.id] = {
          visitas: 0,
          focos: 0,
          pendencias: 0,
          tubitos: 0,
          territoryName: polygon.territoryName,
          quarteiraoName: polygon.name
        };
      }
      map[polygon.id].visitas += 1;
      map[polygon.id].focos += Number(visit.focusCount || 0) || 0;
      map[polygon.id].tubitos += Number(visit.tubitosQty || 0) || 0;
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        map[polygon.id].pendencias += 1;
      }
    });

    return {
      rows: map,
      matchedVisits: matchedVisits
    };
  }

  function buildTerritoryPopup(feature, metrics) {
    var lines = [];
    lines.push('<div class="territory-popup">');
    lines.push('<strong>' + escapeHtml(feature.territoryName || feature.folder || 'Território') + '</strong>');
    lines.push('<span>Quarteirão: ' + escapeHtml(feature.name || '-') + '</span>');
    if (metrics) {
      lines.push('<span>Visitas: ' + escapeHtml(String(metrics.visitas)) + '</span>');
      lines.push('<span>Focos: ' + escapeHtml(String(metrics.focos)) + '</span>');
      lines.push('<span>Pendências: ' + escapeHtml(String(metrics.pendencias)) + '</span>');
      lines.push('<span>Tubitos: ' + escapeHtml(String(metrics.tubitos)) + '</span>');
    } else {
      lines.push('<span>Sem visita filtrada vinculada a este polígono.</span>');
    }
    lines.push('</div>');
    return lines.join('');
  }

  function updateTerritorySummary(territoryStats, highlightedCount) {
    var node = document.getElementById('territoryMapSummary');
    if (!node) {
      return;
    }
    if (!state.territoryPolygons.length) {
      node.textContent = 'A camada territorial ainda não está disponível neste painel.';
      return;
    }
    node.textContent = highlightedCount + ' polígono(s) destacados no recorte. ' +
      territoryStats.matchedVisits + ' visita(s) com correspondência territorial no KMZ. ' +
      'Os quarteirões já estão cartografados; a leitura por microárea opera pelos filtros e dados cadastrados.';
  }

  function renderTerritoryLayers(visits, bounds) {
    var territoryStats;
    hydrateTerritoryData();

    state.territoryPolygonLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.territoryPointLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.territoryPolygonLayers = [];
    state.territoryPointLayers = [];

    territoryStats = aggregateTerritoryMetrics(visits);
    var highlightedCount = 0;

    state.territoryPolygons.forEach(function (feature) {
      var metrics = territoryStats.rows[feature.id] || null;
      var shouldHighlight = !!metrics || territoryMatchesCurrentFilter(feature);
      var polygon = L.polygon(feature.coordinates, {
        color: shouldHighlight ? (metrics && metrics.focos > 0 ? '#c34747' : '#355f9f') : '#8da0ad',
        weight: shouldHighlight ? 2.5 : 1,
        fillColor: shouldHighlight ? (metrics && metrics.focos > 0 ? '#c34747' : '#4c7cc5') : '#dbe4e7',
        fillOpacity: shouldHighlight ? Math.min(0.52, 0.18 + ((metrics ? metrics.visitas : 1) * 0.05)) : 0.06
      });
      polygon.bindPopup(buildTerritoryPopup(feature, metrics));
      polygon.on('click', function () {
        if (feature.territoryName) {
          setFilterValue('bairroFilter', feature.territoryName);
        }
        if (feature.quarteiraoKey) {
          populateFilters();
          setFilterValue('quarteiraoFilter', String(feature.name || '').replace(/^Q\s*[-/]?\s*/i, '').trim());
        }
        state.selectedVisitUid = '';
        applyFilters();
      });
      if (state.mapToggles.polygons) {
        polygon.addTo(state.map);
      }
      state.territoryPolygonLayers.push(polygon);
      if (shouldHighlight) {
        highlightedCount += 1;
        feature.coordinates.forEach(function (coord) {
          bounds.push(coord);
        });
      }
    });

    if (state.mapToggles.points) {
      state.territoryPoints.forEach(function (feature) {
        var marker = L.circleMarker(feature.coordinates, {
          radius: 4.5,
          color: '#ffffff',
          weight: 1.5,
          fillColor: '#183c2c',
          fillOpacity: 0.92
        }).addTo(state.map);
      marker.bindPopup(buildTerritoryPopup(feature, null));
      marker.on('click', function () {
        if (feature.territoryName) {
          setFilterValue('bairroFilter', feature.territoryName);
          state.selectedVisitUid = '';
          applyFilters();
        }
      });
      state.territoryPointLayers.push(marker);
    });
    }

    updateTerritorySummary(territoryStats, highlightedCount);
  }

  function renderHeatMap(visits) {
    if (!state.map) {
      state.map = L.map('heatMap').setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(state.map);
    }
    state.mapLayers.forEach(function (layer) {
      state.map.removeLayer(layer);
    });
    state.mapLayers = [];

    var points = [];
    var heat = {};

    renderTerritoryLayers(visits, points);

    visits.forEach(function (visit) {
      if (visit.gps_lat === null || visit.gps_lng === null) {
        return;
      }
      var key = visit.gps_lat.toFixed(3) + '|' + visit.gps_lng.toFixed(3);
      if (!heat[key]) {
        heat[key] = { lat: visit.gps_lat, lng: visit.gps_lng, weight: 0 };
      }
      heat[key].weight += Math.max(1, visit.focusCount || visit.depositFocusCount || 1);
      if (state.mapToggles.visits) {
        var marker = L.circleMarker([visit.gps_lat, visit.gps_lng], {
        radius: visit.foco === 'Sim' ? 8 : (visit.situacao === 'Fechado' || visit.situacao === 'Recusa' ? 7 : 6),
        color: '#fff',
        weight: 2,
        fillColor: visit.foco === 'Sim' ? '#c34747' : ((visit.situacao === 'Fechado' || visit.situacao === 'Recusa') ? '#c78615' : '#2f7a52'),
        fillOpacity: 0.9
      }).addTo(state.map);
      marker.bindPopup('<strong>' + escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br>' + escapeHtml(visit.bairro) + '<br>Agente: ' + escapeHtml(visit.agente || '-') + '<br>Foco: ' + escapeHtml(visit.foco) + ' • ' + escapeHtml(String(visit.focusCount)));
      marker.on('click', function () {
        state.selectedVisitUid = visit.uid;
        renderDrilldownPanel(computeMetrics(state.filteredVisits));
      });
        state.mapLayers.push(marker);
      }
      points.push([visit.gps_lat, visit.gps_lng]);
    });

    if (state.mapToggles.heat) {
      Object.keys(heat).forEach(function (key) {
      var item = heat[key];
      var circle = L.circle([item.lat, item.lng], {
        radius: 90 + (item.weight * 22),
        color: '#355f9f',
        weight: 1,
        fillColor: '#355f9f',
        fillOpacity: Math.min(0.45, 0.12 + (item.weight * 0.04))
      }).addTo(state.map);
      circle.bindPopup('Mapa de calor: ' + item.weight + ' ocorrência(s) ponderadas.');
      state.mapLayers.push(circle);
        points.push([item.lat, item.lng]);
      });
    }

    if (points.length) {
      state.map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    } else {
      state.map.setView(CONFIG.MAP_CENTER, CONFIG.MAP_ZOOM);
    }
    setTimeout(function () {
      state.map.invalidateSize();
    }, 120);
  }

  function buildReportHtml(mode) {
    var visits = state.filteredVisits;
    var metrics = computeMetrics(visits);
    var agents = aggregateAgents(visits);
    var bairros = aggregateByField(visits, 'bairro', function (visit) { return visit.depositFocusCount > 0 || visit.foco === 'Sim'; });
    var complementSummary = summarizePropertyComplements(state.filteredProperties);
    var range = getDateRange();
    var filterSummary = [
      document.getElementById('bairroFilter').value || 'Todos os bairros',
      document.getElementById('microareaFilter').value ? 'MA ' + document.getElementById('microareaFilter').value : 'Todas as microareas',
      document.getElementById('quarteiraoFilter') && document.getElementById('quarteiraoFilter').value ? 'Q ' + document.getElementById('quarteiraoFilter').value : 'Todos os quarteiroes',
      document.getElementById('logradouroFilter') && document.getElementById('logradouroFilter').value ? document.getElementById('logradouroFilter').value : 'Todas as ruas',
      document.getElementById('agentFilter').value || 'Todos os agentes'
    ].join(' • ');
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatorio ACE</title><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1b252e}h1,h2{color:#183c2c}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #d6dfe2;padding:8px;text-align:left;vertical-align:top}th{background:#f4f8f6}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:18px 0}.tile{border:1px solid #d6dfe2;border-radius:14px;padding:12px;background:#f8fbf9}.tile strong{display:block;font-size:26px;color:#183c2c}.note{margin-top:8px;color:#66727c}</style></head><body>' +
      '<h1>' + escapeHtml(mode === 'individual' ? 'Relatorio individual do recorte' : 'Relatorio executivo ACE') + '</h1>' +
      '<div class="note">Periodo: ' + escapeHtml(range.start + ' a ' + range.end) + ' • Filtros: ' + escapeHtml(filterSummary) + '</div>' +
      '<div class="grid">' +
        metricCard('Abertos', metrics.opened, 'ok') +
        metricCard('Fechados', metrics.closed, 'warn') +
        metricCard('Visitados', metrics.visitedProperties, 'accent') +
        metricCard('Total', metrics.totalProperties, 'accent') +
        metricCard('Pendencias', metrics.pending, 'danger') +
        metricCard('Recuperados', metrics.recovered, 'accent') +
        metricCard('Tubitos', metrics.tubitos, 'warn') +
        metricCard('Taxa de infestacao', metrics.infestationRate + '%', 'danger') +
        metricCard('Depositos encontrados', metrics.deposits, 'accent') +
        metricCard('Depositos com foco', metrics.depositsWithFocus, 'danger') +
        metricCard('Cobertura GPS', metrics.gpsCoverage + '%', 'accent') +
      '</div>' +
      '<h2>Leitura executiva</h2><p>' + escapeHtml(
        (bairros[0] ? bairros[0].nome + ' e o territorio mais critico do recorte. ' : 'Nao ha territorio critico identificado. ') +
        (agents[0] ? agents[0].nome + ' lidera a producao por volume. ' : '') +
        (metrics.returns ? metrics.returns + ' retorno(s) exigem nova abordagem. ' : 'Sem retornos criticos no periodo. ')
      ) + '</p>' +
      '<p>' + escapeHtml(
        state.filteredProperties.length ?
          ('Base cadastral filtrada: ' + state.filteredProperties.length + ' imovel(is), sendo ' + complementSummary.Normal + ' Normal, ' + complementSummary.Sequencia + ' Sequencia e ' + complementSummary.Complemento + ' Complemento.') :
          'Nao ha cadastro de imoveis no recorte atual.'
      ) + '</p>' +
      '<h2>Visitas do recorte</h2>' +
      '<table><thead><tr><th>Data/Hora</th><th>Agente</th><th>Endereco</th><th>Situacao</th><th>Foco</th><th>Depositos com foco</th><th>Caixa d\'agua</th></tr></thead><tbody>' +
        visits.map(function (visit) {
          return '<tr><td>' + escapeHtml(formatDateBR(visit.data) + ' ' + visit.hora) + '</td><td>' + escapeHtml(visit.agente || '-') + '</td><td>' + escapeHtml(visit.logradouro + ', ' + visit.numero + ' • ' + visit.bairro) + '</td><td>' + escapeHtml(visit.situacao) + '</td><td>' + escapeHtml(visit.foco + ' • ' + visit.focusCount) + '</td><td>' + escapeHtml(String(visit.depositFocusCount)) + '</td><td>' + escapeHtml(visit.waterAccess || '-') + '</td></tr>';
        }).join('') +
      '</tbody></table></body></html>';
  }

  function openReport(mode) {
    if (!state.filteredVisits.length) {
      setBanner('Não há dados filtrados para gerar relatório.', 'danger');
      return;
    }
    var win = window.open('', '_blank');
    if (!win) {
      setBanner('Não foi possível abrir a janela de relatório.', 'danger');
      return;
    }
    win.document.write(buildReportHtml(mode));
    win.document.close();
    win.focus();
    setTimeout(function () { win.print(); }, 700);
  }

  function toggleAutoRefresh() {
    var button = document.getElementById('toggleAutoRefreshBtn');
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
      button.textContent = 'Autoatualização';
      setBanner('Autoatualização desligada.', 'warn');
      return;
    }
    state.autoTimer = setInterval(loadDashboard, AUTO_INTERVAL);
    button.textContent = 'Autoatualização ativa';
    setBanner('Autoatualização ligada.', 'ok');
  }

  function bindEvents() {
    document.getElementById('loadDashboardBtn').addEventListener('click', loadDashboard);
    document.getElementById('toggleAutoRefreshBtn').addEventListener('click', toggleAutoRefresh);
    document.getElementById('reportExecutiveBtn').addEventListener('click', function () { openReport('executive'); });
    document.getElementById('reportIndividualBtn').addEventListener('click', function () { openReport('individual'); });
    if (document.getElementById('clearDrilldownBtn')) {
      document.getElementById('clearDrilldownBtn').addEventListener('click', clearDrilldown);
    }
    [
      { id: 'toggleHeatLayer', key: 'heat' },
      { id: 'toggleVisitMarkers', key: 'visits' },
      { id: 'togglePolygonLayer', key: 'polygons' },
      { id: 'togglePointLayer', key: 'points' }
    ].forEach(function (item) {
      var input = document.getElementById(item.id);
      if (!input) {
        return;
      }
      input.checked = !!state.mapToggles[item.key];
      input.addEventListener('change', function () {
        state.mapToggles[item.key] = !!input.checked;
        renderHeatMap(state.filteredVisits);
      });
    });
    ['bairroFilter', 'microareaFilter', 'quarteiraoFilter', 'logradouroFilter', 'agentFilter', 'dateStart', 'dateEnd'].forEach(function (id) {
      if (document.getElementById(id)) {
        document.getElementById(id).addEventListener('change', applyFilters);
      }
    });
    if (document.getElementById('searchFilter')) {
      document.getElementById('searchFilter').addEventListener('input', applyFilters);
    }
    document.addEventListener('click', function (event) {
      var drillCard = event.target.closest('[data-drill-field]');
      var visitRow = event.target.closest('[data-visit-row]');
      if (drillCard) {
        applyDrilldown(drillCard.getAttribute('data-drill-field'), drillCard.getAttribute('data-drill-value'));
      }
      if (visitRow) {
        state.selectedVisitUid = visitRow.getAttribute('data-visit-row') || '';
        renderDrilldownPanel(computeMetrics(state.filteredVisits));
      }
    });
  }

  function initDates() {
    var today = new Date().toISOString().slice(0, 10);
    document.getElementById('dateStart').value = today;
    document.getElementById('dateEnd').value = today;
  }

  function init() {
    ensurePanelLayout();
    hydrateTerritoryData();
    initDates();
    bindEvents();
    setChip('panelModeChip', isApiConfigured() ? 'Google Sheets' : 'Modo local', isApiConfigured() ? 'ok' : 'warn');
    setChip('panelStatusChip', 'Aguardando leitura', 'accent');
    loadDashboard();
  }

  init();
}());

