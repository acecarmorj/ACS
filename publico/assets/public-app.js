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
    todayIso: function () {
      var now = new Date();
      return now.toISOString().slice(0, 10);
    },
    startIso: function (days) {
      var date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (days - 1));
      return date.toISOString().slice(0, 10);
    },
    clamp: function (value, min, max) {
      return Math.max(min, Math.min(max, value));
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
    return {
      uid: String(raw.uid || '').trim(),
      data: String(raw.data || '').trim(),
      area: area,
      quarter: quarter,
      bairro: String(raw.bairro || '').trim(),
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
      end: end
    });

    return fetch(url, { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Falha ao ler dados publicos.');
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
        document.getElementById('statusPill').textContent = 'Dados publicos atualizados';
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

    visits.forEach(function (visit) {
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
      if (/fechado/i.test(visit.situacao)) { bucket.closed += 1; } else { bucket.opened += 1; }

      areaBucket.visits += 1;
      areaBucket.focusSignals += focusSignal;
      areaBucket.focusVisits += visit.focusFound ? 1 : 0;
      areaBucket.depositFocus += visit.depositFocusCount;
      areaBucket.deposits += visit.depositCount;
    });

    Object.keys(perAreaQuarter).forEach(function (key) {
      var bucket = perAreaQuarter[key];
      var point = resolvePublicPoint(bucket.area, bucket.quarter);
      var intensity = bucket.focusSignals > 0 ? bucket.focusSignals : bucket.visits * 0.35;
      if (point) {
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

    return {
      totalVisits: totalVisits,
      monitoredAreas: Object.keys(monitoredAreas).length,
      areasWithAttention: topAreas.filter(function (item) { return item.focusSignals > 0 || item.depositFocus > 0; }).length,
      totalDepositsFocus: totalDepositsFocus,
      totalFocusSignals: totalFocusSignals,
      gpsCoverage: totalVisits ? Math.round((gpsVisits / totalVisits) * 100) : 0,
      topAreas: topAreas,
      topQuarters: quarters,
      dailySeries: Object.keys(perDay).sort().map(function (key) { return perDay[key]; }),
      heatPoints: heatPoints
    };
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
      ? 'Mapa de calor e leitura publica da vigilancia ambiental'
      : 'Painel publico informativo da vigilancia ambiental';
    document.getElementById('heroDescription').textContent = summary.totalVisits
      ? 'O painel mostra um recorte agregado das acoes realizadas no territorio e das areas que merecem maior atencao coletiva.'
      : 'Mesmo sem registros publicos no periodo selecionado, esta pagina continua orientando a populacao sobre prevencao e vigilancia.';
    document.getElementById('heroBadgePeriod').textContent = 'Recorte atual: ultimos ' + state.days + ' dias';
    document.getElementById('heroBadgeUpdated').textContent = 'Atualizado em ' + state.fetchedAt;
    document.getElementById('heroBadgePrivacy').textContent = 'Mapa publico com leitura territorial agregada';
    document.getElementById('heroPriority').textContent = topArea
      ? 'Area em maior atencao: ' + utils.titleCase(topArea.area)
      : 'Sem area critica identificada no recorte atual';
    document.getElementById('heroPriorityText').textContent = topArea
      ? 'A leitura abaixo ajuda a comunidade a entender as areas com mais sinais de foco e a reforcar a prevencao.'
      : 'Os dados publicos do periodo nao apontam concentracao relevante de focos.';
    document.getElementById('heroTransparencyText').textContent = summary.totalVisits
      ? 'As informacoes sao exibidas de forma agregada, sem divulgar nome de morador ou endereco individual.'
      : 'Assim que novas visitas forem sincronizadas, o painel passara a refletir as acoes em andamento na cidade.';
    document.getElementById('lastUpdateText').textContent = 'Ultima leitura publica: ' + state.fetchedAt;
  }

  function renderMetrics(summary) {
    setText('metricVisits', summary.totalVisits);
    setText('metricVisitsNote', summary.totalVisits ? 'Acoes registradas no periodo selecionado.' : 'Sem visitas sincronizadas neste recorte.');
    setText('metricAreas', summary.monitoredAreas);
    setText('metricAreasNote', summary.monitoredAreas ? 'Territorios com algum registro publico no recorte.' : 'Aguardando registros publicos de territorio.');
    setText('metricAttention', summary.areasWithAttention);
    setText('metricAttentionNote', summary.areasWithAttention ? 'Areas com sinais de foco ou depositos com foco.' : 'Nenhuma area com sinal relevante no periodo.');
    setText('metricDeposits', summary.totalDepositsFocus);
    setText('metricDepositsNote', 'Depositos com foco confirmados no recorte publico.');
  }

  function renderAttentionList(summary) {
    var container = document.getElementById('attentionList');
    if (!summary.topAreas.length) {
      container.innerHTML = '<div class="empty">Sem sinais publicos suficientes para montar um ranking no periodo escolhido.</div>';
      return;
    }

    var max = summary.topAreas[0].focusSignals + summary.topAreas[0].depositFocus + summary.topAreas[0].visits * 0.1 || 1;
    container.innerHTML = summary.topAreas.slice(0, 6).map(function (item) {
      var score = item.focusSignals + item.depositFocus + item.visits * 0.1;
      var width = Math.max(8, Math.round((score / max) * 100));
      return [
        '<div class="list-item">',
          '<strong>' + escapeHtml(utils.titleCase(item.area)) + '</strong>',
          '<span>' + escapeHtml(item.visits + ' visita(s), ' + item.focusSignals + ' sinal(is) de foco e ' + item.depositFocus + ' deposito(s) com foco no recorte.') + '</span>',
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
      container.innerHTML = '<div class="empty">O grafico aparecerá quando houver visitas publicas sincronizadas no periodo.</div>';
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
        popupLines.push('Indice publico de atencao: ' + score.toFixed(1).replace('.', ','));
      } else {
        popupLines.push('Sem sinal publico relevante no recorte atual.');
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
    summary.topQuarters.slice(0, 12).forEach(function (item) {
      var point = resolvePublicPoint(item.area, item.quarter);
      if (!point) {
        return;
      }
      var score = item.focusSignals + item.depositFocus + item.visits * 0.1;
      var marker = L.circleMarker(point, {
        radius: Math.max(7, Math.min(16, 6 + score)),
        color: '#ffffff',
        weight: 2,
        fillColor: colorForScore(score),
        fillOpacity: 0.88
      });
      marker.bindPopup([
        '<strong>' + escapeHtml(utils.titleCase(item.area)) + (item.quarter ? ' - Q ' + escapeHtml(item.quarter) : '') + '</strong>',
        '<br>',
        escapeHtml(item.visits + ' visita(s)'),
        '<br>',
        escapeHtml(item.focusSignals + ' sinal(is) de foco e ' + item.depositFocus + ' deposito(s) com foco')
      ].join(''));
      state.pointLayer.addLayer(marker);
    });
    state.pointLayer.addTo(state.map);

    var note = summary.topAreas[0]
      ? 'Maior atencao atual: ' + utils.titleCase(summary.topAreas[0].area) + '. O mapa usa leitura territorial agregada, sem expor endereco individual.'
      : 'O mapa esta em modo informativo. Assim que houver registros publicos no periodo, as areas de atencao serao destacadas aqui.';
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
