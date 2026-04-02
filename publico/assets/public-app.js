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
    pointLayer: null
  };

  var TERRITORY = window.ACE_TERRITORY_SOURCE || { polygons: [], points: [] };
  var IGNORED_FOLDERS = {
    CARMO: true,
    'CAMPO DE FUTEBOL': true,
    PRACAS: true,
    'PRAÇAS': true,
    PE: true,
    'MORRO DO ESTADO': true
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
    BOTAFOGO: 'BOTAFOGO',
    CENTRO: 'CENTRO',
    PROGRESSO: 'PROGRESSO',
    'ULISSES LEMGRUBER': 'ULISSES LEMGRUBER',
    'BOA IDEIA': 'BOA IDEIA',
    'PORTO VELHO': 'PORTO VELHO',
    'PORTO VELHO DO CUNHA': 'PORTO VELHO DO CUNHA',
    'BARRA DE SAO FRANCISCO': 'BARRA DE SAO FRANCISCO',
    'CORREGO DA PRATA': 'CORREGO DA PRATA',
    'ILHA DOS POMBOS (LIGHT)': 'ILHA DOS POMBOS (LIGHT)',
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
        .replace(/\./g, '')
        .replace(/CAIXA DAGUA/g, 'CAIXA DAGUA');
      return areaDictionary[normalized] || normalized;
    },
    normalizeQuarter: function (value) {
      var normalized = utils.normalizeText(value)
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
      polygons: []
    };

    TERRITORY.points.forEach(function (point) {
      var folder = utils.normalizeArea(point.folder || '');
      if (!folder || IGNORED_FOLDERS[folder]) {
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
    });

    TERRITORY.polygons.forEach(function (polygon) {
      var folder = utils.normalizeArea(polygon.folder || '');
      if (!folder || IGNORED_FOLDERS[folder]) {
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

    return model;
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

  function bindEvents() {
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

    document.getElementById('areaFilter').addEventListener('change', function (event) {
      state.area = event.target.value;
      applyFilterAndRender();
    });
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
    renderAttentionList(summary);
    renderTrend(summary);
    renderMap(summary);
  }

  function buildSummary(visits) {
    var perAreaQuarter = {};
    var perArea = {};
    var perDay = {};
    var monitoredAreas = {};
    var heatPoints = [];
    var visitPoints = [];
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
          gps: 0
        };
      }

      if (!perArea[areaKey]) {
        perArea[areaKey] = {
          area: areaKey,
          visits: 0,
          focusSignals: 0,
          focusVisits: 0,
          depositFocus: 0,
          deposits: 0
        };
      }

      var bucket = perAreaQuarter[quarterKey];
      var areaBucket = perArea[areaKey];
      var focusSignal = visit.focusCount + visit.depositFocusCount;

      bucket.visits += 1;
      bucket.focusSignals += focusSignal;
      bucket.focusVisits += visit.focusFound ? 1 : 0;
      bucket.depositFocus += visit.depositFocusCount;
      bucket.deposits += visit.depositCount;
      bucket.gps += visit.gpsLat !== null && visit.gpsLng !== null ? 1 : 0;
      if (/fechado|recusa/i.test(visit.situacao)) { bucket.closed += 1; }
      if (/visitado/i.test(visit.situacao)) { bucket.opened += 1; }

      areaBucket.visits += 1;
      areaBucket.focusSignals += focusSignal;
      areaBucket.focusVisits += visit.focusFound ? 1 : 0;
      areaBucket.depositFocus += visit.depositFocusCount;
      areaBucket.deposits += visit.depositCount;

      if (visit.gpsLat !== null && visit.gpsLng !== null) {
        heatPoints.push([visit.gpsLat, visit.gpsLng, utils.clamp((focusSignal > 0 ? focusSignal : 1), 0.2, 8)]);
        visitPoints.push({
          lat: visit.gpsLat,
          lng: visit.gpsLng,
          area: visit.area,
          quarter: visit.quarter,
          data: visit.data,
          hora: visit.hora,
          situacao: visit.situacao,
          focusSignals: focusSignal
        });
      }
    });

    Object.keys(perAreaQuarter).forEach(function (key) {
      var bucket = perAreaQuarter[key];
      var point = resolvePublicPoint(bucket.area, bucket.quarter);
      var intensity = bucket.focusSignals > 0 ? bucket.focusSignals : bucket.visits * 0.35;
      if (point && !bucket.gps) {
        heatPoints.push([point[0], point[1], utils.clamp(intensity || 0.2, 0.2, 8)]);
      }
    });

    var topAreas = Object.keys(perArea)
      .map(function (key) { return perArea[key]; })
      .sort(function (a, b) {
        return (b.focusSignals + b.depositFocus + b.visits * 0.1) - (a.focusSignals + a.depositFocus + a.visits * 0.1);
      });

    var quarters = Object.keys(perAreaQuarter)
      .map(function (key) { return perAreaQuarter[key]; })
      .sort(function (a, b) {
        return (b.focusSignals + b.depositFocus + b.visits * 0.1) - (a.focusSignals + a.depositFocus + a.visits * 0.1);
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
      topQuarters: quarters,
      dailySeries: Object.keys(perDay).sort().map(function (key) { return perDay[key]; }),
      heatPoints: heatPoints,
      visitPoints: visitPoints,
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

  function renderHero(summary) {
    var areaLabel = state.area === 'TODOS' ? 'Toda a cidade' : utils.titleCase(state.area);
    var topArea = summary.topAreas[0];
    document.getElementById('heroArea').textContent = areaLabel;
    document.getElementById('heroHeadline').textContent = summary.totalVisits
      ? 'Mapa de calor e leitura p\u00fablica da Coordena\u00e7\u00e3o de Combate \u00e0s Endemias'
      : 'Painel p\u00fablico informativo da Coordena\u00e7\u00e3o de Combate \u00e0s Endemias';
    document.getElementById('heroDescription').textContent = summary.totalVisits
      ? 'O painel mostra um recorte agregado das a\u00e7\u00f5es realizadas no territ\u00f3rio e das \u00e1reas que merecem maior aten\u00e7\u00e3o coletiva.'
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

  function renderTrend(summary) {
    var container = document.getElementById('trendBars');
    if (!summary.dailySeries.length) {
      container.innerHTML = '<div class="empty">O gr\u00e1fico aparecer\u00e1 quando houver visitas p\u00fablicas sincronizadas no per\u00edodo.</div>';
      return;
    }
    var series = summary.dailySeries.slice(-8);
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
    if (!state.map) {
      initMap();
    }

    if (state.polygonLayer) {
      state.map.removeLayer(state.polygonLayer);
    }
    if (state.heatLayer) {
      state.map.removeLayer(state.heatLayer);
    }
    if (state.pointLayer) {
      state.map.removeLayer(state.pointLayer);
    }

    var areaScores = {};
    summary.topAreas.forEach(function (item) {
      areaScores[item.area] = item.focusSignals + item.depositFocus + item.visits * 0.1;
    });

    var quarterScores = {};
    summary.topQuarters.forEach(function (item) {
      quarterScores[item.area + '|' + item.quarter] = item.focusSignals + item.depositFocus + item.visits * 0.1;
    });

    state.polygonLayer = L.layerGroup();
    territoryModel.polygons.forEach(function (polygon) {
      if (state.area !== 'TODOS' && polygon.folder !== state.area) {
        return;
      }
      var quarterKey = polygon.folder + '|' + polygon.quarter;
      var score = quarterScores[quarterKey] || areaScores[polygon.folder] || 0;
      var fillColor = colorForScore(score);
      var layer = L.polygon(polygon.coordinates, {
        color: score > 0 ? fillColor : '#8aa497',
        weight: score > 0 ? 1.8 : 1.1,
        fillColor: fillColor,
        fillOpacity: score > 0 ? 0.36 : 0.12
      });
      var popupLines = [
        '<strong>' + escapeHtml(utils.titleCase(polygon.folderLabel)) + (polygon.quarterLabel ? ' - ' + escapeHtml(polygon.quarterLabel) : '') + '</strong>'
      ];
      if (score > 0) {
        popupLines.push('\u00cdndice p\u00fablico de aten\u00e7\u00e3o: ' + score.toFixed(1).replace('.', ','));
      } else {
        popupLines.push('Sem sinal p\u00fablico relevante no recorte atual.');
      }
      layer.bindPopup(popupLines.join('<br>'));
      state.polygonLayer.addLayer(layer);
    });
    state.polygonLayer.addTo(state.map);

    if (summary.heatPoints.length && window.L && typeof L.heatLayer === 'function') {
      state.heatLayer = L.heatLayer(summary.heatPoints, {
        radius: 32,
        blur: 24,
        maxZoom: 16,
        minOpacity: 0.35,
        gradient: {
          0.2: '#4c9d75',
          0.45: '#d79a28',
          0.75: '#d96f36',
          1: '#c84b4b'
        }
      }).addTo(state.map);
    }

    state.pointLayer = L.layerGroup();
    summary.visitPoints.forEach(function (item) {
      var score = item.focusSignals || 0;
      var marker = L.circleMarker([item.lat, item.lng], {
        radius: score > 0 ? 6.5 : 5,
        color: '#ffffff',
        weight: 1.5,
        fillColor: score > 0 ? '#c84b4b' : '#2f7a52',
        fillOpacity: 0.72
      });
      marker.bindPopup([
        '<strong>Visita pública georreferenciada</strong>',
        '<br>',
        escapeHtml((item.data ? utils.formatDate(item.data) : '--') + (item.hora ? ' ' + item.hora : '')),
        '<br>',
        escapeHtml(utils.titleCase(item.area || 'Território não informado')),
        item.quarter ? '<br>Q ' + escapeHtml(item.quarter) : '',
        '<br>',
        escapeHtml('Situação: ' + (item.situacao || '-'))
      ].join(''));
      state.pointLayer.addLayer(marker);
    });
    state.pointLayer.addTo(state.map);

    var note = summary.topAreas[0]
      ? 'Maior aten\u00e7\u00e3o atual: ' + utils.titleCase(summary.topAreas[0].area) + '. O mapa exibe calor territorial e pontos públicos georreferenciados sem nome de morador.'
      : 'O mapa est\u00e1 em modo informativo. Assim que houver registros p\u00fablicos no per\u00edodo, as \u00e1reas de aten\u00e7\u00e3o ser\u00e3o destacadas aqui.';
    document.getElementById('mapNote').textContent = note;
  }

  function initMap() {
    state.map = L.map('publicMap', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([-21.935778, -42.607911], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
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
    bindEvents();
    syncRangeButtons();
    loadPublicDashboard();
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
