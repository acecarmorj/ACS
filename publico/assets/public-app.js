(function () {
  'use strict';

  var state = {
    days: 30,
    area: 'TODOS',
    allVisits: [],
    filteredVisits: [],
    metrics: {},
    fetchedAt: '',
    map: null,
    polygonLayer: null,
    heatLayer: null,
    pointLayer: null,
    mapToggles: {
      polygons: true,
      heat: true,
      markers: true,
      open: true,
      closed: true,
      recovered: true
    },
    territoryMetricMode: 'combined'
  };

  var TERRITORY = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
  var IGNORED_FOLDERS = {
    CARMO: true,
    'CAMPO DE FUTEBOL': true,
    PRACAS: true,
    'PRAÇAS': true,
    PE: true
  };

  var areaDictionary = {
    VP: 'VAL PARAISO',
    'VAL PARAÍSO': 'VAL PARAISO',
    'VAL PARAISO': 'VAL PARAISO',
    'CAIXA DAGUA': 'CAIXA DAGUA',
    "CAIXA D'AGUA": 'CAIXA DAGUA',
    'CAIXA D´AGUA': 'CAIXA DAGUA',
    'CAIXA D AGUA': 'CAIXA DAGUA',
    'JD CENTENARIO': 'JARDIM CENTENARIO',
    'JARDIM CENTENARIO': 'JARDIM CENTENARIO',
    'MORRO DO ESTADO': 'ULISSES LEMGRUBER',
    BOTAFOGO: 'BOTAFOGO',
    CENTRO: 'CENTRO',
    PROGRESSO: 'PROGRESSO',
    'ULISSES LEMGRUBER': 'ULISSES LEMGRUBER',
    'BOA IDEIA': 'BOA IDEIA',
    'PORTO VELHO': 'PORTO VELHO',
    'PORTO VELHO DO CUNHA': 'PORTO VELHO DO CUNHA',
    'BARRA DE SAO FRANCISCO': 'BARRA DE SAO FRANCISCO',
    'CORREGO DA PRATA': 'CORREGO DA PRATA',
    'ILHA DOS POMBOS': 'ILHA DOS POMBOS',
    'ILHA DOS POMBOS (LIGHT)': 'ILHA DOS POMBOS',
    INFLUENCIA: 'INFLUENCIA'
  };

  var utils = {
    localIsoDate: function (date) {
      if (Object.prototype.toString.call(date) !== '[object Date]' || isNaN(date.getTime())) {
        return '';
      }
      var year = date.getFullYear();
      var month = String(date.getMonth() + 1).padStart(2, '0');
      var day = String(date.getDate()).padStart(2, '0');
      return year + '-' + month + '-' + day;
    },
    normalizeText: function (value) {
      return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
    },
    normalizeArea: function (value) {
      var normalized = utils.normalizeText(value)
        .replace(/^[A-Z0-9]{1,8}\s*-\s*/, '')
        .replace(/\./g, '')
        .replace(/CAIXA DAGUA/g, 'CAIXA DAGUA');
      return areaDictionary[normalized] || normalized;
    },
    normalizeQuarter: function (value) {
      var raw = String(value || '').trim();
      var isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        raw = String(Number(isoMatch[3])) + '/' + String(Number(isoMatch[2]));
      }
      var normalized = utils.normalizeText(raw)
        .replace(/^Q\s*-\s*/,'')
        .replace(/^Q\s+/,'')
        .replace(/\s+/g,'')
        .replace(/\/0+/g,'/')
        .replace(/^0+(\d)/,'$1');
      if (!normalized) { return ''; }
      return normalized.split('/').map(function (part) {
        return part ? String(Number(part)) === 'NaN' ? part : String(Number(part)) : part;
      }).join('/');
    },
    toNumber: function (value) {
      var number = Number(value);
      return Number.isFinite(number) ? number : 0;
    },
    parseCoord: function (value) {
      var number = Number(value);
      return Number.isFinite(number) ? number : null;
    },
    yes: function (value) {
      return /^(sim|s|yes|true|1)$/i.test(String(value || '').trim());
    },
    titleCase: function (value) {
      return String(value || '')
        .toLowerCase()
        .replace(/(^|\s|\/|-)([a-zà-ú])/g, function (_, start, letter) {
          return start + letter.toUpperCase();
        });
    },
    formatDate: function (value) {
      if (!value) { return '--'; }
      var parts = String(value).split('-');
      if (parts.length !== 3) { return value; }
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    },
    normalizeDate: function (value) {
      if (!value) { return ''; }
      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        return utils.localIsoDate(value);
      }
      var text = String(value).trim();
      var isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
      if (isoMatch) { return isoMatch[1]; }
      var brMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (brMatch) { return brMatch[3] + '-' + brMatch[2] + '-' + brMatch[1]; }
      return text;
    },
    normalizeTime: function (value) {
      if (!value) { return ''; }
      if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
        return String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0');
      }
      var text = String(value).trim();
      var isoMatch = text.match(/T(\d{2}:\d{2})/);
      if (isoMatch) { return isoMatch[1]; }
      var timeMatch = text.match(/(\d{2}:\d{2})/);
      if (timeMatch) { return timeMatch[1]; }
      return text.slice(0, 5);
    },
    todayIso: function () {
      return utils.localIsoDate(new Date());
    },
    startIso: function (days) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (days - 1));
      return utils.localIsoDate(date);
    },
    clamp: function (value, min, max) {
      return Math.max(min, Math.min(max, value));
    },
    buildApiEnd: function (value) {
      return value ? value + 'T23:59:59.999Z' : '';
    }
  };

  var territoryModel = buildTerritoryModel();

  function buildTerritoryModel() {
    var model = {
      folderMarkers: {},
      quarterMarkers: {},
      folderCentroids: {},
      quarterCentroids: {},
      polygons: [],
      bounds: null,
      coordPool: []
    };

    function shouldIgnoreFeature(folder, name, path, coords) {
      var folderKey = utils.normalizeArea(folder || '');
      var nameKey = utils.normalizeArea(name || '');
      var pathList = Array.isArray(path) ? path : [];
      var bounds = getBounds(coords || []);
      var isMacroCarmo = folderKey === 'CARMO' ||
        nameKey === 'CARMO' ||
        (pathList.length <= 1 && (folderKey === 'CARMO' || nameKey === 'CARMO'));
      if (!folderKey || IGNORED_FOLDERS[folderKey] || isMacroCarmo) {
        return true;
      }
      if (bounds && isMacroCarmo && ((bounds.maxLat - bounds.minLat) > 0.08 || (bounds.maxLng - bounds.minLng) > 0.08)) {
        return true;
      }
      return false;
    }

    TERRITORY.points.forEach(function (point) {
      var folder = utils.normalizeArea(point.folder || '');
      if (shouldIgnoreFeature(point.folder, point.name, point.path, point.coordinates || [])) {
        return;
      }

      var coords = point.coordinates || [];
      if (!Array.isArray(coords) || coords.length < 2) {
        return;
      }

      if (String(point.path || []).indexOf('MARCADORES') !== -1) {
        var quarter = utils.normalizeQuarter(point.name || '');
        if (!model.quarterMarkers[folder]) {
          model.quarterMarkers[folder] = {};
        }
        if (quarter) {
          model.quarterMarkers[folder][quarter] = [coords[0], coords[1]];
        }
      } else if (!model.folderMarkers[folder]) {
        model.folderMarkers[folder] = [coords[0], coords[1]];
      }
      model.coordPool.push([coords[0], coords[1]]);
    });

    TERRITORY.polygons.forEach(function (polygon) {
      var folder = utils.normalizeArea(polygon.folder || '');
      if (shouldIgnoreFeature(polygon.folder, polygon.name, polygon.path, polygon.coordinates || [])) {
        return;
      }
      var coords = Array.isArray(polygon.coordinates) ? polygon.coordinates : [];
      if (!coords.length) {
        return;
      }
      var centroid = getPolygonCentroid(coords);
      var quarter = utils.normalizeQuarter(polygon.name || '');
      model.polygons.push({
        id: polygon.id,
        folder: folder,
        folderLabel: polygon.folder || folder,
        quarter: quarter,
        quarterLabel: polygon.name || '',
        coordinates: coords,
        centroid: centroid
      });
      coords.forEach(function (coord) {
        if (Array.isArray(coord) && coord.length >= 2) {
          model.coordPool.push([coord[0], coord[1]]);
        }
      });

      if (quarter) {
        model.quarterCentroids[folder + '|' + quarter] = centroid;
      }

      if (!model.folderCentroids[folder]) {
        model.folderCentroids[folder] = [];
      }
      model.folderCentroids[folder].push(centroid);
    });

    Object.keys(model.folderCentroids).forEach(function (folder) {
      model.folderCentroids[folder] = averageCoords(model.folderCentroids[folder]);
    });

    model.bounds = getBounds(model.coordPool);
    delete model.coordPool;

    return model;
  }

  function getBounds(coords) {
    if (!Array.isArray(coords) || !coords.length) {
      return null;
    }
    var bounds = {
      minLat: Infinity,
      maxLat: -Infinity,
      minLng: Infinity,
      maxLng: -Infinity
    };
    coords.forEach(function (coord) {
      if (!Array.isArray(coord) || coord.length < 2) { return; }
      var lat = Number(coord[0]);
      var lng = Number(coord[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { return; }
      bounds.minLat = Math.min(bounds.minLat, lat);
      bounds.maxLat = Math.max(bounds.maxLat, lat);
      bounds.minLng = Math.min(bounds.minLng, lng);
      bounds.maxLng = Math.max(bounds.maxLng, lng);
    });
    if (!Number.isFinite(bounds.minLat) || !Number.isFinite(bounds.minLng)) {
      return null;
    }
    return bounds;
  }

  function isInsidePublicBounds(lat, lng) {
    var bounds = territoryModel.bounds;
    var margin = 0.02;
    if (!bounds || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    return lat >= (bounds.minLat - margin) &&
      lat <= (bounds.maxLat + margin) &&
      lng >= (bounds.minLng - margin) &&
      lng <= (bounds.maxLng + margin);
  }

  function getPolygonCentroid(coords) {
    var sumLat = 0;
    var sumLng = 0;
    var count = 0;
    coords.forEach(function (coord) {
      if (!Array.isArray(coord) || coord.length < 2) { return; }
      sumLat += Number(coord[0]) || 0;
      sumLng += Number(coord[1]) || 0;
      count += 1;
    });
    return count ? [sumLat / count, sumLng / count] : [-21.935778, -42.607911];
  }

  function averageCoords(list) {
    if (!list.length) {
      return [-21.935778, -42.607911];
    }
    var lat = 0;
    var lng = 0;
    list.forEach(function (item) {
      lat += item[0];
      lng += item[1];
    });
    return [lat / list.length, lng / list.length];
  }

  function shapeVisit(raw) {
    var area = utils.normalizeArea(raw.gps_territory || raw.bairro || '');
    var quarter = utils.normalizeQuarter(raw.gps_quarteirao || raw.quarteirao || '');
    var focusCount = utils.toNumber(raw.focus_count || raw.focusQty || 0);
    var depositCount = utils.toNumber(raw.deposit_count || raw.depositTotal || 0);
    var depositFocusCount = utils.toNumber(raw.deposit_focus_count || raw.depositFocusTotal || 0);
    var gpsLat = utils.parseCoord(raw.gps_lat || (raw.gps && raw.gps.lat));
    var gpsLng = utils.parseCoord(raw.gps_lng || (raw.gps && raw.gps.lng));
    var bairro = String(raw.bairro || '').trim();
    var logradouro = String(raw.logradouro || '').trim();
    var numero = String(raw.numero || '').trim();
    var propertyUid = String(raw.property_uid || '').trim();
    return {
      uid: String(raw.uid || '').trim(),
      data: utils.normalizeDate(raw.data || ''),
      hora: utils.normalizeTime(raw.hora || ''),
      area: area,
      quarter: quarter,
      bairro: bairro,
      logradouro: logradouro,
      numero: numero,
      propertyUid: propertyUid,
      propertyKey: propertyUid || [bairro, logradouro, numero].join('|').toLowerCase() || String(raw.uid || '').trim(),
      situacao: String(raw.situacao || 'Visitado').trim(),
      focusFound: utils.yes(raw.foco) || focusCount > 0 || depositFocusCount > 0,
      focusCount: focusCount,
      depositCount: depositCount,
      depositFocusCount: depositFocusCount,
      gpsLat: gpsLat,
      gpsLng: gpsLng,
      waterAccess: String(raw.acessou_caixa_agua || '').trim(),
      tubitosQty: utils.toNumber(raw.tubitos_qtd || 0)
    };
  }

  function createAreaOptions(visits) {
    var map = {};
    visits.forEach(function (visit) {
      if (visit.area) {
        map[visit.area] = utils.titleCase(visit.area);
      }
    });
    Object.keys(territoryModel.folderCentroids).forEach(function (folder) {
      if (!IGNORED_FOLDERS[folder]) {
        map[folder] = utils.titleCase(folder);
      }
    });
    return Object.keys(map).sort().map(function (key) {
      return { value: key, label: map[key] };
    });
  }

  function setAreaFilter(options) {
    var select = document.getElementById('areaFilter');
    var html = ['<option value="TODOS">Toda a cidade</option>'];
    options.forEach(function (option) {
      html.push('<option value="' + escapeHtml(option.value) + '">' + escapeHtml(option.label) + '</option>');
    });
    select.innerHTML = html.join('');
    select.value = state.area;
  }

  function ensurePublicMapControls() {
    var filterRow = document.querySelector('.toolbar .filter-row');
    var legend = document.querySelector('.map-legend');

    if (filterRow && !document.getElementById('publicMetricMode')) {
      filterRow.insertAdjacentHTML('beforeend',
        '<select id="publicMetricMode" class="filter-select">' +
          '<option value="combined">Sem&aacute;foro: combina&ccedil;&atilde;o territorial</option>' +
          '<option value="focus">Sem&aacute;foro: focos</option>' +
          '<option value="depositFocus">Sem&aacute;foro: dep&oacute;sitos com foco</option>' +
          '<option value="infestation">Sem&aacute;foro: taxa de infesta&ccedil;&atilde;o</option>' +
        '</select>');
    }

    if (legend && !legend.getAttribute('data-public-privacy-ready')) {
      legend.setAttribute('data-public-privacy-ready', 'true');
      legend.innerHTML =
        '<span><i class="map-legend-dot is-low"></i> quarteir&atilde;o verde: sem foco</span>' +
        '<span><i class="map-legend-dot is-medium"></i> quarteir&atilde;o amarelo: aten&ccedil;&atilde;o</span>' +
        '<span><i class="map-legend-dot is-high"></i> quarteir&atilde;o vermelho: cr&iacute;tico</span>';
    }
  }

  function bindEvents() {
    ensurePublicMapControls();
    Array.prototype.slice.call(document.querySelectorAll('[data-range]')).forEach(function (button) {
      button.addEventListener('click', function () {
        var days = Number(button.getAttribute('data-range'));
        if (!days || days === state.days) {
          return;
        }
        state.days = days;
        syncRangeButtons();
        loadPublicDashboard();
      });
    });

    if (document.getElementById('areaFilter')) {
      document.getElementById('areaFilter').addEventListener('change', function (event) {
        state.area = event.target.value;
        applyFilterAndRender();
      });
    }

    if (document.getElementById('publicMetricMode')) {
      document.getElementById('publicMetricMode').value = state.territoryMetricMode;
      document.getElementById('publicMetricMode').addEventListener('change', function (event) {
        state.territoryMetricMode = String(event.target.value || 'combined');
        renderMap(buildSummary(state.filteredVisits));
      });
    }
  }

  function syncRangeButtons() {
    Array.prototype.slice.call(document.querySelectorAll('[data-range]')).forEach(function (button) {
      var active = Number(button.getAttribute('data-range')) === state.days;
      button.classList.toggle('is-active', active);
    });
  }

  function loadPublicDashboard() {
    var start = utils.startIso(state.days);
    var end = utils.todayIso();
    document.getElementById('statusPill').textContent = 'Atualizando dados';
    var url = buildApiUrl('dashboard_range', {
      start: start,
      end: utils.buildApiEnd(end)
    });

    return fetch(url, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Falha ao ler dados p\u00fablicos.');
        }
        return response.json();
      })
      .then(function (payload) {
        var data = payload && payload.data ? payload.data : {};
        state.allVisits = Array.isArray(data.visits) ? data.visits.map(shapeVisit) : [];
        state.metrics = data.metrics || {};
        state.fetchedAt = new Date().toLocaleString('pt-BR');
        setAreaFilter(createAreaOptions(state.allVisits));
        applyFilterAndRender();
        document.getElementById('statusPill').textContent = 'Dados p\u00fablicos atualizados';
      })
      .catch(function () {
        state.allVisits = [];
        state.metrics = {};
        state.fetchedAt = new Date().toLocaleString('pt-BR');
        applyFilterAndRender();
        document.getElementById('statusPill').textContent = 'Painel em modo informativo';
      });
  }

  function applyFilterAndRender() {
    state.filteredVisits = state.allVisits.filter(function (visit) {
      if (state.area !== 'TODOS' && visit.area !== state.area) {
        return false;
      }
      return true;
    });

    var summary = buildSummary(state.filteredVisits);
    renderHero(summary);
    renderMetrics(summary);
    renderVisitSummary(summary);
    renderPublicInsightReport(summary);
    renderAttentionList(summary);
    renderStreetAttentionList(summary);
    renderTrend(summary);
    renderMap(summary);
  }

  function buildSummary(visits) {
    var perAreaQuarter = {};
    var perArea = {};
    var perStreet = {};
    var perDay = {};
    var monitoredAreas = {};
    var totalDeposits = 0;

    visits.forEach(function (visit) {
      totalDeposits += visit.depositCount;
      if (visit.data) {
        if (!perDay[visit.data]) {
          perDay[visit.data] = { date: visit.data, visits: 0, focusSignals: 0 };
        }
        perDay[visit.data].visits += 1;
        perDay[visit.data].focusSignals += (visit.focusCount + visit.depositFocusCount);
      }

      if (visit.area) {
        monitoredAreas[visit.area] = true;
      }

      var areaKey = visit.area || 'SEM AREA';
      var quarterKey = visit.quarter ? areaKey + '|' + visit.quarter : areaKey + '|GERAL';

      if (!perAreaQuarter[quarterKey]) {
        perAreaQuarter[quarterKey] = {
          area: areaKey,
          quarter: visit.quarter || '',
          visits: 0,
          focusSignals: 0,
          focusVisits: 0,
          depositFocus: 0,
          deposits: 0,
          closed: 0,
          opened: 0,
          recovered: 0,
          gps: 0,
          statusCounts: { open: 0, closed: 0, recovered: 0 },
          point: null,
          combinedScore: 0,
          infestationRate: 0
        };
      }

      if (!perArea[areaKey]) {
        perArea[areaKey] = {
          area: areaKey,
          visits: 0,
          focusSignals: 0,
          focusVisits: 0,
          depositFocus: 0,
          deposits: 0,
          closed: 0,
          opened: 0,
          recovered: 0,
          combinedScore: 0,
          infestationRate: 0
        };
      }

      var bucket = perAreaQuarter[quarterKey];
      var areaBucket = perArea[areaKey];
      var focusSignal = visit.focusCount + visit.depositFocusCount;
      var streetKey = [visit.bairro || areaKey, visit.logradouro].join('|').toLowerCase();
      var tone = getPublicVisitTone(visit);

      bucket.visits += 1;
      bucket.focusSignals += focusSignal;
      bucket.focusVisits += visit.focusFound ? 1 : 0;
      bucket.depositFocus += visit.depositFocusCount;
      bucket.deposits += visit.depositCount;
      if (visit.gpsLat !== null && visit.gpsLng !== null) { bucket.gps += 1; }
      if (tone.key === 'closed') { bucket.closed += 1; }
      if (tone.key === 'open') { bucket.opened += 1; }
      if (tone.key === 'recovered') { bucket.recovered += 1; }
      bucket.statusCounts[tone.key] = (bucket.statusCounts[tone.key] || 0) + 1;

      areaBucket.visits += 1;
      areaBucket.focusSignals += focusSignal;
      areaBucket.focusVisits += visit.focusFound ? 1 : 0;
      areaBucket.depositFocus += visit.depositFocusCount;
      areaBucket.deposits += visit.depositCount;
      if (tone.key === 'closed') { areaBucket.closed += 1; }
      if (tone.key === 'open') { areaBucket.opened += 1; }
      if (tone.key === 'recovered') { areaBucket.recovered += 1; }

      if (visit.logradouro) {
        if (!perStreet[streetKey]) {
          perStreet[streetKey] = {
            bairro: visit.bairro || utils.titleCase(areaKey || 'Sem bairro'),
            area: areaKey,
            logradouro: visit.logradouro,
            visits: 0,
            focusSignals: 0,
            depositFocus: 0
          };
        }
        perStreet[streetKey].visits += 1;
        perStreet[streetKey].focusSignals += focusSignal;
        perStreet[streetKey].depositFocus += visit.depositFocusCount;
      }
    });

    Object.keys(perAreaQuarter).forEach(function (key) {
      var bucket = perAreaQuarter[key];
      bucket.point = resolvePublicPoint(bucket.area, bucket.quarter);
      bucket.infestationRate = bucket.deposits ? Number(((bucket.depositFocus / bucket.deposits) * 100).toFixed(1)) : 0;
      bucket.combinedScore = Number((bucket.focusSignals + bucket.depositFocus + bucket.visits * 0.1).toFixed(1));
    });

    Object.keys(perArea).forEach(function (key) {
      var bucket = perArea[key];
      bucket.infestationRate = bucket.deposits ? Number(((bucket.depositFocus / bucket.deposits) * 100).toFixed(1)) : 0;
      bucket.combinedScore = Number((bucket.focusSignals + bucket.depositFocus + bucket.visits * 0.1).toFixed(1));
    });

    var topAreas = Object.keys(perArea)
      .map(function (key) { return perArea[key]; })
      .sort(function (a, b) {
        return b.combinedScore - a.combinedScore;
      });

    var quarters = Object.keys(perAreaQuarter)
      .map(function (key) { return perAreaQuarter[key]; })
      .sort(function (a, b) {
        return b.combinedScore - a.combinedScore;
      });

    var topStreets = Object.keys(perStreet)
      .map(function (key) { return perStreet[key]; })
      .map(function (item) {
        item.criticalScore = item.focusSignals + item.depositFocus;
        return item;
      })
      .filter(function (item) { return item.criticalScore > 0; })
      .sort(function (a, b) {
        return b.criticalScore - a.criticalScore || b.visits - a.visits || a.logradouro.localeCompare(b.logradouro, 'pt-BR', { numeric: true });
      });

    var totalVisits = visits.length;
    var totalDepositsFocus = quarters.reduce(function (sum, item) { return sum + item.depositFocus; }, 0);
    var totalFocusSignals = quarters.reduce(function (sum, item) { return sum + item.focusSignals; }, 0);
    var gpsVisits = visits.filter(function (visit) { return visit.gpsLat !== null && visit.gpsLng !== null; }).length;
    var opened = 0;
    var closed = 0;
    var recovered = 0;
    var pending = 0;

    visits.forEach(function (row) {
      var situacao = String(row.situacao || '').trim().toLowerCase();
      if (situacao.indexOf('visit') > -1) { opened += 1; }
      if (situacao.indexOf('fech') > -1 || situacao.indexOf('recusa') > -1) { closed += 1; }
      if (situacao.indexOf('recuper') > -1) { recovered += 1; }
    });
    var workedProperties = opened + recovered;
    var totalProperties = opened + closed;
    pending = Math.max(0, closed - recovered);

    var visitResume = {
      opened: opened,
      closed: closed,
      totalProperties: totalProperties,
      recovered: recovered,
      worked: workedProperties,
      pending: pending,
      infestation: totalDeposits ? Number(((totalDepositsFocus / totalDeposits) * 100).toFixed(1)) : 0
    };

    return {
      totalVisits: totalVisits,
      monitoredAreas: Object.keys(monitoredAreas).length,
      areasWithAttention: topAreas.filter(function (item) { return item.focusSignals > 0 || item.depositFocus > 0; }).length,
      totalDepositsFocus: totalDepositsFocus,
      totalDeposits: totalDeposits,
      totalFocusSignals: totalFocusSignals,
      gpsCoverage: totalVisits ? Math.round((gpsVisits / totalVisits) * 100) : 0,
      topAreas: topAreas,
      topStreets: topStreets,
      topQuarters: quarters,
      dailySeries: Object.keys(perDay).sort().map(function (key) { return perDay[key]; }),
      publicMarkers: buildPublicMarkerGroups(quarters),
      visitResume: visitResume
    };
  }

  function compareVisitMoment(a, b) {
    var keyA = (a.data || '') + 'T' + (a.hora || '00:00');
    var keyB = (b.data || '') + 'T' + (b.hora || '00:00');
    if (keyA === keyB) { return 0; }
    return keyA > keyB ? 1 : -1;
  }

  function resolvePublicPoint(area, quarter) {
    if (area && quarter && territoryModel.quarterMarkers[area] && territoryModel.quarterMarkers[area][quarter]) {
      return territoryModel.quarterMarkers[area][quarter];
    }
    if (area && quarter && territoryModel.quarterCentroids[area + '|' + quarter]) {
      return territoryModel.quarterCentroids[area + '|' + quarter];
    }
    if (area && territoryModel.folderMarkers[area]) {
      return territoryModel.folderMarkers[area];
    }
    if (area && territoryModel.folderCentroids[area]) {
      return territoryModel.folderCentroids[area];
    }
    return null;
  }

  function pointInsidePublicPolygon(lat, lng, polygon) {
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

  function resolvePublicPolygon(visit) {
    var area = visit.area || '';
    var quarter = visit.quarter || '';
    var direct;
    if (area && quarter) {
      direct = territoryModel.polygons.filter(function (polygon) {
        return polygon.folder === area && polygon.quarter === quarter;
      });
      if (direct[0]) {
        return direct[0];
      }
    }
    if (quarter) {
      direct = territoryModel.polygons.filter(function (polygon) {
        return polygon.quarter === quarter;
      });
      if (direct.length === 1) {
        return direct[0];
      }
    }
    return null;
  }

  function resolveVisitPoint(visit) {
    var polygon = resolvePublicPolygon(visit);
    if (visit.gpsLat !== null && visit.gpsLng !== null && polygon && pointInsidePublicPolygon(visit.gpsLat, visit.gpsLng, polygon.coordinates)) {
      return { lat: visit.gpsLat, lng: visit.gpsLng, source: 'gps' };
    }
    var fallback = resolvePublicPoint(visit.area, visit.quarter);
    if (fallback) {
      return { lat: fallback[0], lng: fallback[1], source: 'territory' };
    }
    if (visit.gpsLat !== null && visit.gpsLng !== null && isInsidePublicBounds(visit.gpsLat, visit.gpsLng)) {
      return { lat: visit.gpsLat, lng: visit.gpsLng, source: 'gps' };
    }
    return null;
  }

  function renderHero(summary) {
    var areaLabel = state.area === 'TODOS' ? 'Toda a cidade' : utils.titleCase(state.area);
    var topArea = summary.topAreas[0];
    document.getElementById('heroArea').textContent = areaLabel;
    document.getElementById('heroHeadline').textContent = summary.totalVisits
      ? 'Mapa p\u00fablico de calor e panorama do per\u00edodo'
      : 'Mapa p\u00fablico de calor e orienta\u00e7\u00e3o preventiva';
    document.getElementById('heroDescription').textContent = summary.totalVisits
      ? 'O painel mostra um recorte agregado das a\u00e7\u00f5es realizadas no territ\u00f3rio, destacando as \u00e1reas e ruas que pedem mais cuidado coletivo.'
      : 'Mesmo sem registros p\u00fablicos no per\u00edodo selecionado, esta p\u00e1gina continua orientando a popula\u00e7\u00e3o sobre preven\u00e7\u00e3o e cuidado coletivo.';
    document.getElementById('heroBadgePeriod').textContent = 'Recorte atual: \u00faltimos ' + state.days + ' dias';
    document.getElementById('heroBadgeUpdated').textContent = 'Atualizado em ' + state.fetchedAt;
    document.getElementById('heroBadgePrivacy').textContent = 'Mapa p\u00fablico com leitura territorial agregada';
    document.getElementById('heroPriority').textContent = topArea
      ? '\u00c1rea em maior aten\u00e7\u00e3o: ' + utils.titleCase(topArea.area)
      : 'Sem \u00e1rea cr\u00edtica identificada no recorte atual';
    document.getElementById('heroPriorityText').textContent = topArea
      ? 'A leitura abaixo ajuda a comunidade a entender as \u00e1reas com mais sinais de foco e a refor\u00e7ar a preven\u00e7\u00e3o.'
      : 'Os dados p\u00fablicos do per\u00edodo n\u00e3o apontam concentra\u00e7\u00e3o relevante de focos.';
    document.getElementById('heroTransparencyText').textContent = summary.totalVisits
      ? 'As informa\u00e7\u00f5es s\u00e3o exibidas de forma agregada, sem divulgar nome de morador ou endere\u00e7o individual.'
      : 'Assim que novas visitas forem sincronizadas, o painel passar\u00e1 a refletir as a\u00e7\u00f5es em andamento na cidade.';
    document.getElementById('lastUpdateText').textContent = '\u00daltima leitura p\u00fablica: ' + state.fetchedAt;
  }

  function renderMetrics(summary) {
    setText('metricVisits', summary.totalVisits);
    setText('metricVisitsNote', summary.totalVisits ? 'Lançamentos registrados no período selecionado.' : 'Sem visitas sincronizadas neste recorte.');
    setText('metricAreas', summary.monitoredAreas);
    setText('metricAreasNote', summary.monitoredAreas ? 'Territ\u00f3rios com algum registro p\u00fablico no recorte.' : 'Aguardando registros p\u00fablicos de territ\u00f3rio.');
    setText('metricAttention', summary.areasWithAttention);
    setText('metricAttentionNote', summary.areasWithAttention ? '\u00c1reas com sinais de foco ou dep\u00f3sitos com foco.' : 'Nenhuma \u00e1rea com sinal relevante no per\u00edodo.');
    setText('metricDeposits', summary.totalDepositsFocus);
    setText('metricDepositsNote', 'Dep\u00f3sitos com foco confirmados no recorte p\u00fablico.');
  }

  function renderVisitSummary(summary) {
    var visitResume = summary.visitResume || {};
    setText('visitOpened', visitResume.opened || 0);
    setText('visitClosed', visitResume.closed || 0);
    setText('visitTotalProperties', visitResume.totalProperties || 0);
    setText('visitRecovered', visitResume.recovered || 0);
    setText('visitWorked', visitResume.worked || 0);
    setText('visitPending', visitResume.pending || 0);
    setText('visitInfestation', (visitResume.infestation || 0).toFixed(1).replace('.', ',') + '%');
  }

  function renderPublicInsightReport(summary) {
    var node = document.getElementById('publicInsightReport');
    var topArea = summary.topAreas[0] || null;
    var topStreet = summary.topStreets && summary.topStreets[0] ? summary.topStreets[0] : null;
    var visitResume = summary.visitResume || {};
    var items;
    if (!node) {
      return;
    }
    if (!summary.totalVisits) {
      node.innerHTML = [
        '<article class="card public-report-card">',
          '<span class="card-kicker">Leitura para a popula\u00e7\u00e3o</span>',
          '<h3>Painel em observa\u00e7\u00e3o</h3>',
          '<p>Assim que houver novas visitas sincronizadas, esta \u00e1rea passar\u00e1 a explicar de forma simples quais territ\u00f3rios pedem mais cuidado e como a popula\u00e7\u00e3o pode colaborar.</p>',
        '</article>'
      ].join('');
      return;
    }
    items = [
      {
        title: 'Panorama do per\u00edodo',
        text: 'Nos \u00faltimos ' + state.days + ' dias, o painel recebeu ' + summary.totalVisits + ' visita(s) p\u00fablicas em ' + summary.monitoredAreas + ' territ\u00f3rio(s). O \u00edndice de infesta\u00e7\u00e3o do recorte est\u00e1 em ' + (visitResume.infestation || 0).toFixed(1).replace('.', ',') + '%.'
      },
      {
        title: 'Onde vale refor\u00e7ar o cuidado',
        text: topArea ?
          ('A \u00e1rea com maior aten\u00e7\u00e3o no momento \u00e9 ' + utils.titleCase(topArea.area) + '. ' + (topStreet ? ('Entre as ruas do recorte, o maior sinal de foco aparece em ' + topStreet.logradouro + '.') : 'A leitura territorial indica concentra\u00e7\u00e3o maior de sinais de foco nessa regi\u00e3o.')) :
          'Neste momento, o recorte n\u00e3o aponta concentra\u00e7\u00e3o relevante de foco em uma \u00e1rea espec\u00edfica.'
      },
      {
        title: 'Como a popula\u00e7\u00e3o pode ajudar agora',
        text: visitResume.infestation >= 15 ?
          'Vale redobrar a checagem de recipientes com \u00e1gua, caixas, calhas, quintais e pontos de ac\u00famulo de lixo. Quanto mais cedo o foco \u00e9 eliminado, menor o risco para o bairro.' :
          (visitResume.pending > 0 ?
            'Mesmo com cen\u00e1rio mais est\u00e1vel, ainda vale manter quintais, calhas e recipientes sob revis\u00e3o frequente e avisar a equipe se houver local insalubre ou foco recorrente.' :
            'O momento permite manter preven\u00e7\u00e3o de rotina: revisar quintal, eliminar \u00e1gua parada, observar terrenos baldios e comunicar situa\u00e7\u00f5es persistentes.')
      }
    ];
    node.innerHTML = items.map(function (item) {
      return '<article class="card public-report-card"><span class="card-kicker">Leitura para a popula\u00e7\u00e3o</span><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.text) + '</p></article>';
    }).join('');
  }

  function renderAttentionList(summary) {
    var container = document.getElementById('attentionList');
    if (!summary.topAreas.length) {
      container.innerHTML = '<div class="empty">Sem sinais p\u00fablicos suficientes para montar um ranking no per\u00edodo escolhido.</div>';
      return;
    }

    var max = summary.topAreas[0].focusSignals + summary.topAreas[0].depositFocus + summary.topAreas[0].visits * 0.1 || 1;
    container.innerHTML = summary.topAreas.slice(0, 6).map(function (item) {
      var score = item.focusSignals + item.depositFocus + item.visits * 0.1;
      var width = Math.max(8, Math.round((score / max) * 100));
      return [
        '<div class="list-item">',
          '<strong>' + escapeHtml(utils.titleCase(item.area)) + '</strong>',
          '<span>' + escapeHtml(item.visits + ' visita(s), ' + item.focusSignals + ' sinal(is) de foco e ' + item.depositFocus + ' dep\u00f3sito(s) com foco no recorte.') + '</span>',
          '<div class="progress-row">',
            '<div class="progress-track"><div class="progress-bar" style="width:' + width + '%"></div></div>',
            '<span class="progress-value">' + score.toFixed(1).replace('.', ',') + '</span>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderStreetAttentionList(summary) {
    var container = document.getElementById('streetAttentionList');
    var max;
    if (!container) {
      return;
    }
    if (!summary.topStreets || !summary.topStreets.length) {
      container.innerHTML = '<div class="empty">Sem rua com foco relevante no recorte p\u00fablico selecionado.</div>';
      return;
    }
    max = summary.topStreets[0].criticalScore || 1;
    container.innerHTML = summary.topStreets.slice(0, 5).map(function (item) {
      var width = Math.max(8, Math.round((item.criticalScore / max) * 100));
      return [
        '<div class="list-item">',
          '<strong>' + escapeHtml(item.logradouro) + '</strong>',
          '<span>' + escapeHtml((item.bairro || utils.titleCase(item.area || 'Sem bairro')) + ' \u2022 ' + item.visits + ' visita(s) \u2022 ' + item.focusSignals + ' sinal(is) de foco \u2022 ' + item.depositFocus + ' dep\u00f3sito(s) com foco') + '</span>',
          '<div class="progress-row">',
            '<div class="progress-track"><div class="progress-bar" style="width:' + width + '%"></div></div>',
            '<span class="progress-value">' + escapeHtml(String(item.criticalScore)) + '</span>',
          '</div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function getPublicMetricMeta(mode) {
    if (mode === 'focus') {
      return { label: 'Focos', unit: ' foco(s)', attention: 1, critical: 3 };
    }
    if (mode === 'depositFocus') {
      return { label: 'Depósitos com foco', unit: ' depósito(s)', attention: 1, critical: 2 };
    }
    if (mode === 'infestation') {
      return { label: 'Taxa de infestação', unit: '%', attention: 10, critical: 25 };
    }
    return { label: 'Combinação territorial', unit: ' ponto(s)', attention: 2, critical: 5 };
  }

  function getPublicMetricValue(detail, mode) {
    var item = detail || {};
    if (mode === 'focus') {
      return utils.toNumber(item.focusSignals);
    }
    if (mode === 'depositFocus') {
      return utils.toNumber(item.depositFocus);
    }
    if (mode === 'infestation') {
      return utils.toNumber(item.infestationRate);
    }
    return utils.toNumber(item.combinedScore);
  }

  function formatPublicMetricValue(value, mode) {
    if (mode === 'infestation') {
      return utils.toNumber(value).toFixed(1).replace('.', ',') + '%';
    }
    if (mode === 'combined') {
      return utils.toNumber(value).toFixed(1).replace('.', ',');
    }
    return String(utils.toNumber(value));
  }

  function getPublicQuarterRisk(detail, mode) {
    var value = getPublicMetricValue(detail, mode);
    var meta = getPublicMetricMeta(mode);
    if (value >= meta.critical) {
      return { level: 'critico', label: 'Crítico', stroke: '#b72334', fill: '#d94b5a', opacity: 0.4 };
    }
    if (value >= meta.attention) {
      return { level: 'atencao', label: 'Atenção', stroke: '#c48816', fill: '#e8c24b', opacity: 0.3 };
    }
    return { level: 'baixo', label: 'Baixo risco', stroke: '#2f7a52', fill: '#79c18f', opacity: 0.22 };
  }

  function getPublicStatusTone(statusKey, situacao) {
    if (statusKey === 'recovered') {
      return {
        key: 'recovered',
        label: 'Recuperado',
        markerFill: '#2f7a52',
        markerStroke: '#1d5e3f'
      };
    }
    if (statusKey === 'closed') {
      return {
        key: 'closed',
        label: /recusa/i.test(String(situacao || '')) ? 'Recusado' : 'Fechado',
        markerFill: '#c78615',
        markerStroke: '#8d5b08'
      };
    }
    return {
      key: 'open',
      label: 'Aberto/Visitado',
      markerFill: '#2c73d9',
      markerStroke: '#16479f'
    };
  }

  function getPublicVisitTone(visit) {
    if (/recuperado/i.test(visit.situacao)) {
      return getPublicStatusTone('recovered', visit.situacao);
    }
    if (/fechado|recusa/i.test(visit.situacao)) {
      return getPublicStatusTone('closed', visit.situacao);
    }
    return getPublicStatusTone('open', visit.situacao);
  }

  function getPublicMarkerOffset(statusKey) {
    if (statusKey === 'open') {
      return [-0.00035, 0];
    }
    if (statusKey === 'closed') {
      return [0.00022, 0.00032];
    }
    return [0.00032, -0.00026];
  }

  function buildPublicMarkerGroups(quarters) {
    var markers = [];
    (quarters || []).forEach(function (item) {
      if (!item.point) {
        return;
      }
      ['open', 'closed', 'recovered'].forEach(function (statusKey) {
        var count = item.statusCounts && item.statusCounts[statusKey] ? item.statusCounts[statusKey] : 0;
        var offset;
        var tone;
        if (!count) {
          return;
        }
        offset = getPublicMarkerOffset(statusKey);
        tone = getPublicStatusTone(statusKey);
        markers.push({
          lat: item.point[0] + offset[0],
          lng: item.point[1] + offset[1],
          area: item.area,
          quarter: item.quarter,
          toneKey: tone.key,
          statusLabel: tone.label,
          markerFill: tone.markerFill,
          markerStroke: tone.markerStroke,
          visits: count,
          focusSignals: item.focusSignals,
          depositFocus: item.depositFocus,
          deposits: item.deposits
        });
      });
    });
    return markers;
  }

  function getPublicHeatPalette(toneKey) {
    if (toneKey === 'high') {
      return {
        gradient: {
          0.2: 'rgba(200,75,75,0.08)',
          0.55: 'rgba(200,75,75,0.28)',
          1: 'rgba(142,20,36,0.78)'
        }
      };
    }
    if (toneKey === 'medium') {
      return {
        gradient: {
          0.2: 'rgba(232,194,75,0.08)',
          0.55: 'rgba(199,134,21,0.25)',
          1: 'rgba(145,96,6,0.72)'
        }
      };
    }
    return {
      gradient: {
        0.2: 'rgba(47,122,82,0.07)',
        0.55: 'rgba(47,122,82,0.24)',
        1: 'rgba(24,60,44,0.68)'
      }
    };
  }

  function renderTrend(summary) {
    var container = document.getElementById('trendBars');
    if (!summary.dailySeries.length) {
      container.innerHTML = '<div class="empty">O gr\u00e1fico aparecer\u00e1 quando houver visitas p\u00fablicas sincronizadas no per\u00edodo.</div>';
      return;
    }
    var series = summary.dailySeries.slice(-6);
    var max = series.reduce(function (largest, item) {
      return Math.max(largest, item.visits);
    }, 1);
    container.innerHTML = series.map(function (item) {
      var width = Math.max(8, Math.round((item.visits / max) * 100));
      return [
        '<div class="bar-row">',
          '<small>' + escapeHtml(utils.formatDate(item.date)) + '</small>',
          '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>',
          '<strong>' + escapeHtml(String(item.visits)) + '</strong>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderMap(summary) {
    var areaSummary = {};
    var boundsPoints = [];
    var mode = state.territoryMetricMode || 'combined';
    var metricMeta = getPublicMetricMeta(mode);

    if (!state.map) {
      initMap();
    }

    if (state.polygonLayer) {
      state.map.removeLayer(state.polygonLayer);
    }
    if (state.heatLayer) {
      state.map.removeLayer(state.heatLayer);
      state.heatLayer = null;
    }
    if (state.pointLayer) {
      state.map.removeLayer(state.pointLayer);
    }

    summary.topAreas.forEach(function (item) {
      areaSummary[item.area] = item;
    });

    state.polygonLayer = L.layerGroup();
    territoryModel.polygons.forEach(function (polygon) {
      var detail;
      var risk;
      var metricValue;
      var popupLines;
      var layer;
      if (state.area !== 'TODOS' && polygon.folder !== state.area) {
        return;
      }
      detail = areaSummary[polygon.folder] || null;
      risk = getPublicQuarterRisk(detail, mode);
      metricValue = getPublicMetricValue(detail, mode);
      layer = L.polygon(polygon.coordinates, {
        color: risk.stroke,
        weight: detail ? 1.6 : 1.05,
        fillColor: risk.fill,
        fillOpacity: detail ? Math.max(risk.opacity, 0.22) : 0.1
      });
      popupLines = [
        '<strong>' + escapeHtml(utils.titleCase(polygon.folderLabel || polygon.folder || 'Território')) + '</strong>',
        'Classificação: ' + risk.label,
        metricMeta.label + ': ' + formatPublicMetricValue(metricValue, mode)
      ];
      if (detail) {
        popupLines.push('Visitas públicas agregadas: ' + detail.visits);
        popupLines.push('Depósitos com foco: ' + detail.depositFocus);
        popupLines.push('Leitura territorial por bairro/área, sem endereço individual.');
      } else {
        popupLines.push('Sem sinal público relevante no recorte atual.');
      }
      layer.bindPopup(popupLines.join('<br>'));
      state.polygonLayer.addLayer(layer);
      if (polygon.centroid && polygon.centroid.length === 2) {
        boundsPoints.push([polygon.centroid[0], polygon.centroid[1]]);
      }
    });
    state.polygonLayer.addTo(state.map);

    if (boundsPoints.length) {
      state.map.fitBounds(boundsPoints, { padding: [24, 24], maxZoom: 14 });
    } else {
      state.map.setView([-21.935778, -42.607911], 13);
    }

    document.getElementById('mapNote').textContent = summary.topAreas[0]
      ? 'Maior atenção atual: ' + utils.titleCase(summary.topAreas[0].area) + '. O mapa público mostra apenas polígonos territoriais coloridos por ' + metricMeta.label.toLowerCase() + '.'
      : 'O mapa está em modo informativo. Assim que houver registros públicos no período, os territórios aparecerão aqui de forma agregada e segura.';
  }

  function initMap() {
    state.map = L.map('publicMap', {
      zoomControl: true,
      scrollWheelZoom: true,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false
    }).setView([-21.935778, -42.607911], 13);

    state.map.createPane('publicVisitPane');
    state.map.getPane('publicVisitPane').style.zIndex = 650;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
  }

  function preventGestureZoom() {
    var lastTouchEnd = 0;

    document.addEventListener('gesturestart', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturechange', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('gestureend', function (event) {
      event.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', function (event) {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('touchend', function (event) {
      var now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  function colorForScore(score) {
    if (score >= 8) { return '#c84b4b'; }
    if (score >= 4) { return '#d78a22'; }
    if (score >= 1) { return '#4c9d75'; }
    return '#b8c8bf';
  }

  function buildApiUrl(action, params) {
    var config = window.ACS_RUNTIME_CONFIG || {};
    var baseUrl = String(config.API_URL || '').trim();
    var url = new URL(baseUrl);
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(function (key) {
      url.searchParams.set(key, params[key]);
    });
    return url.toString();
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function bootstrap() {
    preventGestureZoom();
    bindEvents();
    syncRangeButtons();
    loadPublicDashboard();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
