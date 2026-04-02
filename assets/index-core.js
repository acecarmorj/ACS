(function () {
  'use strict';

  var app = window.ACSField = window.ACSField || {};

  app.CONFIG = {
    SHEETS_WEBAPP_URL: (window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.API_URL) || 'COLE_AQUI_A_URL_DO_WEB_APP',
    AUTO_SYNC: true,
    APP_VERSION: 'ACE Definitivo v3',
    BAIRROS: [
      'Centro', 'Botafogo', 'Jd Centenário', 'Val Paraíso', 'Boa Ideia', 'Paraisópolis',
      'Ave Maria', 'Todos os Santos', 'Progresso', 'Caixa d\'Água', 'Ulisses Lemgruber',
      'Sto Antônio', 'Vale do Sol', 'Sol Maior', 'Bacelar', 'Emboque', 'São Dimas',
      'Amizade', 'Influência', 'Light', 'Córrego da Prata', 'Aurora', 'Bom Pastor',
      'Porto Velho', 'Estrada Nova', 'Paquequer', 'Outro'
    ],
    PROPERTY_TYPES: [
      'Residencial', 'Comercial', 'Terreno Baldio', 'Ponto Estratégico', 'Órgão Público', 'Outro'
    ],
    PROPERTY_COMPLEMENTS: ['Normal', 'Sequência', 'Complemento'],
    LARVICIDAS: ['Nenhum', 'Bti', 'Temephos (Abate)', 'Pyriproxyfen', 'Spinosad'],
    ADULTICIDAS: ['Nenhum', 'Malathion', 'Deltametrina', 'Ciflutrina'],
    QUICK_NOTES: [
      'Sem foco',
      'Morador orientado',
      'Necessita retorno',
      'Imóvel fechado',
      'Retorno realizado',
      'Caixa d\'água sem tampa',
      'Tem cachorro bravo',
      'Quintal com muito mato',
      'Solicitou nova visita pela manhã'
    ],
    AGENT_ROLES: ['ACE', 'Supervisor', 'Administrador'],
    ADMIN_ROLES: ['Supervisor', 'Administrador'],
    MAP_CENTER: [-21.9325, -42.0275],
    MAP_ZOOM: 13,
    WEATHER: {
      city: 'Carmo/RJ',
      latitude: -21.9325,
      longitude: -42.0275,
      timezone: 'America/Sao_Paulo',
      refreshMs: 30 * 60 * 1000
    }
  };

  app.DEPOSITS = {
    A1: 'Caixa d\'água / tambor',
    A2: 'Pneu / entulho',
    B: 'Vaso / garrafa',
    C: 'Piscina / cisterna',
    D1: 'Lixo orgânico',
    D2: 'Obra / construção',
    E: 'Natural / bromélia'
  };

  app.CONFIG.BAIRROS = [
    'Centro', 'Botafogo', 'Jardim Centenário', 'Val Paraíso', 'Boa Ideia', 'Paraisópolis',
    'Ave Maria', 'Todos os Santos', 'Progresso', 'Caixa d\'Água', 'Ulisses Lemgruber',
    'Santo Antônio', 'Vale do Sol', 'Sol Maior', 'Bacelar', 'Emboque', 'São Dimas',
    'Amizade', 'Almas do Mato', 'Aurora', 'Bom Pastor', 'Estrada Nova', 'Paquequer',
    'Porto Velho do Cunha (PVC)', 'Barra de São Francisco', 'Córrego da Prata',
    'Ilha dos Pombos (Light)', 'Influência', 'Outro'
  ];

  app.rangeQuarteiroes = function (start, end, extras) {
    var values = [];
    var current;
    for (current = Number(start || 1); current <= Number(end || 0); current += 1) {
      values.push(String(current).padStart(2, '0'));
    }
    return values.concat(extras || []);
  };

  app.CONFIG.MICROAREA_PRESETS = [
    { value: 'M01 - Centro', quarteiroes: app.rangeQuarteiroes(1, 23) },
    { value: 'M02 - Boa Ideia', quarteiroes: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '9/01', '10', '11', '12', '13', '13/1', '14', '15'] },
    { value: 'M03 - Botafogo', quarteiroes: app.rangeQuarteiroes(1, 10) },
    { value: 'M04 - Caixa d\'Água', quarteiroes: app.rangeQuarteiroes(1, 17) },
    { value: 'M05 - Jardim Centenário', quarteiroes: app.rangeQuarteiroes(1, 22, ['1/01', '6/01', '17/01']) },
    { value: 'M06 - Ulisses Lemgruber', quarteiroes: app.rangeQuarteiroes(1, 12) },
    { value: 'M07 - Progresso', quarteiroes: app.rangeQuarteiroes(1, 13) },
    { value: 'M08 - Val Paraíso', quarteiroes: app.rangeQuarteiroes(1, 5) },
    { value: 'PVC - Porto Velho do Cunha', quarteiroes: app.rangeQuarteiroes(1, 15) },
    { value: 'BSF - Barra de São Francisco', quarteiroes: app.rangeQuarteiroes(1, 15) },
    { value: 'CDP - Córrego da Prata', quarteiroes: app.rangeQuarteiroes(1, 15) },
    { value: 'IDP - Ilha dos Pombos (Light)', quarteiroes: app.rangeQuarteiroes(1, 15) },
    { value: 'INF - Influência', quarteiroes: app.rangeQuarteiroes(1, 15) }
  ];

  app.STORAGE_KEYS = {
    agents: ['ace_agents_v12'],
    session: ['ace_session_v12'],
    properties: ['ace_properties_v12'],
    visits: ['ace_visits_v12'],
    lastArea: ['ace_last_area_v12'],
    logs: ['ace_logs_v12'],
    systemState: ['ace_system_state_v12']
  };

  app.state = {
    currentAgent: null,
    selectedScreen: 'visita',
    selectedPropertyId: '',
    editingPropertyId: '',
    editingVisitId: '',
    propertyQuickFilter: 'all',
    syncInFlight: false,
    territoryHint: null,
    map: null,
    mapLayers: [],
    visit: null,
    weatherLoading: false,
    weatherTimer: null
  };

  app.emptyDepositMap = function () {
    var map = {};
    Object.keys(app.DEPOSITS).forEach(function (code) {
      map[code] = 0;
    });
    return map;
  };

  app.todayISO = function () {
    var now = new Date();
    return now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0');
  };

  app.nowHHMM = function () {
    var now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  };

  app.normalizeAreaCode = function (value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/');
  };

  app.compareAreaCode = function (a, b) {
    return app.normalizeAreaCode(a).localeCompare(app.normalizeAreaCode(b), 'pt-BR', {
      numeric: true,
      sensitivity: 'base'
    });
  };

  app.createEmptyVisit = function () {
    return {
      data: app.todayISO(),
      hora: app.nowHHMM(),
      microarea: '',
      quarteirao: '',
      situacao: 'Visitado',
      focusFound: 'Não',
      focusQty: 0,
      waterAccess: '',
      tubitosQty: 0,
      larvicida: 'Nenhum',
      larvicidaQty: 0,
      adulticida: 'Nenhum',
      adulticidaQty: 0,
      cardCode: '',
      obs: '',
      gps: null,
      gpsTerritory: '',
      gpsQuarteirao: '',
      photoDataUrl: '',
      photoUrl: '',
      signatureDataUrl: '',
      signatureSignedAt: '',
      pdfUrl: '',
      pdfDriveId: '',
      routeUrl: '',
      qualityFlags: [],
      depositCounts: app.emptyDepositMap(),
      depositFocusCounts: app.emptyDepositMap()
    };
  };

  app.state.visit = app.createEmptyVisit();

  app.escapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  app.normalizeChoice = function (value) {
    if (value === true) {
      return 'Sim';
    }
    if (value === false) {
      return 'Não';
    }
    var label = String(value || '').trim().toLowerCase();
    if (!label) {
      return '';
    }
    return (label === 'sim' || label === 's' || label === 'true' || label === 'yes') ? 'Sim' : 'Não';
  };

  app.normalizeStatus = function (value) {
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
    if (label.indexOf('pend') > -1) {
      return 'Fechado';
    }
    return 'Visitado';
  };

  app.normalizeCardCode = function (value) {
    return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  };

  app.normalizeCoord = function (value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    var num = Number(String(value).replace(',', '.'));
    return isFinite(num) ? num : null;
  };

  app.normalizeGps = function (gps, lat, lng, acc) {
    var gpsLat = gps && gps.lat != null ? app.normalizeCoord(gps.lat) : app.normalizeCoord(lat);
    var gpsLng = gps && gps.lng != null ? app.normalizeCoord(gps.lng) : app.normalizeCoord(lng);
    if (gpsLat === null || gpsLng === null) {
      return null;
    }
    return {
      lat: gpsLat,
      lng: gpsLng,
      accuracy: Math.max(0, Number((gps && gps.accuracy) || acc || 0))
    };
  };

  app.totalFromMap = function (map) {
    return Object.keys(map || {}).reduce(function (sum, key) {
      return sum + Math.max(0, Number(map[key] || 0));
    }, 0);
  };

  app.compactMap = function (map) {
    return Object.keys(map || {})
      .filter(function (code) { return Number(map[code] || 0) > 0; })
      .map(function (code) { return code + '(' + Number(map[code] || 0) + ')'; });
  };

  app.normalizeDepositMap = function (map, compact) {
    var result = app.emptyDepositMap();
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      Object.keys(app.DEPOSITS).forEach(function (code) {
        result[code] = Math.max(0, Number(map[code] || 0));
      });
    }
    if (compact) {
      String(compact)
        .split('|')
        .map(function (part) { return part.trim(); })
        .filter(Boolean)
        .forEach(function (part) {
          var match = part.match(/^([A-Z0-9]+)\((\d+)\)$/i);
          if (!match) {
            return;
          }
          var code = String(match[1] || '').toUpperCase();
          if (Object.prototype.hasOwnProperty.call(result, code)) {
            result[code] = Math.max(result[code], Number(match[2] || 0));
          }
        });
    }
    return result;
  };

  app.createId = function (prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
  };

  app.formatDateBR = function (value) {
    if (!value) {
      return '-';
    }
    var parts = String(value).split('-');
    return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : String(value);
  };

  app.formatTimeHM = function (value) {
    if (!value) {
      return '--:--';
    }
    var text = String(value).trim();
    var match = text.match(/T(\d{2}):(\d{2})/);
    if (match) {
      return match[1] + ':' + match[2];
    }
    match = text.match(/(\d{2}):(\d{2})/);
    if (match) {
      return match[1] + ':' + match[2];
    }
    return text;
  };

  app.addressKey = function (row) {
    return [
      String(row.bairro || '').trim().toLowerCase(),
      String(row.logradouro || '').trim().toLowerCase(),
      String(row.numero || '').trim().toLowerCase()
    ].join('|');
  };

  app.sanitizeHour = function (value) {
    var text = String(value || '').trim();
    if (!text) {
      return app.nowHHMM();
    }
    return text.length >= 5 ? text.slice(0, 5) : text;
  };

  app.calcDistanceMeters = function (lat1, lng1, lat2, lng2) {
    if ([lat1, lng1, lat2, lng2].some(function (item) { return item === null || item === undefined || item === ''; })) {
      return null;
    }
    var pLat1 = Number(lat1);
    var pLng1 = Number(lng1);
    var pLat2 = Number(lat2);
    var pLng2 = Number(lng2);
    if (![pLat1, pLng1, pLat2, pLng2].every(isFinite)) {
      return null;
    }
    var toRad = function (value) { return value * Math.PI / 180; };
    var earth = 6371000;
    var dLat = toRad(pLat2 - pLat1);
    var dLng = toRad(pLng2 - pLng1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(pLat1)) * Math.cos(toRad(pLat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  app.formatDistance = function (value) {
    if (value === null || value === undefined) {
      return 'sem GPS';
    }
    return value < 1000 ? value + ' m' : (value / 1000).toFixed(1).replace('.', ',') + ' km';
  };

  app.compareVisitDesc = function (a, b) {
    return (String(b.data || '') + ' ' + String(b.hora || '')).localeCompare(String(a.data || '') + ' ' + String(a.hora || ''));
  };

  app.aggregateByField = function (rows, field, predicate) {
    var map = {};
    rows.forEach(function (row) {
      if (predicate && !predicate(row)) {
        return;
      }
      var key = String(row[field] || '').trim();
      if (!key) {
        return;
      }
      map[key] = (map[key] || 0) + 1;
    });
    return Object.keys(map).map(function (key) {
      return { name: key, total: map[key] };
    }).sort(function (a, b) {
      return b.total - a.total || a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
    });
  };

  app.hashText = function (text) {
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) {
      return Promise.resolve(String(text || ''));
    }
    return window.crypto.subtle.digest('SHA-256', new window.TextEncoder().encode(String(text || '')))
      .then(function (digest) {
        return Array.from(new Uint8Array(digest)).map(function (item) {
          return item.toString(16).padStart(2, '0');
        }).join('');
      });
  };

  app.buildCardUrl = function (cardCode) {
    if (!cardCode) {
      return '';
    }
    var configuredBase = String((window.ACS_RUNTIME_CONFIG && window.ACS_RUNTIME_CONFIG.APP_BASE_URL) || '').trim();
    if (configuredBase) {
      try {
        return new URL('cartao.html?codigo=' + encodeURIComponent(cardCode), configuredBase.replace(/\/?$/, '/')).toString();
      } catch (configuredErr) {}
    }
    try {
      var current = new URL(window.location.href);
      current.pathname = current.pathname.replace(/[^/]+$/, 'cartao.html');
      current.search = '?codigo=' + encodeURIComponent(cardCode);
      return current.toString();
    } catch (err) {
      return 'cartao.html?codigo=' + encodeURIComponent(cardCode);
    }
  };

  app.normalizeTitleText = function (value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(function (part) {
        if (!part) {
          return '';
        }
        if (/^(da|de|do|das|dos|e)$/i.test(part)) {
          return part.toLowerCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      })
      .join(' ');
  };

  app.normalizeFreeText = function (value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
  };

  app.normalizeLabel = function (value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['`´]/g, ' ')
      .replace(/[^a-z0-9/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  app.normalizeQuarteiraoKey = function (value) {
    return app.normalizeLabel(String(value || '').replace(/^q\s*[-/]?\s*/i, ''));
  };

  app.isManagerRole = function (role) {
    return app.CONFIG.ADMIN_ROLES.indexOf(String(role || '').trim()) > -1;
  };

  app.readLogs = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.logs, []);
    return Array.isArray(rows) ? rows : [];
  };

  app.saveLogs = function (rows) {
    app.savePrimary('logs', Array.isArray(rows) ? rows : []);
  };

  app.readSystemState = function () {
    return app.loadFirst(app.STORAGE_KEYS.systemState, {
      lastSyncAt: '',
      lastSyncError: '',
      lastBackupAt: '',
      lastBootstrapAt: '',
      pendingSync: false,
      pendingReason: '',
      weatherCache: null,
      lastWeatherError: ''
    }) || {
      lastSyncAt: '',
      lastSyncError: '',
      lastBackupAt: '',
      lastBootstrapAt: '',
      pendingSync: false,
      pendingReason: '',
      weatherCache: null,
      lastWeatherError: ''
    };
  };

  app.saveSystemState = function (row) {
    var current = app.readSystemState();
    app.savePrimary('systemState', Object.assign({}, current, row || {}));
  };

  app.addLog = function (scope, action, targetUid, details) {
    var logs = app.readLogs();
    logs.unshift({
      uid: app.createId('LOG'),
      scope: String(scope || '').trim(),
      action: String(action || '').trim(),
      actor_name: app.state.currentAgent ? app.state.currentAgent.nome : '',
      actor_matricula: app.state.currentAgent ? app.state.currentAgent.matricula : '',
      target_uid: String(targetUid || '').trim(),
      details: String(details || '').trim(),
      createdAt: new Date().toISOString()
    });
    app.saveLogs(logs.slice(0, 400));
  };

  app.getUnsyncedVisits = function () {
    return app.readVisits().filter(function (visit) { return !visit.synced; });
  };

  app.getServiceHealth = function () {
    var system = app.readSystemState();
    var unsynced = app.getUnsyncedVisits();
    return {
      offline: typeof navigator !== 'undefined' && navigator.onLine === false,
      syncInFlight: !!app.state.syncInFlight,
      queue: unsynced.length,
      lastSyncAt: system.lastSyncAt || '',
      lastSyncError: system.lastSyncError || '',
      lastBackupAt: system.lastBackupAt || '',
      lastBootstrapAt: system.lastBootstrapAt || '',
      pendingSync: !!system.pendingSync,
      pendingReason: system.pendingReason || '',
      weatherCache: system.weatherCache || null,
      lastWeatherError: system.lastWeatherError || ''
    };
  };

  app.readWeatherCache = function () {
    var system = app.readSystemState();
    return system && system.weatherCache && typeof system.weatherCache === 'object' ? system.weatherCache : null;
  };

  app.getWeatherCodeLabel = function (code) {
    var weatherCode = Number(code);
    var labels = {
      0: 'Ceu limpo',
      1: 'Quase limpo',
      2: 'Sol entre nuvens',
      3: 'Nublado',
      45: 'Nevoeiro',
      48: 'Nevoeiro gelado',
      51: 'Garoa fraca',
      53: 'Garoa moderada',
      55: 'Garoa intensa',
      56: 'Garoa congelante',
      57: 'Garoa congelante forte',
      61: 'Chuva fraca',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      66: 'Chuva congelante',
      67: 'Chuva congelante forte',
      71: 'Neve fraca',
      73: 'Neve moderada',
      75: 'Neve forte',
      77: 'Graos de neve',
      80: 'Pancadas fracas',
      81: 'Pancadas moderadas',
      82: 'Pancadas fortes',
      85: 'Pancadas de neve',
      86: 'Neve intensa',
      95: 'Trovoadas',
      96: 'Trovoadas com granizo',
      99: 'Trovoadas severas'
    };
    return labels[weatherCode] || 'Condicao variavel';
  };

  app.getWeatherAlert = function (snapshot) {
    if (!snapshot) {
      return { label: 'Sem leitura', kind: 'warn' };
    }
    if (Number(snapshot.rainChance || 0) >= 70) {
      return { label: 'Alerta de chuva', kind: 'danger' };
    }
    if (Number(snapshot.uvMax || 0) >= 8) {
      return { label: 'UV alto', kind: 'warn' };
    }
    if (Number(snapshot.temperature || 0) >= 32) {
      return { label: 'Calor forte', kind: 'warn' };
    }
    return { label: 'Sem alerta', kind: 'ok' };
  };

  app.normalizeWeatherSnapshot = function (payload) {
    if (!payload || !payload.current || !payload.daily) {
      return null;
    }
    var current = payload.current || {};
    var daily = payload.daily || {};
    var temperature = Number(current.temperature_2m || 0);
    var humidity = Math.max(0, Math.round(Number(current.relative_humidity_2m || 0)));
    var weatherCode = Number(current.weather_code || 0);
    var maxTemp = Array.isArray(daily.temperature_2m_max) ? Number(daily.temperature_2m_max[0] || temperature) : temperature;
    var rainChance = Array.isArray(daily.precipitation_probability_max) ? Math.max(0, Math.round(Number(daily.precipitation_probability_max[0] || 0))) : 0;
    var uvMax = Array.isArray(daily.uv_index_max) ? Number(daily.uv_index_max[0] || 0) : 0;
    var weatherLabel = app.getWeatherCodeLabel(weatherCode);
    var snapshot = {
      city: app.CONFIG.WEATHER.city,
      temperature: Number(temperature.toFixed(1)),
      humidity: humidity,
      weatherCode: weatherCode,
      weatherLabel: weatherLabel,
      maxTemp: Number(maxTemp.toFixed(1)),
      rainChance: rainChance,
      uvMax: Number(uvMax.toFixed(1)),
      updatedAt: String(current.time || new Date().toISOString()).trim(),
      headline: Math.round(temperature) + '°C • ' + weatherLabel,
      meta: 'Chuva ' + rainChance + '% • UV ' + Number(uvMax.toFixed(1)) + ' • Max ' + Math.round(maxTemp) + '°C • Umid. ' + humidity + '%'
    };
    var alert = app.getWeatherAlert(snapshot);
    snapshot.alertLabel = alert.label;
    snapshot.alertKind = alert.kind;
    return snapshot;
  };

  app.buildWeatherUrl = function () {
    var cfg = app.CONFIG.WEATHER || {};
    return 'https://api.open-meteo.com/v1/forecast?' +
      'latitude=' + encodeURIComponent(String(cfg.latitude || 0)) +
      '&longitude=' + encodeURIComponent(String(cfg.longitude || 0)) +
      '&current=temperature_2m,relative_humidity_2m,weather_code' +
      '&daily=temperature_2m_max,precipitation_probability_max,uv_index_max' +
      '&timezone=' + encodeURIComponent(String(cfg.timezone || 'America/Sao_Paulo')) +
      '&forecast_days=1';
  };

  app.isWeatherCacheFresh = function (snapshot) {
    var refreshMs = Number((app.CONFIG.WEATHER && app.CONFIG.WEATHER.refreshMs) || 0);
    var updatedAt = snapshot && snapshot.updatedAt ? Date.parse(snapshot.updatedAt) : 0;
    return !!(refreshMs && updatedAt && (Date.now() - updatedAt) < refreshMs);
  };

  app.hydrateTerritorySource = function () {
    var source = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
    if (app._territoryCache && app._territoryCache.source === source) {
      return app._territoryCache;
    }
    var polygons = (source.polygons || []).map(function (feature, index) {
      var folderName = String(feature.folder || '').trim();
      var territoryName = app.normalizeLabel(folderName) === 'distritos'
        ? String(feature.name || folderName).trim()
        : String(folderName || feature.name || '').trim();
      return {
        id: String(feature.id || ('poly-' + index)),
        name: String(feature.name || '').trim(),
        territoryName: territoryName,
        territoryKey: app.normalizeLabel(territoryName),
        quarteiraoKey: app.normalizeQuarteiraoKey(feature.name),
        coordinates: Array.isArray(feature.coordinates) ? feature.coordinates : []
      };
    }).filter(function (feature) {
      return feature.coordinates.length > 2;
    });
    app._territoryCache = {
      source: source,
      polygons: polygons
    };
    return app._territoryCache;
  };

  app.pointInsidePolygon = function (lat, lng, polygon) {
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
  };

  app.resolveTerritoryByGps = function (gps) {
    if (!gps || gps.lat == null || gps.lng == null) {
      return null;
    }
    var cache = app.hydrateTerritorySource();
    var polygon = cache.polygons.find(function (feature) {
      return app.pointInsidePolygon(Number(gps.lat), Number(gps.lng), feature.coordinates);
    }) || null;
    if (!polygon) {
      return null;
    }
    return {
      territoryName: polygon.territoryName,
      territoryKey: polygon.territoryKey,
      quarteiraoName: polygon.name,
      quarteirao: app.normalizeAreaCode(String(polygon.name || '').replace(/^Q\s*[-/]?\s*/i, '')),
      polygonId: polygon.id
    };
  };

  app.buildRouteUrl = function (property) {
    if (!property) {
      return '';
    }
    var label = [property.logradouro, property.numero, property.bairro, 'Carmo RJ'].filter(Boolean).join(', ');
    if (property.lastLat != null && property.lastLng != null) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(String(property.lastLat) + ',' + String(property.lastLng));
    }
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(label);
  };

  app.getDuplicateProperties = function (record, rows) {
    var list = Array.isArray(rows) ? rows : app.readProperties();
    if (!record) {
      return [];
    }
    var targetKey = String(record.address_key || app.addressKey(record)).trim();
    var targetStreet = app.normalizeLabel(record.logradouro || '');
    var targetNumber = app.normalizeLabel(record.numero || '');
    var targetBairro = app.normalizeLabel(record.bairro || '');
    return list.filter(function (property) {
      if (!property || property.uid === record.uid) {
        return false;
      }
      if (property.address_key === targetKey) {
        return true;
      }
      return app.normalizeLabel(property.logradouro || '') === targetStreet &&
        app.normalizeLabel(property.numero || '') === targetNumber &&
        app.normalizeLabel(property.bairro || '') === targetBairro;
    });
  };

  app.computePropertyQuality = function (property, rows) {
    var flags = [];
    var duplicates = app.getDuplicateProperties(property, rows);
    if (!property.microarea) {
      flags.push('Sem microárea');
    }
    if (!property.quarteirao) {
      flags.push('Sem quarteirão');
    }
    if (!property.referencia) {
      flags.push('Sem referência');
    }
    if (!property.lastLat || !property.lastLng) {
      flags.push('Sem GPS');
    }
    if (duplicates.length) {
      flags.push('Possível duplicidade');
    }
    return {
      flags: flags,
      status: flags.length ? (duplicates.length ? 'Atenção alta' : 'Atenção') : 'OK',
      duplicates: duplicates
    };
  };

  app.computeVisitQuality = function (visit) {
    var flags = [];
    if (!visit.microarea) {
      flags.push('Sem microárea');
    }
    if (!visit.quarteirao) {
      flags.push('Sem quarteirão');
    }
    if (!visit.gps) {
      flags.push('Sem GPS');
    }
    if (!visit.photoDataUrl && !visit.photoUrl) {
      flags.push('Sem foto');
    }
    if ((visit.situacao === 'Visitado' || visit.situacao === 'Recuperado') && !visit.signatureDataUrl) {
      flags.push('Sem assinatura');
    }
    if (visit.focusFound === 'Sim' && !visit.cardCode) {
      flags.push('Sem código do cartão');
    }
    return flags;
  };

  app.buildVisitReportHtml = function (visit, property) {
    var currentProperty = property || null;
    var qualityFlags = app.computeVisitQuality(visit);
    var address = currentProperty
      ? [currentProperty.logradouro, currentProperty.numero, currentProperty.bairro].filter(Boolean).join(', ')
      : [visit.logradouro, visit.numero, visit.bairro].filter(Boolean).join(', ');
    var routeUrl = visit.routeUrl || (currentProperty ? app.buildRouteUrl(currentProperty) : '');
    var cardUrl = visit.cardCode ? app.buildCardUrl(visit.cardCode) : '';
    var photoUrl = visit.photoDataUrl || visit.photoUrl || '';
    var signature = visit.signatureDataUrl || '';
    return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório da visita</title><style>' +
      'body{font-family:Arial,sans-serif;color:#1b252e;padding:26px;margin:0;background:#f7faf8}' +
      'h1,h2{color:#183c2c;margin:0 0 10px}' +
      '.head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;border-bottom:2px solid #d6e3dc;padding-bottom:14px}' +
      '.badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#e5f0ea;color:#183c2c;font-weight:700}' +
      '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}' +
      '.box{border:1px solid #d6dfe2;border-radius:16px;padding:14px;background:#fff}' +
      '.label{display:block;font-size:11px;text-transform:uppercase;color:#66727c;font-weight:700;margin-bottom:6px}' +
      '.value{font-size:15px;font-weight:700;color:#183c2c;line-height:1.45}' +
      '.section{margin-top:20px}' +
      '.image{width:100%;max-height:280px;object-fit:contain;border:1px solid #d6dfe2;border-radius:12px;background:#fff}' +
      '.notes{border:1px solid #d6dfe2;border-radius:16px;padding:16px;background:#fff;line-height:1.6}' +
      '.footer{margin-top:24px;color:#66727c;font-size:12px;font-weight:700;text-align:center}' +
      '.pill{display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:#f2f6f4;border:1px solid #d6e3dc;color:#355245;font-size:12px;font-weight:700}' +
      'a{color:#1f5e8f;text-decoration:none}table{width:100%;border-collapse:collapse;margin-top:12px}td,th{border:1px solid #d6dfe2;padding:8px;vertical-align:top}th{background:#eef5f1}' +
      '</style></head><body>' +
      '<div class="head"><div><h1>Relatório da visita ACE</h1><div>Desenvolvido por Almir Lemgruber @ALMRLK</div></div><span class="badge">' + app.escapeHtml(visit.situacao || 'Visita') + '</span></div>' +
      '<div class="grid">' +
        '<div class="box"><span class="label">Data e hora</span><span class="value">' + app.escapeHtml(app.formatDateBR(visit.data) + ' • ' + visit.hora) + '</span></div>' +
        '<div class="box"><span class="label">Agente</span><span class="value">' + app.escapeHtml((visit.agente || '-') + (visit.matricula ? ' • ' + visit.matricula : '')) + '</span></div>' +
        '<div class="box"><span class="label">Endereço</span><span class="value">' + app.escapeHtml(address || '-') + '</span></div>' +
        '<div class="box"><span class="label">Morador</span><span class="value">' + app.escapeHtml(visit.morador || '-') + '</span></div>' +
        '<div class="box"><span class="label">Microárea / Quarteirão</span><span class="value">' + app.escapeHtml((visit.microarea || '-') + ' • Q ' + (visit.quarteirao || '-')) + '</span></div>' +
        '<div class="box"><span class="label">Foco / Tubitos</span><span class="value">' + app.escapeHtml(visit.focusFound + ' • ' + visit.focusQty + ' foco(s) • ' + visit.tubitosQty + ' tubito(s)') + '</span></div>' +
        '<div class="box"><span class="label">Depósitos</span><span class="value">' + app.escapeHtml(visit.depositTotal + ' encontrados • ' + visit.depositFocusTotal + ' com foco') + '</span></div>' +
        '<div class="box"><span class="label">Caixa d’água</span><span class="value">' + app.escapeHtml(visit.waterAccess || '-') + '</span></div>' +
      '</div>' +
      '<div class="section"><h2>Controle de qualidade</h2>' +
        (qualityFlags.length ? qualityFlags.map(function (flag) { return '<span class="pill">' + app.escapeHtml(flag) + '</span>'; }).join('') : '<span class="pill">Registro completo</span>') +
      '</div>' +
      '<div class="section"><h2>Observações da visita</h2><div class="notes">' + app.escapeHtml(visit.obs || 'Sem observações adicionais.') + '</div></div>' +
      '<div class="section"><h2>Links operacionais</h2><table><tbody>' +
        '<tr><th>Cartão virtual</th><td>' + (cardUrl ? '<a href="' + app.escapeHtml(cardUrl) + '" target="_blank" rel="noopener noreferrer">' + app.escapeHtml(cardUrl) + '</a>' : 'Não informado') + '</td></tr>' +
        '<tr><th>Rota sugerida</th><td>' + (routeUrl ? '<a href="' + app.escapeHtml(routeUrl) + '" target="_blank" rel="noopener noreferrer">Abrir rota para o imóvel</a>' : 'Indisponível') + '</td></tr>' +
        '<tr><th>Território por GPS</th><td>' + app.escapeHtml(visit.gpsTerritory || '-') + (visit.gpsQuarteirao ? ' • Q ' + app.escapeHtml(visit.gpsQuarteirao) : '') + '</td></tr>' +
      '</tbody></table></div>' +
      (photoUrl ? '<div class="section"><h2>Foto da visita</h2><img class="image" src="' + app.escapeHtml(photoUrl) + '" alt="Foto da visita"></div>' : '') +
      (signature ? '<div class="section"><h2>Assinatura do morador</h2><img class="image" src="' + app.escapeHtml(signature) + '" alt="Assinatura do morador"></div>' : '') +
      '<div class="footer">Documento gerado localmente para conferência imediata e convertido em PDF definitivo no Google Drive após a sincronização.</div>' +
      '</body></html>';
  };

  app.loadFirst = function (keys, fallback) {
    var list = Array.isArray(keys) ? keys : [keys];
    var index;
    for (index = 0; index < list.length; index += 1) {
      try {
        var raw = localStorage.getItem(list[index]);
        if (raw) {
          return JSON.parse(raw);
        }
      } catch (err) {
        fallback = fallback;
      }
    }
    return fallback;
  };

  app.savePrimary = function (keyName, value) {
    localStorage.setItem(app.STORAGE_KEYS[keyName][0], JSON.stringify(value));
  };

  app.normalizeAgent = function (agent) {
    if (!agent) {
      return null;
    }
    return {
      uid: String(agent.uid || app.createId('AGT')).trim(),
      nome: app.normalizeTitleText(agent.nome || ''),
      matricula: app.normalizeFreeText(agent.matricula || ''),
      role: String(agent.role || agent.perfil || 'ACE').trim() || 'ACE',
      baseMicroarea: app.normalizeAreaCode(agent.baseMicroarea || agent.base_microarea || ''),
      baseRegion: app.normalizeFreeText(agent.baseRegion || agent.base_region || ''),
      senhaHash: String(agent.senhaHash || agent.senha || '').trim(),
      updatedAt: String(agent.updatedAt || new Date().toISOString()).trim()
    };
  };

  app.normalizeProperty = function (property) {
    if (!property) {
      return null;
    }
    var bairro = String(property.bairro || '').trim();
    var logradouro = String(property.logradouro || '').trim();
    var numero = String(property.numero || '').trim();
    var allowedComplements = app.CONFIG.PROPERTY_COMPLEMENTS || [];
    var rawComplemento = String(property.complemento || property.logradouroModo || '').trim();
    var normalizedComplemento = app.normalizeTitleText(rawComplemento);
    var referenceValue = app.normalizeTitleText(property.referencia || property.ref || '');
    var complementValue = allowedComplements.indexOf(normalizedComplemento) > -1 ? normalizedComplemento : 'Normal';
    if (!referenceValue && rawComplemento && allowedComplements.indexOf(normalizedComplemento) === -1) {
      referenceValue = app.normalizeTitleText(rawComplemento);
    }
    return {
      uid: String(property.uid || app.createId('PROP')).trim(),
      morador: app.normalizeTitleText(property.morador || ''),
      telefone: app.normalizeFreeText(property.telefone || ''),
      microarea: app.normalizeAreaCode(property.microarea || ''),
      quarteirao: app.normalizeAreaCode(property.quarteirao || ''),
      bairro: app.normalizeTitleText(bairro),
      logradouro: app.normalizeTitleText(logradouro),
      numero: app.normalizeFreeText(numero),
      complemento: complementValue,
      tipo: String(property.tipo || 'Residencial').trim(),
      referencia: referenceValue,
      obs: app.normalizeFreeText(property.obs || ''),
      address_key: String(property.address_key || app.addressKey({ bairro: bairro, logradouro: logradouro, numero: numero })).trim(),
      lastLat: app.normalizeCoord(property.lastLat || property.last_lat || ''),
      lastLng: app.normalizeCoord(property.lastLng || property.last_lng || ''),
      gpsTerritory: app.normalizeFreeText(property.gpsTerritory || property.gps_territory || ''),
      gpsQuarteirao: app.normalizeAreaCode(property.gpsQuarteirao || property.gps_quarteirao || ''),
      qualityFlags: Array.isArray(property.qualityFlags) ? property.qualityFlags.filter(Boolean) : String(property.qualityFlags || property.quality_flags || '').split('|').map(function (item) { return String(item || '').trim(); }).filter(Boolean),
      qualityStatus: String(property.qualityStatus || property.quality_status || '').trim(),
      lastVisitAt: String(property.lastVisitAt || property.last_visit_at || '').trim(),
      updatedAt: String(property.updatedAt || new Date().toISOString()).trim()
    };
  };

  app.getPropertyReferenceText = function (property) {
    if (!property) {
      return 'Sem referência complementar';
    }
    if (property.referencia) {
      return property.referencia;
    }
    if (property.complemento && property.complemento !== 'Normal') {
      return 'Cadastro ' + property.complemento;
    }
    return 'Sem referência complementar';
  };

  app.normalizeVisit = function (visit) {
    if (!visit) {
      return null;
    }
    var depositCounts = app.normalizeDepositMap(visit.depositCounts, visit.deposits);
    var depositFocusCounts = app.normalizeDepositMap(
      visit.depositFocusCounts || visit.deposit_focus_counts,
      visit.deposit_focus_breakdown
    );
    var focusQty = Math.max(0, Number(visit.focusQty || visit.focus_count || visit.focos_qtd || 0));
    var photoUrl = String(visit.photoUrl || visit.fotoUrl || '').trim();
    var photoDataUrl = String(visit.photoDataUrl || '').trim();
    var rawPhoto = String(visit.foto || '').trim();
    if (!photoUrl && rawPhoto && rawPhoto.indexOf('data:image/') !== 0) {
      photoUrl = rawPhoto;
    }
    if (!photoDataUrl && rawPhoto && rawPhoto.indexOf('data:image/') === 0) {
      photoDataUrl = rawPhoto;
    }
    return {
      uid: String(visit.uid || app.createId('VIS')).trim(),
      data: String(visit.data || app.todayISO()).trim(),
      hora: app.sanitizeHour(visit.hora || app.nowHHMM()),
      agente: app.normalizeTitleText(visit.agente || ''),
      matricula: app.normalizeFreeText(visit.matricula || ''),
      microarea: app.normalizeAreaCode(visit.microarea || ''),
      quarteirao: app.normalizeAreaCode(visit.quarteirao || ''),
      bairro: app.normalizeTitleText(visit.bairro || ''),
      logradouro: app.normalizeTitleText(visit.logradouro || ''),
      numero: app.normalizeFreeText(visit.numero || ''),
      tipo: String(visit.tipo || 'Residencial').trim(),
      situacao: app.normalizeStatus(visit.situacao || 'Visitado'),
      morador: app.normalizeTitleText(visit.morador || ''),
      telefone: app.normalizeFreeText(visit.telefone || ''),
      property_uid: String(visit.property_uid || visit.propertyId || '').trim(),
      depositCounts: depositCounts,
      depositTotal: app.totalFromMap(depositCounts),
      depositFocusCounts: depositFocusCounts,
      depositFocusTotal: app.totalFromMap(depositFocusCounts),
      deposits: app.compactMap(depositCounts),
      depositFocusBreakdown: app.compactMap(depositFocusCounts),
      focusFound: app.normalizeChoice(
        visit.focusFound || visit.foco || visit.focoEncontrado ||
        (focusQty > 0 || app.totalFromMap(depositFocusCounts) > 0 ? 'Sim' : 'Não')
      ),
      focusQty: focusQty,
      waterAccess: app.normalizeChoice(visit.waterAccess || visit.acessou_caixa_agua || ''),
      larvicida: String(visit.larvicida || 'Nenhum').trim(),
      larvicidaQty: Math.max(0, Number(visit.larvicidaQty || visit.larvicida_qtd || 0)),
      adulticida: String(visit.adulticida || 'Nenhum').trim(),
      adulticidaQty: Math.max(0, Number(visit.adulticidaQty || visit.adulticida_qtd || 0)),
      tubitosQty: Math.max(0, Number(visit.tubitosQty || visit.tubitos_qtd || visit.tubitosQtd || 0)),
      cardCode: app.normalizeCardCode(visit.cardCode || visit.card_code || ''),
      obs: app.normalizeFreeText(visit.obs || visit.observacoes || ''),
      gps: app.normalizeGps(visit.gps, visit.gps_lat, visit.gps_lng, visit.gps_acc),
      gpsTerritory: app.normalizeFreeText(visit.gpsTerritory || visit.gps_territory || ''),
      gpsQuarteirao: app.normalizeAreaCode(visit.gpsQuarteirao || visit.gps_quarteirao || ''),
      photoDataUrl: photoDataUrl,
      photoUrl: photoUrl,
      signatureDataUrl: String(visit.signatureDataUrl || visit.assinatura_data_url || '').trim(),
      signatureSignedAt: String(visit.signatureSignedAt || visit.assinatura_em || '').trim(),
      photoDriveId: String(visit.photoDriveId || visit.fotoDriveId || visit.foto_drive_id || '').trim(),
      pdfUrl: String(visit.pdfUrl || visit.relatorio_pdf_url || '').trim(),
      pdfDriveId: String(visit.pdfDriveId || visit.relatorio_pdf_drive_id || '').trim(),
      qualityFlags: Array.isArray(visit.qualityFlags) ? visit.qualityFlags.filter(Boolean) : String(visit.qualityFlags || visit.quality_flags || '').split('|').map(function (item) { return String(item || '').trim(); }).filter(Boolean),
      routeUrl: String(visit.routeUrl || visit.route_url || '').trim(),
      synced: !!visit.synced,
      createdAt: String(visit.createdAt || new Date().toISOString()).trim(),
      updatedAt: String(visit.updatedAt || new Date().toISOString()).trim()
    };
  };

  app.readAgents = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.agents, []);
    return Array.isArray(rows) ? rows.map(app.normalizeAgent).filter(Boolean) : [];
  };

  app.readProperties = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.properties, []);
    return Array.isArray(rows) ? rows.map(app.normalizeProperty).filter(Boolean) : [];
  };

  app.readVisits = function () {
    var rows = app.loadFirst(app.STORAGE_KEYS.visits, []);
    return Array.isArray(rows) ? rows.map(app.normalizeVisit).filter(Boolean) : [];
  };

  app.readSession = function () {
    var session = app.loadFirst(app.STORAGE_KEYS.session, null);
    return session ? app.normalizeAgent(session) : null;
  };

  app.saveAgents = function (rows) { app.savePrimary('agents', rows.map(app.normalizeAgent).filter(Boolean)); };
  app.saveProperties = function (rows) { app.savePrimary('properties', rows.map(app.normalizeProperty).filter(Boolean)); };
  app.saveVisits = function (rows) { app.savePrimary('visits', rows.map(app.normalizeVisit).filter(Boolean)); };
  app.saveSession = function (row) { app.savePrimary('session', row || null); };
  app.saveLastArea = function (microarea, quarteirao) {
    app.savePrimary('lastArea', {
      microarea: app.normalizeAreaCode(microarea || ''),
      quarteirao: app.normalizeAreaCode(quarteirao || '')
    });
  };

  app.readLastArea = function () {
    var area = app.loadFirst(app.STORAGE_KEYS.lastArea, null);
    if (!area) {
      return { microarea: '', quarteirao: '' };
    }
    return {
      microarea: app.normalizeAreaCode(area.microarea || ''),
      quarteirao: app.normalizeAreaCode(area.quarteirao || '')
    };
  };

  app.uniqueSorted = function (values, comparator) {
    var map = {};
    (values || []).forEach(function (value) {
      var text = String(value || '').trim();
      if (text) {
        map[text] = true;
      }
    });
    return Object.keys(map).sort(comparator || function (a, b) {
      return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
  };

  app.getBairroCatalog = function () {
    return app.uniqueSorted(
      app.CONFIG.BAIRROS
        .concat(app.readProperties().map(function (property) { return property.bairro; }))
        .concat(app.readVisits().map(function (visit) { return visit.bairro; }))
    );
  };

  app.getLogradouroCatalog = function (bairro) {
    var selectedBairro = String(bairro || '').trim();
    var values = app.readProperties().filter(function (property) {
      return !selectedBairro || property.bairro === selectedBairro;
    }).map(function (property) {
      return property.logradouro;
    }).concat(
      app.readVisits().filter(function (visit) {
        return !selectedBairro || visit.bairro === selectedBairro;
      }).map(function (visit) {
        return visit.logradouro;
      })
    );
    return app.uniqueSorted(values);
  };

  app.getTerritoryCatalog = function () {
    var lastArea = app.readLastArea();
    var properties = app.readProperties();
    var visits = app.readVisits();
    var bucket = {};
    var allQuarteiroes = [];

    function ensureBucket(microarea) {
      var key = app.normalizeAreaCode(microarea || '');
      if (!key) {
        return '';
      }
      if (!bucket[key]) {
        bucket[key] = {
          value: key,
          quarteiroes: []
        };
      }
      return key;
    }

    function addQuarteirao(microarea, quarteirao) {
      var areaKey = ensureBucket(microarea);
      var quarter = app.normalizeAreaCode(quarteirao || '');
      if (quarter) {
        allQuarteiroes.push(quarter);
        if (areaKey) {
          bucket[areaKey].quarteiroes.push(quarter);
        }
      }
    }

    app.CONFIG.MICROAREA_PRESETS.forEach(function (item) {
      var areaKey = ensureBucket(item.value);
      (item.quarteiroes || []).forEach(function (quarteirao) {
        bucket[areaKey].quarteiroes.push(app.normalizeAreaCode(quarteirao));
        allQuarteiroes.push(app.normalizeAreaCode(quarteirao));
      });
    });

    properties.forEach(function (property) {
      addQuarteirao(property.microarea, property.quarteirao);
    });
    visits.forEach(function (visit) {
      addQuarteirao(visit.microarea, visit.quarteirao);
    });
    addQuarteirao(app.state.visit && app.state.visit.microarea, app.state.visit && app.state.visit.quarteirao);
    addQuarteirao(lastArea.microarea, lastArea.quarteirao);

    var microareas = app.uniqueSorted(Object.keys(bucket), app.compareAreaCode);
    var byMicroarea = {};
    microareas.forEach(function (microarea) {
      byMicroarea[microarea] = app.uniqueSorted(bucket[microarea].quarteiroes, app.compareAreaCode);
    });

    return {
      microareas: microareas,
      quarteiroes: app.uniqueSorted(allQuarteiroes, app.compareAreaCode),
      byMicroarea: byMicroarea
    };
  };

  app.getSelectedProperty = function () {
    if (!app.state.selectedPropertyId) {
      return null;
    }
    return app.readProperties().find(function (property) {
      return property.uid === app.state.selectedPropertyId;
    }) || null;
  };

  app.getVisitsForProperty = function (property) {
    var key = app.addressKey(property || {});
    return app.readVisits().filter(function (visit) {
      return app.addressKey(visit) === key;
    }).sort(app.compareVisitDesc);
  };

  app.getTodayVisits = function () {
    var today = app.todayISO();
    return app.readVisits().filter(function (visit) { return visit.data === today; });
  };

  app.isApiConfigured = function () {
    var url = String(app.CONFIG.SHEETS_WEBAPP_URL || '').trim();
    return !!url && url !== 'COLE_AQUI_A_URL_DO_WEB_APP';
  };

  app.buildLocalSnapshot = function () {
    var visits = app.getTodayVisits();
    var properties = app.readProperties();
    var depositRanking = app.emptyDepositMap();
    var depositFocusRanking = app.emptyDepositMap();
    var gpsCount = 0;
    var focusVisits = 0;
    var focusCount = 0;
    var opened = 0;
    var closed = 0;
    var recovered = 0;
    var pending = 0;
    var tubitos = 0;

    visits.forEach(function (visit) {
      gpsCount += visit.gps ? 1 : 0;
      if (visit.focusFound === 'Sim') {
        focusVisits += 1;
      }
      focusCount += visit.focusQty;
      tubitos += visit.tubitosQty;
      if (visit.situacao === 'Visitado') {
        opened += 1;
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        closed += 1;
      }
      if (visit.situacao === 'Recuperado') {
        recovered += 1;
      }
      Object.keys(app.DEPOSITS).forEach(function (code) {
        depositRanking[code] += Number(visit.depositCounts[code] || 0);
        depositFocusRanking[code] += Number(visit.depositFocusCounts[code] || 0);
      });
    });

    var deposits = app.totalFromMap(depositRanking);
    var depositsWithFocus = app.totalFromMap(depositFocusRanking);
    var workedProperties = opened + recovered;
    var totalProperties = opened + closed;
    pending = Math.max(0, closed - recovered);

    return {
      visits: visits,
      totals: {
        totalVisits: visits.length,
        visitedProperties: workedProperties,
        totalProperties: totalProperties,
        opened: opened,
        closed: closed,
        recovered: recovered,
        pending: pending,
        deposits: deposits,
        depositsWithFocus: depositsWithFocus,
        infestationRate: deposits ? Number(((depositsWithFocus / deposits) * 100).toFixed(1)) : 0,
        gpsCoverage: visits.length ? Math.round((gpsCount / visits.length) * 100) : 0,
        returns: pending,
        focusVisits: focusVisits,
        focusCount: focusCount,
        tubitos: tubitos
      },
      depositRanking: depositRanking,
      depositFocusRanking: depositFocusRanking
    };
  };
}());
