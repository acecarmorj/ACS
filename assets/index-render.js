(function () {
  'use strict';

  var app = window.ACSField;

  app.showMessage = function (text, kind) {
    var node = document.getElementById('syncStatus');
    node.textContent = text;
    node.style.background = kind === 'danger' ? '#8e3131' :
      kind === 'warn' ? '#8d6915' :
      kind === 'accent' ? '#355f9f' : '#203028';
  };

  app.setSyncChip = function (text, kind) {
    var chip = document.getElementById('syncChip');
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
  };

  app.makeMetricCard = function (label, value, kind) {
    return '' +
      '<div class="metric-card' +
      (kind === 'danger' ? ' is-danger' : kind === 'accent' ? ' is-accent' : kind === 'warn' ? ' is-warn' : '') +
      '">' +
        '<small>' + app.escapeHtml(label) + '</small>' +
        '<strong>' + app.escapeHtml(String(value)) + '</strong>' +
      '</div>';
  };

  app.renderWeatherHeader = function () {
    var weather = app.readWeatherCache();
    var wrapper = document.getElementById('weatherHeader');
    var headline = document.getElementById('weatherHeadline');
    var meta = document.getElementById('weatherMeta');
    var alert = document.getElementById('weatherAlert');
    var stamp = document.getElementById('weatherStamp');
    if (!wrapper || !headline || !meta || !alert || !stamp) {
      return;
    }

    wrapper.className = 'weather-strip';
    headline.textContent = 'Clima indisponivel';
    meta.textContent = app.state.weatherLoading ? 'Atualizando clima de Carmo/RJ...' : 'Sem dados do momento.';
    alert.textContent = app.state.weatherLoading ? 'Atualizando' : (navigator.onLine === false ? 'Offline' : 'Sem alerta');
    alert.className = 'weather-pill' + (navigator.onLine === false ? ' is-warn' : '');
    stamp.textContent = weather && weather.updatedAt ? 'Atualizado ' + app.formatTimeHM(weather.updatedAt) : 'Aguardando atualizacao';

    if (!weather) {
      if (navigator.onLine === false) {
        meta.textContent = 'Sem conexao para atualizar o clima agora.';
      }
      return;
    }

    headline.textContent = weather.headline || 'Clima indisponivel';
    meta.textContent = weather.meta || 'Sem leitura operacional de clima.';
    alert.textContent = weather.alertLabel || 'Sem alerta';
    alert.className = 'weather-pill' +
      (weather.alertKind === 'danger' ? ' is-danger' : weather.alertKind === 'warn' ? ' is-warn' : ' is-ok');
    stamp.textContent = 'Atualizado ' + app.formatTimeHM(weather.updatedAt) + (navigator.onLine === false ? ' • offline' : '');
  };

  app.renderHero = function () {
    var snapshot = app.buildLocalSnapshot();
    var visits = snapshot.visits;
    var totals = snapshot.totals;
    var criticalQuarteirao = app.aggregateByField(visits, 'quarteirao', function (visit) {
      return visit.focusFound === 'Sim' || visit.depositFocusTotal > 0;
    })[0];
    var criticalMicroarea = app.aggregateByField(visits, 'microarea', function (visit) {
      return visit.focusFound === 'Sim' || visit.depositFocusTotal > 0;
    })[0];

    document.getElementById('heroVisits').textContent = totals.totalVisits;
    document.getElementById('heroVisitsNote').textContent = totals.visitedProperties + ' imovel(is) trabalhado(s) hoje.';
    document.getElementById('heroFocuses').textContent = totals.focusVisits;
    document.getElementById('heroFocusesNote').textContent = 'Taxa de infestação ' + totals.infestationRate + '% • ' + totals.depositsWithFocus + ' depósito(s) com foco.';
    document.getElementById('heroGps').textContent = totals.gpsCoverage + '%';
    document.getElementById('heroGpsNote').textContent = visits.filter(function (visit) { return visit.gps; }).length + ' visita(s) com georreferenciamento válido.';
    document.getElementById('heroReturns').textContent = totals.returns;
    document.getElementById('heroReturnsNote').textContent = totals.returns ? 'Há imóveis exigindo retorno ou nova tentativa.' : 'Nenhum retorno crítico pendente.';

    if (criticalQuarteirao) {
      document.getElementById('heroPriorityTitle').textContent = 'Quarteirão prioritário: ' + criticalQuarteirao.name;
      document.getElementById('heroPriorityNote').textContent =
        (criticalMicroarea ? 'Microárea ' + criticalMicroarea.name + ' • ' : '') +
        criticalQuarteirao.total + ' ocorrência(s) com foco no dia.';
    } else if (criticalMicroarea) {
      document.getElementById('heroPriorityTitle').textContent = 'Microárea prioritária: ' + criticalMicroarea.name;
      document.getElementById('heroPriorityNote').textContent = criticalMicroarea.total + ' ocorrência(s) com foco no dia.';
    } else {
      document.getElementById('heroPriorityTitle').textContent = 'Nenhum território crítico identificado até o momento.';
      document.getElementById('heroPriorityNote').textContent = 'O sistema recalcula as prioridades após cada nova visita.';
    }

    if (app.state.visit.cardCode) {
      document.getElementById('heroCardTitle').textContent = 'Cartão ' + app.state.visit.cardCode + ' pronto para leitura externa.';
      document.getElementById('heroCardNote').textContent = app.buildCardUrl(app.state.visit.cardCode);
    } else {
      document.getElementById('heroCardTitle').textContent = 'Informe o código do cartão na visita para liberar o cartão virtual.';
      document.getElementById('heroCardNote').textContent = 'O QR code poderá apontar para cartao.html?codigo=...';
    }
  };

  app.renderSelectedPropertyCard = function () {
    var property = app.getSelectedProperty();
    var node = document.getElementById('selectedPropertyCard');
    if (!property) {
      node.innerHTML = '<h3>Nenhum imóvel selecionado</h3><p>Abra a aba de imóveis, pesquise o endereço e toque em <strong>Visitar</strong>.</p>';
      return;
    }

    var history = app.getVisitsForProperty(property);
    var last = history[0];
    var quality = app.computePropertyQuality(property, app.readProperties());
    var pills = [];
    pills.push('<span class="meta-pill">Bairro: ' + app.escapeHtml(property.bairro || '-') + '</span>');
    if (property.microarea || property.quarteirao) {
      pills.push('<span class="meta-pill">MA ' + app.escapeHtml(property.microarea || '-') + ' • Q ' + app.escapeHtml(property.quarteirao || '-') + '</span>');
    }
    pills.push('<span class="meta-pill">Tipo: ' + app.escapeHtml(property.tipo || '-') + '</span>');
    if (property.complemento) {
      pills.push('<span class="meta-pill">Complemento: ' + app.escapeHtml(property.complemento) + '</span>');
    }
    if (property.telefone) {
      pills.push('<span class="meta-pill">Contato: ' + app.escapeHtml(property.telefone) + '</span>');
    }
    if (last) {
      pills.push('<span class="status-pill ' + (last.focusFound === 'Sim' ? 'is-danger' : 'is-ok') + '">Última visita: ' + app.escapeHtml(app.formatDateBR(last.data)) + ' ' + app.escapeHtml(last.hora) + '</span>');
    }
    if (quality.flags.length) {
      pills.push('<span class="status-pill is-warn">' + app.escapeHtml(quality.flags.join(' • ')) + '</span>');
    }
    if (property.gpsTerritory || property.gpsQuarteirao) {
      pills.push('<span class="meta-pill">GPS: ' + app.escapeHtml(property.gpsTerritory || '-') + (property.gpsQuarteirao ? ' • Q ' + app.escapeHtml(property.gpsQuarteirao) : '') + '</span>');
    }

    node.innerHTML = '' +
      '<h3>' + app.escapeHtml(property.logradouro + ', ' + property.numero) + '</h3>' +
      '<p>' + app.escapeHtml((property.morador || 'Morador não informado') + ' • ' + app.getPropertyReferenceText(property)) + '</p>' +
      '<p style="margin-top:8px;color:#66727c">' + app.escapeHtml(last && (last.situacao === 'Fechado' || last.situacao === 'Recusa') ? 'Pendência ativa para retorno.' : 'Imóvel pronto para nova ação de campo.') + '</p>' +
      '<div class="meta-pills">' + pills.join('') + '</div>';
  };

  app.renderGpsStatus = function () {
    var node = document.getElementById('gpsStatus');
    if (!app.state.visit.gps) {
      node.innerHTML = '<span class="status-pill is-warn">GPS ainda não capturado</span>';
      return;
    }
    node.innerHTML = '' +
      '<span class="status-pill is-accent">Lat ' + app.escapeHtml(app.state.visit.gps.lat.toFixed(6)) + '</span>' +
      '<span class="status-pill is-accent">Lng ' + app.escapeHtml(app.state.visit.gps.lng.toFixed(6)) + '</span>' +
      '<span class="status-pill is-ok">Precisão ' + app.escapeHtml(String(Number(app.state.visit.gps.accuracy || 0))) + ' m</span>';
  };

  app.renderChoiceButtons = function (containerId, choices, currentValue, type) {
    document.getElementById(containerId).innerHTML = choices.map(function (choice) {
      var active = currentValue === choice.value ? ' active' : '';
      var danger = choice.danger ? ' is-danger' : '';
      return '' +
        '<button class="choice-btn' + active + danger + '" type="button" data-choice-type="' + app.escapeHtml(type) + '" data-choice-value="' + app.escapeHtml(choice.value) + '">' +
          app.escapeHtml(choice.label) +
          '<span>' + app.escapeHtml(choice.help) + '</span>' +
        '</button>';
    }).join('');
  };

  app.renderQuickNotes = function () {
    document.getElementById('quickNotes').innerHTML = app.CONFIG.QUICK_NOTES.map(function (note) {
      return '<button class="tag" type="button" data-note="' + app.escapeHtml(note) + '">' + app.escapeHtml(note) + '</button>';
    }).join('');
  };

  app.renderDepositGrid = function () {
    var visit = app.state.visit;
    document.getElementById('depositGrid').innerHTML = Object.keys(app.DEPOSITS).map(function (code) {
      var total = Number(visit.depositCounts[code] || 0);
      var focusTotal = Number(visit.depositFocusCounts[code] || 0);
      return '' +
        '<div class="deposit-card' + (total > 0 || focusTotal > 0 ? ' is-active' : '') + '">' +
          '<div class="deposit-top">' +
            '<div><strong>' + app.escapeHtml(code) + '</strong><span>' + app.escapeHtml(app.DEPOSITS[code]) + '</span></div>' +
            '<div class="deposit-total">' + total + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label>Quantidade encontrada</label>' +
            '<div class="stepper">' +
              '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="count" data-step="-1">−</button>' +
              '<input type="number" readonly value="' + total + '">' +
              '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="count" data-step="1">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="deposit-focus-box">' +
            '<div class="check-row">' +
              '<label>Depósito com foco</label>' +
              '<label class="switch">' +
                '<input type="checkbox" data-deposit-check="' + app.escapeHtml(code) + '" ' + (focusTotal > 0 ? 'checked' : '') + '>' +
                '<span></span>' +
              '</label>' +
            '</div>' +
            '<div class="field">' +
              '<label>Quantidade com foco</label>' +
              '<div class="stepper">' +
                '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="focus" data-step="-1">−</button>' +
                '<input type="number" readonly value="' + focusTotal + '">' +
                '<button type="button" data-deposit="' + app.escapeHtml(code) + '" data-mode="focus" data-step="1">+</button>' +
              '</div>' +
              '<div class="field-help">A quantidade com foco nunca ultrapassa a quantidade total do depósito.</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
  };

  app.createVisitSummary = function () {
    var visit = app.state.visit;
    var qualityFlags = app.computeVisitQuality(visit);
    var items = [
      { title: 'Situação', text: visit.situacao },
      { title: 'Foco técnico', text: visit.focusFound + ' • ' + visit.focusQty + ' foco(s)' },
      { title: 'Depósitos', text: app.totalFromMap(visit.depositCounts) + ' depósito(s) • ' + app.totalFromMap(visit.depositFocusCounts) + ' com foco' },
      { title: 'Caixa d\'água', text: visit.waterAccess || 'Não informado' },
      { title: 'Tubitos', text: visit.tubitosQty + ' coletado(s)' },
      { title: 'GPS', text: visit.gps ? 'Capturado com precisão de ' + Number(visit.gps.accuracy || 0) + ' m' : 'Sem GPS capturado' },
      { title: 'Território por GPS', text: app.state.territoryHint ? (app.state.territoryHint.territoryName + ' • Q ' + app.state.territoryHint.quarteirao) : (visit.gpsTerritory || 'Sem classificação automática') },
      { title: 'Cartão virtual', text: visit.cardCode ? 'Código ' + visit.cardCode + ' pronto para leitura QR' : 'Código ainda não informado' },
      { title: 'Assinatura', text: visit.signatureDataUrl ? 'Assinatura do morador coletada.' : 'Assinatura ainda não coletada.' },
      { title: 'Relatório PDF', text: visit.pdfUrl ? 'PDF central já vinculado à visita.' : 'PDF será gerado no Google Drive após a sincronização.' },
      { title: 'Controle de qualidade', text: qualityFlags.length ? qualityFlags.join(' • ') : 'Registro completo para sincronização.' }
    ];
    document.getElementById('visitSummary').innerHTML = items.map(function (item) {
      return '<div class="insight-card"><strong>' + app.escapeHtml(item.title) + '</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(item.text) + '</div></div>';
    }).join('');
  };

  app.renderPhotoPreview = function () {
    var node = document.getElementById('photoPreview');
    var url = app.state.visit.photoDataUrl || app.state.visit.photoUrl;
    if (!url) {
      node.classList.add('hidden');
      node.innerHTML = '';
      return;
    }
    node.classList.remove('hidden');
    node.innerHTML = '<img src="' + app.escapeHtml(url) + '" alt="Foto da visita">';
  };

  app.renderSignatureStatus = function () {
    var node = document.getElementById('signatureStatus');
    if (!node) {
      return;
    }
    if (app.state.visit.signatureDataUrl) {
      node.textContent = 'Assinatura coletada e pronta para o cartão virtual e para o PDF da visita.';
      return;
    }
    node.textContent = 'O morador pode assinar com o dedo ou caneta touch. A assinatura segue para o cartão virtual e para o PDF da visita.';
  };

  app.renderSelectedHistory = function () {
    var property = app.getSelectedProperty();
    var node = document.getElementById('selectedHistory');
    if (!property) {
      node.innerHTML = '<div class="empty-state">Selecione um imóvel para ver o histórico desse endereço.</div>';
      return;
    }
    var history = app.getVisitsForProperty(property).slice(0, 6);
    if (!history.length) {
      node.innerHTML = '<div class="empty-state">Nenhuma visita anterior encontrada para este imóvel.</div>';
      return;
    }
    node.innerHTML = history.map(function (visit) {
      var tags = [];
      tags.push('<span class="tag">' + app.escapeHtml(visit.situacao) + '</span>');
      if (visit.focusFound === 'Sim') {
        tags.push('<span class="status-pill is-danger">' + app.escapeHtml(String(visit.focusQty)) + ' foco(s)</span>');
      }
      if (visit.depositFocusTotal > 0) {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(String(visit.depositFocusTotal)) + ' depósito(s) com foco</span>');
      }
      if (visit.cardCode) {
        tags.push('<span class="status-pill is-accent">' + app.escapeHtml(visit.cardCode) + '</span>');
      }
      return '' +
        '<div class="history-card' + (visit.focusFound === 'Sim' ? ' is-focus' : '') + '">' +
          '<strong>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</strong>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.agente || '-') + ' • MA ' + app.escapeHtml(String(visit.microarea || '-')) + ' • Q ' + app.escapeHtml(String(visit.quarteirao || '-')) + '</div>' +
          '<div class="meta-pills">' + tags.join('') + '</div>' +
          '<div style="margin-top:10px;color:#66727c">' + app.escapeHtml(visit.obs || 'Sem observação registrada.') + '</div>' +
        '</div>';
    }).join('');
  };

  app.fillAgentSelect = function () {
    var select = document.getElementById('loginAgent');
    var agents = app.readAgents().sort(function (a, b) {
      return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
    select.innerHTML = '<option value="">Selecione o agente</option>' + agents.map(function (agent) {
      return '<option value="' + app.escapeHtml(agent.uid) + '">' + app.escapeHtml(agent.nome + ' • ' + agent.matricula + ' • ' + (agent.role || 'ACE')) + '</option>';
    }).join('');
  };

  app.renderAgents = function () {
    var rows = app.readAgents().sort(function (a, b) {
      return a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true });
    });
    var canManage = app.canManageAdmin();
    document.getElementById('agentList').innerHTML = rows.length ? rows.map(function (agent) {
      return '' +
        '<div class="agent-card">' +
          '<strong>' + app.escapeHtml(agent.nome) + '</strong>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(agent.matricula + ' • ' + (agent.role || 'ACE')) + '</div>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml((agent.baseMicroarea || 'Sem microárea-base') + (agent.baseRegion ? ' • ' + agent.baseRegion : '')) + '</div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-soft" type="button" data-agent-edit="' + app.escapeHtml(agent.uid) + '"' + (canManage ? '' : ' disabled') + '>Editar</button>' +
            '<button class="btn btn-danger" type="button" data-agent-delete="' + app.escapeHtml(agent.uid) + '"' + (canManage ? '' : ' disabled') + '>Excluir</button>' +
          '</div>' +
        '</div>';
    }).join('') : '<div class="empty-state">Nenhum agente cadastrado.</div>';
  };

  app.fillPropertyFormOptions = function () {
    var bairros = app.getBairroCatalog();
    var territory = app.getTerritoryCatalog();
    var propBairro = document.getElementById('propBairro');
    var visitBairroSelect = document.getElementById('visitBairroSelect');
    var visitMicroarea = document.getElementById('visitMicroarea');
    var visitQuarteirao = document.getElementById('visitQuarteirao');
    var propMicroarea = document.getElementById('propMicroarea');
    var propQuarteirao = document.getElementById('propQuarteirao');
    var propTipo = document.getElementById('propTipo');
    var propComplemento = document.getElementById('propComplemento');
    var visitLarvicida = document.getElementById('visitLarvicida');
    var visitAdulticida = document.getElementById('visitAdulticida');
    var currentPropertyBairro = propBairro.value;
    var currentVisitBairro = visitBairroSelect ? visitBairroSelect.value : '';
    var currentVisitMicroarea = visitMicroarea ? app.normalizeAreaCode(visitMicroarea.value) : '';
    var currentVisitQuarteirao = visitQuarteirao ? app.normalizeAreaCode(visitQuarteirao.value) : '';
    var currentPropertyMicroarea = propMicroarea ? app.normalizeAreaCode(propMicroarea.value) : '';
    var currentPropertyQuarteirao = propQuarteirao ? app.normalizeAreaCode(propQuarteirao.value) : '';
    var currentPropertyType = propTipo ? propTipo.value : '';
    var currentPropertyComplement = propComplemento ? String(propComplemento.value || '').trim() : '';
    var currentPropertyLogradouro = document.getElementById('propLogradouro') ? String(document.getElementById('propLogradouro').value || '').trim() : '';
    var currentLarvicida = visitLarvicida ? visitLarvicida.value : '';
    var currentAdulticida = visitAdulticida ? visitAdulticida.value : '';

    propBairro.innerHTML = bairros.map(function (bairro) {
      return '<option value="' + app.escapeHtml(bairro) + '">' + app.escapeHtml(bairro) + '</option>';
    }).join('');
    if (currentPropertyBairro && bairros.indexOf(currentPropertyBairro) > -1) {
      propBairro.value = currentPropertyBairro;
    }

    if (visitBairroSelect) {
      visitBairroSelect.innerHTML = '<option value="">Todos os bairros</option>' + bairros.map(function (bairro) {
        return '<option value="' + app.escapeHtml(bairro) + '">' + app.escapeHtml(bairro) + '</option>';
      }).join('');
      if (currentVisitBairro && bairros.indexOf(currentVisitBairro) > -1) {
        visitBairroSelect.value = currentVisitBairro;
      }
    }

    if (document.getElementById('propLogradouroOptions')) {
      document.getElementById('propLogradouroOptions').innerHTML = app.getLogradouroCatalog(propBairro.value).map(function (logradouro) {
        return '<option value="' + app.escapeHtml(logradouro) + '"></option>';
      }).join('');
    }
    if (document.getElementById('propLogradouro')) {
      document.getElementById('propLogradouro').value = currentPropertyLogradouro;
    }

    document.getElementById('propTipo').innerHTML = app.CONFIG.PROPERTY_TYPES.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentPropertyType) {
      document.getElementById('propTipo').value = currentPropertyType;
    }
    if (propComplemento) {
      propComplemento.innerHTML = app.CONFIG.PROPERTY_COMPLEMENTS.map(function (label) {
        return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
      }).join('');
      propComplemento.value = currentPropertyComplement || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    }
    document.getElementById('visitLarvicida').innerHTML = app.CONFIG.LARVICIDAS.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentLarvicida) {
      document.getElementById('visitLarvicida').value = currentLarvicida;
    }
    document.getElementById('visitAdulticida').innerHTML = app.CONFIG.ADULTICIDAS.map(function (label) {
      return '<option value="' + app.escapeHtml(label) + '">' + app.escapeHtml(label) + '</option>';
    }).join('');
    if (currentAdulticida) {
      document.getElementById('visitAdulticida').value = currentAdulticida;
    }

    function fillSelect(node, values, emptyLabel, selectedValue) {
      if (!node) {
        return;
      }
      node.innerHTML = '<option value="">' + app.escapeHtml(emptyLabel) + '</option>' + values.map(function (value) {
        return '<option value="' + app.escapeHtml(value) + '">' + app.escapeHtml(value) + '</option>';
      }).join('');
      if (selectedValue) {
        node.value = selectedValue;
      }
    }

    app.syncAreaSelects = function (microareaNode, quarteiraoNode, selectedValue) {
      var microarea = microareaNode ? app.normalizeAreaCode(microareaNode.value) : '';
      var values = microarea && territory.byMicroarea[microarea] && territory.byMicroarea[microarea].length
        ? territory.byMicroarea[microarea]
        : [];
      fillSelect(quarteiraoNode, values, microarea ? 'Selecione o quarteirão' : 'Selecione primeiro a microárea', selectedValue);
      if (quarteiraoNode) {
        quarteiraoNode.disabled = !microarea;
      }
    };

    fillSelect(visitMicroarea, territory.microareas, 'Selecione a microárea', currentVisitMicroarea);
    fillSelect(propMicroarea, territory.microareas, 'Selecione a microárea', currentPropertyMicroarea);
    app.syncAreaSelects(visitMicroarea, visitQuarteirao, currentVisitQuarteirao);
    app.syncAreaSelects(propMicroarea, propQuarteirao, currentPropertyQuarteirao);
  };

  app.fillPropertyQuickSelect = function () {
    var select = document.getElementById('propertyQuickSelect');
    if (!select) {
      return;
    }
    var currentGps = app.state.visit.gps;
    var sortLabel = document.getElementById('propertySort') && document.getElementById('propertySort').selectedOptions[0]
      ? document.getElementById('propertySort').selectedOptions[0].textContent
      : 'Ordenação atual';
    var selectedBairro = document.getElementById('visitBairroSelect') ? document.getElementById('visitBairroSelect').value : '';
    var selectedMicroarea = app.normalizeAreaCode(document.getElementById('visitMicroarea') ? document.getElementById('visitMicroarea').value : '');
    var selectedQuarteirao = app.normalizeAreaCode(document.getElementById('visitQuarteirao') ? document.getElementById('visitQuarteirao').value : '');
    var currentAgent = app.state.currentAgent || {};
    var rows = app.readProperties().slice().map(function (property) {
      var history = app.getVisitsForProperty(property);
      var last = history[0] || null;
      var distance = currentGps ? app.calcDistanceMeters(currentGps.lat, currentGps.lng, property.lastLat, property.lastLng) : null;
      var score = 0;
      if (property.uid === app.state.selectedPropertyId) {
        score += 1000;
      }
      if (selectedQuarteirao && property.quarteirao === selectedQuarteirao) {
        score += 300;
      }
      if (selectedMicroarea && property.microarea === selectedMicroarea) {
        score += 220;
      }
      if (selectedBairro && property.bairro === selectedBairro) {
        score += 120;
      }
      if (currentAgent.baseMicroarea && property.microarea === currentAgent.baseMicroarea) {
        score += 90;
      }
      if (last && (last.situacao === 'Fechado' || last.situacao === 'Recusa')) {
        score += 180;
      }
      if (distance !== null) {
        score += Math.max(0, 80 - Math.round(distance / 50));
      }
      return {
        property: property,
        distance: distance,
        score: score,
        last: last
      };
    }).sort(function (a, b) {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      var aDistance = a.distance === null ? Number.MAX_SAFE_INTEGER : a.distance;
      var bDistance = b.distance === null ? Number.MAX_SAFE_INTEGER : b.distance;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return app.compareAreaCode(a.property.microarea, b.property.microarea) ||
        app.compareAreaCode(a.property.quarteirao, b.property.quarteirao) ||
        (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
          b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
          'pt-BR',
          { numeric: true, sensitivity: 'base' }
        );
    });
    select.innerHTML = '<option value="">Selecione um imóvel cadastrado</option>' + rows.map(function (row) {
      var property = row.property;
      return '<option value="' + app.escapeHtml(property.uid) + '"' + (property.uid === app.state.selectedPropertyId ? ' selected' : '') + '>' +
        app.escapeHtml([
          row.last && (row.last.situacao === 'Fechado' || row.last.situacao === 'Recusa') ? 'PENDÊNCIA' : '',
          property.microarea ? 'MA ' + property.microarea : '',
          property.quarteirao ? 'Q ' + property.quarteirao : '',
          property.bairro,
          property.logradouro + ', ' + property.numero
        ].filter(Boolean).join(' • ')) +
      '</option>';
    }).join('');
  };

  app.renderProperties = function () {
    var list = app.readProperties();
    var search = String(document.getElementById('propertySearch').value || '').trim().toLowerCase();
    var sortNode = document.getElementById('propertySort');
    var sort = sortNode ? sortNode.value : 'distance';
    var sortLabel = sortNode && sortNode.selectedOptions[0]
      ? sortNode.selectedOptions[0].textContent
      : 'Ordenação atual';
    var currentGps = app.state.visit.gps;
    var visits = app.readVisits();
    var quickFilter = ['all', 'opened', 'closed', 'focus', 'nogps'].indexOf(app.state.propertyQuickFilter) > -1
      ? app.state.propertyQuickFilter
      : 'all';
    var quickFilterLabels = {
      all: 'Todos',
      opened: 'Abertos',
      closed: 'Fechados',
      focus: 'Com foco',
      nogps: 'Sem GPS'
    };
    var matchesQuickFilter = function (row, filterKey) {
      if (filterKey === 'opened') {
        return !!(row.last && row.last.situacao === 'Visitado');
      }
      if (filterKey === 'closed') {
        return !!(row.last && row.last.situacao === 'Fechado');
      }
      if (filterKey === 'focus') {
        return !!(row.last && (row.last.focusFound === 'Sim' || Number(row.last.focusQty || 0) > 0 || Number(row.last.depositFocusTotal || 0) > 0));
      }
      if (filterKey === 'nogps') {
        return !row.hasGps;
      }
      return true;
    };

    var rows = list.map(function (property) {
      var history = visits.filter(function (visit) { return app.addressKey(visit) === app.addressKey(property); }).sort(app.compareVisitDesc);
      var last = history[0] || null;
      var lat = property.lastLat !== null && property.lastLat !== undefined ? property.lastLat : (last && last.gps ? last.gps.lat : null);
      var lng = property.lastLng !== null && property.lastLng !== undefined ? property.lastLng : (last && last.gps ? last.gps.lng : null);
      var distance = currentGps ? app.calcDistanceMeters(currentGps.lat, currentGps.lng, lat, lng) : null;
      return {
        property: property,
        history: history,
        last: last,
        distance: distance,
        hasGps: lat !== null && lng !== null
      };
    });

    if (search) {
      rows = rows.filter(function (row) {
        var text = [
          row.property.morador,
          row.property.telefone,
          row.property.microarea,
          row.property.quarteirao,
          row.property.bairro,
          row.property.logradouro,
          row.property.numero,
          row.property.complemento,
          row.property.referencia,
          row.property.obs
        ].join(' ').toLowerCase();
        return text.indexOf(search) > -1;
      });
    }

    var filterCounts = Object.keys(quickFilterLabels).reduce(function (acc, key) {
      acc[key] = rows.filter(function (row) { return matchesQuickFilter(row, key); }).length;
      return acc;
    }, {});

    rows = rows.filter(function (row) {
      return matchesQuickFilter(row, quickFilter);
    });

    rows.sort(function (a, b) {
      if (sort === 'recent') {
        var keyA = a.last ? a.last.data + ' ' + a.last.hora : '';
        var keyB = b.last ? b.last.data + ' ' + b.last.hora : '';
        return keyB.localeCompare(keyA);
      }
      if (sort === 'bairro') {
        return (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
          b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
          'pt-BR',
          { numeric: true }
        );
      }
      if (sort === 'territory') {
        return app.compareAreaCode(a.property.microarea, b.property.microarea) ||
          app.compareAreaCode(a.property.quarteirao, b.property.quarteirao) ||
          (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
            b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
            'pt-BR',
            { numeric: true, sensitivity: 'base' }
          );
      }
      var aDistance = a.distance === null ? Number.MAX_SAFE_INTEGER : a.distance;
      var bDistance = b.distance === null ? Number.MAX_SAFE_INTEGER : b.distance;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return (a.property.bairro + ' ' + a.property.logradouro + ' ' + a.property.numero).localeCompare(
        b.property.bairro + ' ' + b.property.logradouro + ' ' + b.property.numero,
        'pt-BR',
        { numeric: true }
      );
    });

    var node = document.getElementById('propertyList');
    var cards = rows.map(function (row) {
      var property = row.property;
      var quality = app.computePropertyQuality(property, list);
      var tags = [];
      tags.push(row.distance !== null ?
        '<span class="status-pill is-accent">Distância ' + app.escapeHtml(app.formatDistance(row.distance)) + '</span>' :
        '<span class="status-pill is-warn">Sem ponto GPS do imóvel</span>');
      if (row.last) {
        tags.push('<span class="status-pill ' + (row.last.focusFound === 'Sim' ? 'is-danger' : 'is-ok') + '">Última: ' + app.escapeHtml(app.formatDateBR(row.last.data)) + '</span>');
      }
      if (row.history.length) {
        tags.push('<span class="meta-pill">' + row.history.length + ' visita(s) no histórico</span>');
      }
      if (property.microarea || property.quarteirao) {
        tags.push('<span class="meta-pill">MA ' + app.escapeHtml(String(property.microarea || '-')) + ' • Q ' + app.escapeHtml(String(property.quarteirao || '-')) + '</span>');
      }
      if (row.last && row.last.situacao) {
        tags.push('<span class="meta-pill">Situação: ' + app.escapeHtml(row.last.situacao) + '</span>');
      }
      if (quality.flags.length) {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(quality.flags.join(' • ')) + '</span>');
      }
      return '' +
        '<div class="property-card' + (row.distance !== null ? ' is-near' : '') + (row.last && row.last.focusFound === 'Sim' ? ' is-focus' : '') + '">' +
          '<strong>' + app.escapeHtml(property.logradouro + ', ' + property.numero) + '</strong>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(property.bairro + ' • ' + property.tipo) + '</div>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml((property.morador || 'Morador não informado') + (property.telefone ? ' • ' + property.telefone : '')) + '</div>' +
          '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(app.getPropertyReferenceText(property)) + '</div>' +
          '<div class="meta-pills">' + tags.join('') + '</div>' +
          '<div class="card-actions">' +
            '<button class="btn btn-soft" type="button" data-property-edit="' + app.escapeHtml(property.uid) + '">Editar</button>' +
            '<button class="btn btn-secondary" type="button" data-property-select="' + app.escapeHtml(property.uid) + '">Visitar</button>' +
          '</div>' +
        '</div>';
    }).join('');
    var resultLabel = rows.length + ' imóvel(is) encontrado(s)';
    var filterButtons = Object.keys(quickFilterLabels).map(function (key) {
      return '' +
        '<button class="property-filter-btn' + (quickFilter === key ? ' is-active' : '') + '" type="button" data-property-quick-filter="' + app.escapeHtml(key) + '">' +
          app.escapeHtml(quickFilterLabels[key]) +
          '<span>' + app.escapeHtml(String(filterCounts[key] || 0)) + '</span>' +
        '</button>';
    }).join('');

    node.innerHTML = '' +
      '<div class="property-list-head">' +
        '<div class="property-list-head-top">' +
          '<div>' +
            '<strong>Resultados da consulta</strong>' +
            '<span>' + app.escapeHtml(resultLabel) + (quickFilter !== 'all' ? ' em ' + app.escapeHtml(quickFilterLabels[quickFilter].toLowerCase()) : '') + '</span>' +
          '</div>' +
          '<div class="property-list-meta">' +
            '<span class="meta-pill">' + app.escapeHtml(sortLabel) + '</span>' +
            (search ? '<span class="status-pill is-accent">Busca: ' + app.escapeHtml(search) + '</span>' : '<span class="status-pill is-ok">Sem termo de busca</span>') +
          '</div>' +
        '</div>' +
        '<div class="property-list-filters">' +
          filterButtons +
        '</div>' +
      '</div>' +
      '<div class="property-list-body">' +
        (rows.length ? cards : '<div class="empty-state">Nenhum imóvel encontrado com os filtros atuais.</div>') +
      '</div>';
  };

  app.renderTodayVisitsTable = function () {
    var node = document.getElementById('todayVisitsTable');
    var rows = app.getTodayVisits().sort(app.compareVisitDesc);
    if (!rows.length) {
      node.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#66727c">Nenhuma visita registrada hoje.</td></tr>';
      return;
    }
    node.innerHTML = rows.map(function (visit) {
      return '' +
        '<tr>' +
          '<td>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</td>' +
          '<td><strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br><span style="color:#66727c">' + app.escapeHtml(visit.bairro + ' • ' + visit.agente) + '</span></td>' +
          '<td>' + app.escapeHtml(visit.focusFound + ' • ' + visit.focusQty) + '</td>' +
          '<td>' + app.escapeHtml(String(visit.depositFocusTotal)) + '</td>' +
          '<td>' + app.escapeHtml(visit.waterAccess || '-') + '</td>' +
          '<td><button class="btn btn-soft" type="button" data-visit-edit="' + app.escapeHtml(visit.uid) + '">Editar</button></td>' +
        '</tr>';
    }).join('');
  };

  app.renderLocalPanel = function () {
    var snapshot = app.buildLocalSnapshot();
    var totals = snapshot.totals;

    document.getElementById('localMetricGrid').innerHTML = [
      app.makeMetricCard('Abertos', totals.opened, 'ok'),
      app.makeMetricCard('Fechados', totals.closed, 'warn'),
      app.makeMetricCard('Trabalhados', totals.visitedProperties, 'accent'),
      app.makeMetricCard('Total de imoveis', totals.totalProperties, 'accent'),
      app.makeMetricCard('Recuperados', totals.recovered, 'accent'),
      app.makeMetricCard('Pendências', totals.pending, 'danger'),
      app.makeMetricCard('Tubitos', totals.tubitos, 'warn'),
      app.makeMetricCard('Taxa de infestação', totals.infestationRate + '%', 'danger')
    ].join('');

    var rankingNode = document.getElementById('localDepositSummary');
    var ranking = Object.keys(app.DEPOSITS).map(function (code) {
      return {
        code: code,
        label: app.DEPOSITS[code],
        total: snapshot.depositRanking[code],
        focus: snapshot.depositFocusRanking[code]
      };
    }).filter(function (row) { return row.total > 0 || row.focus > 0; });

    if (!ranking.length) {
      rankingNode.innerHTML = '<div class="empty-state">Nenhum depósito lançado hoje.</div>';
    } else {
      var max = ranking.reduce(function (acc, row) { return Math.max(acc, row.total); }, 1);
      rankingNode.innerHTML = ranking.map(function (row) {
        var width = Math.max(8, Math.round((row.total / max) * 100));
        return '' +
          '<div class="ranking-card">' +
            '<div class="rank-row">' +
              '<strong>' + app.escapeHtml(row.code) + '</strong>' +
              '<div class="bar-track"><div class="bar-fill ' + (row.focus > 0 ? 'is-danger' : '') + '" style="width:' + width + '%"></div></div>' +
              '<strong>' + app.escapeHtml(String(row.total)) + '</strong>' +
            '</div>' +
            '<div style="margin-top:8px;color:#66727c">' + app.escapeHtml(row.label) + ' • ' + app.escapeHtml(String(row.focus)) + ' com foco</div>' +
          '</div>';
      }).join('');
    }

    var recNode = document.getElementById('localRecommendations');
    var recs = [];
    if (totals.infestationRate >= 20) {
      recs.push('Priorize bloqueio e retorno nos pontos com maior carga de depósitos com foco.');
    }
    if (totals.pending > 0) {
      recs.push('Existem pendências no dia; organize nova passagem por quarteirão e microárea.');
    }
    if (totals.gpsCoverage < 80) {
      recs.push('Capture GPS com mais frequência para fortalecer o mapa de calor e a rastreabilidade.');
    }
    if (totals.returns > 0) {
      recs.push('Há imóveis fechados ou recusas; programe nova tentativa de abordagem.');
    }
    if (!recs.length) {
      recs.push('Produção estável. Continue registrando visitas com foco em qualidade de dado.');
    }
    recNode.innerHTML = recs.map(function (text) {
      return '<div class="insight-card"><strong>Encaminhamento</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(text) + '</div></div>';
    }).join('');
  };

  app.renderMapInsights = function () {
    var visits = app.getTodayVisits();
    var focusBairros = app.aggregateByField(visits, 'bairro', function (visit) {
      return visit.focusFound === 'Sim' || visit.depositFocusTotal > 0;
    }).slice(0, 5);
    var returns = visits.filter(function (visit) {
      return visit.situacao === 'Fechado' || visit.situacao === 'Recusa';
    }).slice(0, 5);
    var gpsVisits = visits.filter(function (visit) { return visit.gps; }).sort(app.compareVisitDesc).slice(0, 6);

    var insights = document.getElementById('mapInsights');
    insights.innerHTML = focusBairros.length ? focusBairros.map(function (item, index) {
      return '<div class="insight-card"><strong>' + app.escapeHtml((index + 1) + '. ' + item.name) + '</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(String(item.total)) + ' ocorrência(s) com foco.</div></div>';
    }).join('') : '<div class="empty-state">Sem focos georreferenciados hoje para leitura territorial.</div>';

    if (returns.length) {
      insights.innerHTML += returns.map(function (visit) {
        return '<div class="insight-card"><strong>Retorno sugerido</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.logradouro + ', ' + visit.numero + ' • ' + visit.situacao) + '</div></div>';
      }).join('');
    }

    var timeline = document.getElementById('gpsTimeline');
    timeline.innerHTML = gpsVisits.length ? gpsVisits.map(function (visit) {
      var tags = [];
      tags.push('<span class="tag">' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</span>');
      if (visit.focusFound === 'Sim') {
        tags.push('<span class="status-pill is-danger">' + app.escapeHtml(String(visit.focusQty)) + ' foco(s)</span>');
      }
      if (visit.situacao === 'Fechado' || visit.situacao === 'Recusa') {
        tags.push('<span class="status-pill is-warn">' + app.escapeHtml(visit.situacao) + '</span>');
      }
      return '<div class="history-card"><strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(visit.bairro + ' • ' + visit.agente) + '</div><div class="meta-pills">' + tags.join('') + '</div></div>';
    }).join('') : '<div class="empty-state">Nenhum ponto com GPS capturado no dia.</div>';
  };

  app.renderMap = function () {
    if (app.state.selectedScreen !== 'mapa') {
      return;
    }
    if (!app.state.map) {
      app.state.map = L.map('fieldMap').setView(app.CONFIG.MAP_CENTER, app.CONFIG.MAP_ZOOM);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(app.state.map);
    }

    app.state.mapLayers.forEach(function (layer) {
      app.state.map.removeLayer(layer);
    });
    app.state.mapLayers = [];

    var visits = app.getTodayVisits();
    var points = [];
    var heat = {};

    visits.forEach(function (visit) {
      if (!visit.gps) {
        return;
      }
      var lat = visit.gps.lat;
      var lng = visit.gps.lng;
      var needsReturn = visit.situacao === 'Fechado' || visit.situacao === 'Recusa';
      var color = visit.focusFound === 'Sim' ? '#c34747' : (needsReturn ? '#c78615' : '#2f7a52');
      var marker = L.circleMarker([lat, lng], {
        radius: visit.focusFound === 'Sim' ? 9 : 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(app.state.map);
      marker.bindPopup(
        '<strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong><br>' +
        app.escapeHtml(visit.bairro) + '<br>' +
        'Situação: <strong>' + app.escapeHtml(visit.situacao) + '</strong><br>' +
        'Foco: <strong>' + app.escapeHtml(visit.focusFound) + '</strong><br>' +
        'Depósitos com foco: <strong>' + app.escapeHtml(String(visit.depositFocusTotal)) + '</strong><br>' +
        'Agente: ' + app.escapeHtml(visit.agente || '-')
      );
      app.state.mapLayers.push(marker);
      points.push([lat, lng]);

      if (visit.focusFound === 'Sim' || visit.depositFocusTotal > 0) {
        var key = lat.toFixed(3) + '|' + lng.toFixed(3);
        if (!heat[key]) {
          heat[key] = { lat: lat, lng: lng, weight: 0 };
        }
        heat[key].weight += Math.max(1, visit.focusQty || visit.depositFocusTotal || 1);
      }
    });

    Object.keys(heat).forEach(function (key) {
      var item = heat[key];
      var circle = L.circle([item.lat, item.lng], {
        radius: 80 + (item.weight * 18),
        color: '#355f9f',
        weight: 1,
        fillColor: '#355f9f',
        fillOpacity: Math.min(0.45, 0.12 + (item.weight * 0.04))
      }).addTo(app.state.map);
      circle.bindPopup('Mapa de calor: ' + item.weight + ' ocorrência(s) ponderadas.');
      app.state.mapLayers.push(circle);
      points.push([item.lat, item.lng]);
    });

    if (points.length) {
      app.state.map.fitBounds(points, { padding: [30, 30], maxZoom: 16 });
    } else {
      app.state.map.setView(app.CONFIG.MAP_CENTER, app.CONFIG.MAP_ZOOM);
    }
    setTimeout(function () {
      app.state.map.invalidateSize();
    }, 120);
    app.renderMapInsights();
  };

  app.updateVisitFormFromState = function () {
    var visit = app.state.visit;
    document.getElementById('visitDate').value = visit.data;
    document.getElementById('visitTime').value = visit.hora;
    app.fillPropertyFormOptions();
    document.getElementById('visitMicroarea').value = visit.microarea;
    if (document.getElementById('visitQuarteirao') && typeof app.syncAreaSelects === 'function') {
      app.syncAreaSelects(document.getElementById('visitMicroarea'), document.getElementById('visitQuarteirao'), visit.quarteirao);
    }
    document.getElementById('visitFocusQty').value = visit.focusQty;
    document.getElementById('visitTubitosQty').value = visit.tubitosQty;
    document.getElementById('visitLarvicida').value = visit.larvicida;
    document.getElementById('visitLarvicidaQty').value = visit.larvicidaQty;
    document.getElementById('visitAdulticida').value = visit.adulticida;
    document.getElementById('visitAdulticidaQty').value = visit.adulticidaQty;
    document.getElementById('visitCardCode').value = visit.cardCode;
    document.getElementById('visitObs').value = visit.obs;

    app.renderChoiceButtons('situacaoChoices', [
      { value: 'Visitado', label: 'Visitado', help: 'Imóvel aberto e trabalhado.' },
      { value: 'Fechado', label: 'Fechado', help: 'Não foi possível acessar o imóvel.' },
      { value: 'Recuperado', label: 'Recuperado', help: 'Retorno realizado com sucesso.' },
      { value: 'Recusa', label: 'Recusa', help: 'Morador recusou a entrada.', danger: true }
    ], visit.situacao, 'situacao');

    app.renderChoiceButtons('focusChoices', [
      { value: 'Não', label: 'Sem foco', help: 'Não houve foco confirmado.' },
      { value: 'Sim', label: 'Com foco', help: 'Houve foco confirmado na visita.', danger: true }
    ], visit.focusFound, 'focus');

    app.renderChoiceButtons('waterAccessChoices', [
      { value: 'Sim', label: 'Sim', help: 'A caixa d\'água foi acessada.' },
      { value: 'Não', label: 'Não', help: 'Não foi possível acessar a caixa d\'água.' }
    ], visit.waterAccess, 'water');

    app.renderDepositGrid();
    app.renderGpsStatus();
    app.renderPhotoPreview();
    app.renderSignatureStatus();
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
    if (typeof app.renderSignatureCanvas === 'function') {
      app.renderSignatureCanvas();
    }
  };

  app.renderAll = function () {
    app.renderWeatherHeader();
    app.renderHero();
    app.updateVisitFormFromState();
    app.fillPropertyQuickSelect();
    app.renderProperties();
    app.renderTodayVisitsTable();
    app.renderLocalPanel();
    if (typeof app.renderSyncCenter === 'function') {
      app.renderSyncCenter();
    }
    if (typeof app.renderAdminSystemPanel === 'function') {
      app.renderAdminSystemPanel();
    }
    if (typeof app.renderGpsTerritoryStatus === 'function') {
      app.renderGpsTerritoryStatus();
    }
    app.renderMap();
  };
}());
