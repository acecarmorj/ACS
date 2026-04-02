(function () {
  'use strict';

  var app = window.ACSField;

  app.clearAgentForm = function () {
    document.getElementById('agentName').value = '';
    document.getElementById('agentCode').value = '';
    document.getElementById('agentPassword').value = '';
    if (document.getElementById('agentRole')) {
      document.getElementById('agentRole').value = 'ACE';
    }
    if (document.getElementById('agentBaseMicroarea')) {
      document.getElementById('agentBaseMicroarea').value = '';
    }
    if (document.getElementById('agentBaseRegion')) {
      document.getElementById('agentBaseRegion').value = '';
    }
    document.getElementById('saveAgentBtn').removeAttribute('data-edit-id');
  };

  app.openAdminModal = function () {
    document.getElementById('adminModal').classList.add('show');
    app.renderAgents();
    app.renderAdminSystemPanel();
  };

  app.closeAdminModal = function () {
    document.getElementById('adminModal').classList.remove('show');
    app.clearAgentForm();
  };

  app.ensureDynamicLayout = function () {
    var loginTitle = document.querySelector('.login-card h1');
    var loginText = document.querySelector('.login-card p');
    var headerTitle = document.querySelector('.brand-copy h1');
    var adminTitle = document.querySelector('#adminModal h3');
    var openAdminBtn = document.getElementById('openAdminBtn');
    var headerAdminBtn = document.getElementById('headerAdminBtn');
    var agentCode = document.getElementById('agentCode');
    var heroCardLabel = document.querySelector('#heroCardTitle');
    var heroCardNote = document.querySelector('#heroCardNote');

    if (loginTitle) { loginTitle.textContent = 'ACE Campo'; }
    if (loginText) { loginText.textContent = 'Sistema mobile-first para ACE, com visitas, cadastro territorial e sincronização com Google Sheets.'; }
    if (headerTitle) { headerTitle.textContent = 'ACE Campo | Visitas e vigilância territorial'; }
    if (adminTitle) { adminTitle.textContent = 'Cadastro de ACE'; }
    if (openAdminBtn) { openAdminBtn.textContent = 'Cadastro de ACE'; }
    if (headerAdminBtn) { headerAdminBtn.textContent = 'ACE'; }
    if (agentCode) { agentCode.placeholder = 'Ex.: ACE001'; }
    if (heroCardLabel && !app.state.visit.cardCode) {
      heroCardLabel.textContent = 'Informe o código do cartão na visita para liberar o cartão virtual.';
    }
    if (heroCardNote && !app.state.visit.cardCode) {
      heroCardNote.textContent = 'O QR impresso deve apontar para cartao.html?codigo=...';
    }

    if (!document.getElementById('gpsTerritoryStatus')) {
      var gpsStatus = document.getElementById('gpsStatus');
      if (gpsStatus && gpsStatus.parentNode) {
        gpsStatus.insertAdjacentHTML('afterend', '<div id="gpsTerritoryStatus" class="field-help" style="margin-top:10px"></div>');
      }
    }

    if (!document.querySelector('.app-credit')) {
      var footer = document.createElement('footer');
      footer.className = 'app-credit';
      footer.textContent = 'Desenvolvido por Almir Lemgruber @ALMRLK';
      var adminModal = document.getElementById('adminModal');
      if (adminModal && adminModal.parentNode) {
        adminModal.parentNode.insertBefore(footer, adminModal);
      }
    }

    if (!document.getElementById('selectedPropertyActions')) {
      var selectedCardNode = document.getElementById('selectedPropertyCard');
      if (selectedCardNode && selectedCardNode.parentNode) {
        selectedCardNode.insertAdjacentHTML('afterend', '' +
          '<div id="selectedPropertyActions" class="btn-row compact-actions" style="margin-top:16px">' +
            '<button class="btn btn-soft" id="nextPropertyBtn" type="button">Próximo imóvel</button>' +
            '<button class="btn btn-soft" id="routePropertyBtn" type="button">Abrir rota</button>' +
            '<button class="btn btn-soft" id="pendingPropertiesBtn" type="button">Pendências</button>' +
          '</div>');
      }
    }

    if (!document.getElementById('signatureCanvas')) {
      var quickNotes = document.getElementById('quickNotes');
      if (quickNotes && quickNotes.parentNode && quickNotes.parentNode.parentNode) {
        var field = document.createElement('div');
        field.className = 'field';
        field.style.marginTop = '16px';
        field.innerHTML = '' +
          '<label>Assinatura do morador</label>' +
          '<div class="signature-shell"><canvas id="signatureCanvas" width="900" height="240"></canvas></div>' +
          '<div class="btn-row" style="margin-top:12px">' +
            '<button class="btn btn-soft" id="clearSignatureBtn" type="button">Limpar assinatura</button>' +
            '<button class="btn btn-secondary" id="captureSignatureBtn" type="button">Confirmar assinatura</button>' +
          '</div>' +
          '<div id="signatureStatus" class="field-help">O morador pode assinar com o dedo ou caneta touch. A assinatura segue para o cartão virtual e para o PDF da visita.</div>';
        quickNotes.parentNode.parentNode.insertBefore(field, quickNotes.parentNode);
      }
    }

    if (!document.getElementById('visitBairroSelect')) {
      var visitSelectedCard = document.getElementById('selectedPropertyCard');
      if (visitSelectedCard && visitSelectedCard.parentNode) {
        var bairroSelect = document.createElement('div');
        bairroSelect.className = 'field';
        bairroSelect.style.marginBottom = '16px';
        bairroSelect.innerHTML = '' +
          '<label for="visitBairroSelect">Bairro da visita</label>' +
          '<select id="visitBairroSelect"><option value="">Todos os bairros</option></select>';
        visitSelectedCard.parentNode.insertBefore(bairroSelect, visitSelectedCard);
      }
    }

    if (!document.getElementById('propertyQuickSelect')) {
      var selectedCard = document.getElementById('selectedPropertyCard');
      if (selectedCard && selectedCard.parentNode) {
        var quickSelect = document.createElement('div');
        quickSelect.className = 'field';
        quickSelect.style.marginBottom = '16px';
        quickSelect.innerHTML = '' +
          '<label for="propertyQuickSelect">Endereço da visita</label>' +
          '<select id="propertyQuickSelect"><option value="">Selecione um imóvel cadastrado</option></select>' +
          '<div class="field-help">A lista prioriza microárea, quarteirão, bairro e proximidade do agente.</div>';
        selectedCard.parentNode.insertBefore(quickSelect, selectedCard);
      }
    }

    if (!document.getElementById('visitOutputActions')) {
      var photoPreview = document.getElementById('photoPreview');
      if (photoPreview && photoPreview.parentNode) {
        photoPreview.insertAdjacentHTML('afterend', '' +
          '<div id="visitOutputActions" class="btn-row compact-actions" style="margin-top:16px">' +
            '<button class="btn btn-soft" id="previewVisitReportBtn" type="button">Pré-visualizar relatório</button>' +
            '<button class="btn btn-soft" id="openVisitPdfBtn" type="button">Abrir PDF sincronizado</button>' +
          '</div>');
      }
    }

    function rebuildAreaField(fieldId, label, help, emptyLabel) {
      var input = document.getElementById(fieldId);
      var field = input ? input.closest('.field') : null;
      if (!field) {
        return;
      }
      field.innerHTML = '' +
        '<label for="' + fieldId + '">' + label + '</label>' +
        '<select id="' + fieldId + '">' +
          '<option value="">' + emptyLabel + '</option>' +
        '</select>' +
        '<div class="field-help">' + help + '</div>';
    }

    rebuildAreaField(
      'visitMicroarea',
      'Microárea',
      'Escolha a microárea para liberar apenas os quarteirões correspondentes.',
      'Selecione a microárea'
    );
    rebuildAreaField(
      'visitQuarteirao',
      'Quarteirão',
      'Depois da microárea, o sistema mostra só os quarteirões daquele setor.',
      'Selecione primeiro a microárea'
    );

    if (!document.getElementById('propMicroarea')) {
      var complementoField = document.getElementById('propComplemento');
      if (complementoField) {
        var extraRow = document.createElement('div');
        extraRow.className = 'grid two';
        extraRow.style.marginTop = '16px';
        extraRow.innerHTML = '' +
          '<div class="field">' +
            '<label for="propMicroarea">Microárea</label>' +
            '<select id="propMicroarea"><option value="">Selecione a microárea</option></select>' +
            '<div class="field-help">Use a microárea operacional do imóvel.</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="propQuarteirao">Quarteirão</label>' +
            '<select id="propQuarteirao"><option value="">Selecione primeiro a microárea</option></select>' +
            '<div class="field-help">A lista é filtrada pela microárea escolhida.</div>' +
          '</div>';
        var grid = complementoField.closest('.grid');
        if (grid && grid.parentNode) {
          grid.parentNode.insertBefore(extraRow, grid.nextSibling);
        }
      }
    } else if (document.getElementById('propMicroarea').tagName !== 'SELECT') {
      document.getElementById('propMicroarea').closest('.field').innerHTML = '' +
        '<label for="propMicroarea">Microárea</label>' +
        '<select id="propMicroarea"><option value="">Selecione a microárea</option></select>' +
        '<div class="field-help">Use a microárea operacional do imóvel.</div>';
      document.getElementById('propQuarteirao').closest('.field').innerHTML = '' +
        '<label for="propQuarteirao">Quarteirão</label>' +
        '<select id="propQuarteirao"><option value="">Selecione primeiro a microárea</option></select>' +
        '<div class="field-help">A lista é filtrada pela microárea escolhida.</div>';
    }

    var propertySearch = document.getElementById('propertySearch');
    if (propertySearch) {
      propertySearch.placeholder = 'Nome, microárea, quarteirão, bairro, rua, número ou telefone';
    }

    if (document.getElementById('propLogradouro')) {
      document.getElementById('propLogradouro').setAttribute('list', 'propLogradouroOptions');
      if (!document.getElementById('propLogradouroOptions')) {
        document.body.insertAdjacentHTML('beforeend', '<datalist id="propLogradouroOptions"></datalist>');
      }
    }

    var propertySort = document.getElementById('propertySort');
    if (propertySort && !propertySort.querySelector('option[value="territory"]')) {
      var distanceOption = propertySort.querySelector('option[value="distance"]');
      if (distanceOption) {
        distanceOption.insertAdjacentHTML('afterend', '<option value="territory">Por microárea / quarteirão</option>');
      } else {
        propertySort.insertAdjacentHTML('beforeend', '<option value="territory">Por microárea / quarteirão</option>');
      }
      if (!propertySort.value) {
        propertySort.value = 'distance';
      }
    }

    if (!document.getElementById('syncCenterGrid')) {
      var actionsCard = document.getElementById('syncNowBtn');
      if (actionsCard) {
        var actionsWrap = actionsCard.closest('.card');
        if (actionsWrap) {
          actionsWrap.insertAdjacentHTML('afterend', '' +
            '<section class="card">' +
              '<h2 class="section-title">Centro de sincronização e gestão local</h2>' +
              '<div id="syncCenterGrid" class="grid four"></div>' +
              '<div class="btn-row" style="margin-top:16px">' +
                '<button class="btn btn-soft" id="exportBackupBtn" type="button">Exportar backup JSON</button>' +
                '<button class="btn btn-soft" id="downloadQueueBtn" type="button">Baixar fila local</button>' +
              '</div>' +
              '<div id="syncQueueList" class="history-list" style="margin-top:16px"></div>' +
            '</section>');
        }
      }
    }

    if (!document.getElementById('agentRole')) {
      var modalGrid = document.querySelector('#adminModal .grid.three');
      if (modalGrid && modalGrid.parentNode) {
        modalGrid.insertAdjacentHTML('afterend', '' +
          '<div class="grid three" style="margin-top:16px">' +
            '<div class="field">' +
              '<label for="agentRole">Perfil de acesso</label>' +
              '<select id="agentRole"></select>' +
            '</div>' +
            '<div class="field">' +
              '<label for="agentBaseMicroarea">Microárea-base</label>' +
              '<input id="agentBaseMicroarea" type="text" placeholder="Ex.: M02 - Boa Ideia">' +
            '</div>' +
            '<div class="field">' +
              '<label for="agentBaseRegion">Região / referência</label>' +
              '<input id="agentBaseRegion" type="text" placeholder="Bairro, distrito ou setor">' +
            '</div>' +
          '</div>' +
          '<section class="card" id="adminSystemPanel" style="margin-top:18px;padding:18px">' +
            '<h2 class="section-title">Parâmetros e segurança</h2>' +
            '<div id="adminSystemSummary" class="insight-list"></div>' +
          '</section>');
      }
    }

    if (document.getElementById('agentRole')) {
      document.getElementById('agentRole').innerHTML = app.CONFIG.AGENT_ROLES.map(function (role) {
        return '<option value="' + app.escapeHtml(role) + '">' + app.escapeHtml(role) + '</option>';
      }).join('');
    }
  };

  app.canManageAdmin = function () {
    var agents = app.readAgents();
    if (!agents.length) {
      return true;
    }
    if (!app.state.currentAgent) {
      return true;
    }
    return app.isManagerRole(app.state.currentAgent.role);
  };

  app.renderAdminSystemPanel = function () {
    var node = document.getElementById('adminSystemSummary');
    if (!node) {
      return;
    }
    var health = app.getServiceHealth();
    var currentAgent = app.state.currentAgent;
    var items = [
      'Versão: ' + app.CONFIG.APP_VERSION + '.',
      'Modo de sincronização: ' + (app.isApiConfigured() ? 'Google Sheets conectado.' : 'Modo local sem API configurada.'),
      'Fila local: ' + health.queue + ' visita(s) aguardando envio.',
      health.lastSyncAt ? 'Última sincronização: ' + health.lastSyncAt + '.' : 'Ainda não houve sincronização concluída nesta versão.',
      health.lastBackupAt ? 'Último backup exportado: ' + health.lastBackupAt + '.' : 'Backup local ainda não exportado.',
      currentAgent ? 'Sessão atual: ' + currentAgent.nome + ' • ' + currentAgent.role + '.' : 'Sem sessão ativa no momento.'
    ];
    if (health.lastSyncError) {
      items.push('Último alerta de sincronização: ' + health.lastSyncError + '.');
    }
    node.innerHTML = items.map(function (text) {
      return '<div class="insight-card"><strong>Gestão</strong><div style="margin-top:6px;color:#66727c">' + app.escapeHtml(text) + '</div></div>';
    }).join('');
    if (document.getElementById('saveAgentBtn')) {
      document.getElementById('saveAgentBtn').disabled = !app.canManageAdmin();
    }
  };

  app.renderGpsTerritoryStatus = function () {
    var node = document.getElementById('gpsTerritoryStatus');
    if (!node) {
      return;
    }
    if (!app.state.visit.gps) {
      node.textContent = 'Classificação territorial por GPS ainda indisponível.';
      return;
    }
    if (app.state.territoryHint) {
      node.textContent = 'GPS classificado em ' + app.state.territoryHint.territoryName + ' • Q ' + app.state.territoryHint.quarteirao + '.';
      return;
    }
    node.textContent = 'GPS capturado, mas sem polígono territorial correspondente no KMZ.';
  };

  app.renderSyncCenter = function () {
    var grid = document.getElementById('syncCenterGrid');
    var list = document.getElementById('syncQueueList');
    if (!grid || !list) {
      return;
    }
    var health = app.getServiceHealth();
    var pendingVisits = app.getUnsyncedVisits().sort(app.compareVisitDesc);
    grid.innerHTML = [
      app.makeMetricCard('Fila local', health.queue, health.queue ? 'warn' : 'ok'),
      app.makeMetricCard('Rede', health.offline ? 'Offline' : 'Online', health.offline ? 'danger' : 'accent'),
      app.makeMetricCard('Pendência geral', health.pendingSync ? 'Sim' : 'Não', health.pendingSync ? 'warn' : 'ok'),
      app.makeMetricCard('Backup', health.lastBackupAt ? 'Exportado' : 'Pendente', health.lastBackupAt ? 'accent' : 'warn')
    ].join('');

    if (!pendingVisits.length) {
      list.innerHTML = '<div class="empty-state">' + app.escapeHtml(
        health.pendingSync
          ? 'Não há visita pendente, mas ainda existem alterações administrativas aguardando sincronização' + (health.pendingReason ? ' (' + health.pendingReason + ')' : '') + '.'
          : 'Nenhuma visita pendente. A fila local está limpa.'
      ) + '</div>';
      return;
    }
    list.innerHTML = pendingVisits.slice(0, 8).map(function (visit) {
      var quality = app.computeVisitQuality(visit);
      return '<div class="history-card">' +
        '<strong>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero) + '</strong>' +
        '<div style="margin-top:6px;color:#66727c">' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora + ' • ' + (visit.bairro || '-')) + '</div>' +
        '<div class="meta-pills">' +
          '<span class="status-pill is-warn">Aguardando sync</span>' +
          (quality.length ? '<span class="meta-pill">' + app.escapeHtml(quality.join(' • ')) + '</span>' : '<span class="meta-pill">Registro completo</span>') +
        '</div>' +
      '</div>';
    }).join('');
  };

  app.touchPendingSync = function (reason) {
    app.saveSystemState({
      pendingSync: true,
      pendingReason: String(reason || '').trim()
    });
  };

  app.exportLocalBackup = function (onlyQueue) {
    var now = new Date().toISOString();
    var payload = {
      exportedAt: now,
      appVersion: app.CONFIG.APP_VERSION,
      agent: app.state.currentAgent || null,
      agents: app.readAgents(),
      properties: app.readProperties(),
      visits: onlyQueue ? app.getUnsyncedVisits() : app.readVisits(),
      logs: app.readLogs(),
      system: app.readSystemState()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = onlyQueue ? 'ace-fila-local.json' : 'ace-backup-completo.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (!onlyQueue) {
      app.saveSystemState({ lastBackupAt: now });
      app.addLog('backup', 'export', '', 'Backup local exportado em JSON.');
      app.touchPendingSync('backup');
    }
    app.renderSyncCenter();
    app.renderAdminSystemPanel();
  };

  app.applyGpsTerritoryContext = function () {
    var resolved = app.resolveTerritoryByGps(app.state.visit.gps);
    app.state.territoryHint = resolved;
    if (!resolved) {
      app.state.visit.gpsTerritory = '';
      app.state.visit.gpsQuarteirao = '';
      app.renderGpsTerritoryStatus();
      return null;
    }
    app.state.visit.gpsTerritory = resolved.territoryName;
    app.state.visit.gpsQuarteirao = resolved.quarteirao;
    if (!app.state.visit.quarteirao) {
      app.state.visit.quarteirao = resolved.quarteirao;
    }
    app.renderGpsTerritoryStatus();
    return resolved;
  };

  app.getPrioritizedProperties = function () {
    var currentGps = app.state.visit.gps;
    return app.readProperties().map(function (property) {
      var history = app.getVisitsForProperty(property);
      var last = history[0] || null;
      var pending = !!(last && (last.situacao === 'Fechado' || last.situacao === 'Recusa'));
      var distance = currentGps ? app.calcDistanceMeters(currentGps.lat, currentGps.lng, property.lastLat, property.lastLng) : null;
      return {
        property: property,
        last: last,
        pending: pending,
        visitedToday: !!(last && last.data === app.todayISO()),
        distance: distance
      };
    }).sort(function (a, b) {
      if (a.pending !== b.pending) {
        return a.pending ? -1 : 1;
      }
      if (a.visitedToday !== b.visitedToday) {
        return a.visitedToday ? 1 : -1;
      }
      var aDistance = a.distance === null ? Number.MAX_SAFE_INTEGER : a.distance;
      var bDistance = b.distance === null ? Number.MAX_SAFE_INTEGER : b.distance;
      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }
      return app.compareAreaCode(a.property.microarea, b.property.microarea) ||
        app.compareAreaCode(a.property.quarteirao, b.property.quarteirao);
    });
  };

  app.selectNextProperty = function (pendingOnly) {
    var rows = app.getPrioritizedProperties().filter(function (row) {
      if (pendingOnly) {
        return row.pending;
      }
      return row.property.uid !== app.state.selectedPropertyId;
    });
    if (!rows.length) {
      app.showMessage(pendingOnly ? 'Nenhuma pendência encontrada na fila local.' : 'Nenhum próximo imóvel sugerido agora.', 'warn');
      return;
    }
    app.selectProperty(rows[0].property.uid);
    app.showMessage(pendingOnly ? 'Pendência mais próxima carregada para nova abordagem.' : 'Próximo imóvel sugerido carregado.', 'ok');
  };

  app.openRouteToSelectedProperty = function () {
    var property = app.getSelectedProperty();
    if (!property) {
      app.showMessage('Selecione um imóvel para abrir a rota.', 'danger');
      return;
    }
    window.open(app.buildRouteUrl(property), '_blank');
  };

  app.openVisitReportPreview = function () {
    var property = app.getSelectedProperty();
    if (!property) {
      app.showMessage('Selecione um imóvel para gerar a prévia do relatório.', 'danger');
      return;
    }
    app.syncVisitWithInputs();
    var previewVisit = app.normalizeVisit(Object.assign({}, app.state.visit, {
      agente: app.state.currentAgent ? app.state.currentAgent.nome : '',
      matricula: app.state.currentAgent ? app.state.currentAgent.matricula : '',
      bairro: property.bairro,
      logradouro: property.logradouro,
      numero: property.numero,
      tipo: property.tipo,
      morador: property.morador,
      telefone: property.telefone,
      property_uid: property.uid,
      routeUrl: app.buildRouteUrl(property),
      gpsTerritory: app.state.territoryHint ? app.state.territoryHint.territoryName : app.state.visit.gpsTerritory,
      gpsQuarteirao: app.state.territoryHint ? app.state.territoryHint.quarteirao : app.state.visit.gpsQuarteirao
    }));
    var win = window.open('', '_blank');
    if (!win) {
      app.showMessage('Não foi possível abrir a prévia do relatório.', 'danger');
      return;
    }
    win.document.write(app.buildVisitReportHtml(previewVisit, property));
    win.document.close();
    win.focus();
  };

  app.openVisitPdf = function () {
    var current = app.state.visit.pdfUrl;
    var property = app.getSelectedProperty();
    if (!current && property) {
      var last = app.getVisitsForProperty(property)[0];
      current = last ? last.pdfUrl : '';
    }
    if (!current) {
      app.showMessage('O PDF definitivo ainda não foi vinculado pela sincronização com o Google Drive.', 'warn');
      return;
    }
    window.open(current, '_blank');
  };

  app.signatureHasInk = function () {
    var canvas = document.getElementById('signatureCanvas');
    if (!canvas) {
      return false;
    }
    var ctx = canvas.getContext('2d');
    var pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var index;
    for (index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) {
        return true;
      }
    }
    return false;
  };

  app.renderSignatureCanvas = function () {
    var canvas = document.getElementById('signatureCanvas');
    if (!canvas) {
      return;
    }
    var ctx = canvas.getContext('2d');
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var width = canvas.clientWidth || 900;
    var height = canvas.clientHeight || 220;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#1f563c';
    ctx.fillStyle = '#1f563c';

    if (!app.state.visit.signatureDataUrl) {
      return;
    }
    var img = new Image();
    img.onload = function () {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = app.state.visit.signatureDataUrl;
  };

  app.captureSignatureData = function (showFeedback) {
    var canvas = document.getElementById('signatureCanvas');
    if (!canvas) {
      return false;
    }
    if (!app.signatureHasInk()) {
      app.state.visit.signatureDataUrl = '';
      app.state.visit.signatureSignedAt = '';
      if (showFeedback) {
        app.showMessage('Nenhuma assinatura foi desenhada ainda.', 'warn');
      }
      app.renderSignatureStatus();
      app.createVisitSummary();
      return false;
    }
    app.state.visit.signatureDataUrl = canvas.toDataURL('image/png');
    app.state.visit.signatureSignedAt = new Date().toISOString();
    app.renderSignatureStatus();
    app.createVisitSummary();
    if (showFeedback) {
      app.showMessage('Assinatura registrada com sucesso.', 'ok');
    }
    return true;
  };

  app.clearSignature = function () {
    var canvas = document.getElementById('signatureCanvas');
    if (canvas) {
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    app.state.visit.signatureDataUrl = '';
    app.state.visit.signatureSignedAt = '';
    app.renderSignatureStatus();
    app.createVisitSummary();
  };

  app.initSignaturePad = function () {
    var canvas = document.getElementById('signatureCanvas');
    if (!canvas || canvas.getAttribute('data-signature-ready') === 'true') {
      app.renderSignatureCanvas();
      return;
    }

    var drawing = false;
    var moved = false;

    function getPoint(event) {
      var rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    function start(event) {
      var ctx = canvas.getContext('2d');
      var point = getPoint(event);
      drawing = true;
      moved = false;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      event.preventDefault();
    }

    function move(event) {
      if (!drawing) {
        return;
      }
      var ctx = canvas.getContext('2d');
      var point = getPoint(event);
      moved = true;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      event.preventDefault();
    }

    function end(event) {
      if (!drawing) {
        return;
      }
      drawing = false;
      if (!moved) {
        var ctx = canvas.getContext('2d');
        var point = getPoint(event);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      app.captureSignatureData(false);
      event.preventDefault();
    }

    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointerleave', function () {
      drawing = false;
    });
    canvas.setAttribute('data-signature-ready', 'true');
    window.addEventListener('resize', app.renderSignatureCanvas);
    app.renderSignatureCanvas();
  };

  app.syncVisitWithInputs = function () {
    app.state.visit.data = document.getElementById('visitDate').value || app.todayISO();
    app.state.visit.hora = app.sanitizeHour(document.getElementById('visitTime').value || app.nowHHMM());
    app.state.visit.microarea = app.normalizeAreaCode(document.getElementById('visitMicroarea').value || '');
    app.state.visit.quarteirao = app.normalizeAreaCode(document.getElementById('visitQuarteirao').value || '');
    app.state.visit.focusQty = Math.max(0, Number(document.getElementById('visitFocusQty').value || 0));
    app.state.visit.tubitosQty = Math.max(0, Number(document.getElementById('visitTubitosQty').value || 0));
    app.state.visit.larvicida = document.getElementById('visitLarvicida').value || 'Nenhum';
    app.state.visit.larvicidaQty = Math.max(0, Number(document.getElementById('visitLarvicidaQty').value || 0));
    app.state.visit.adulticida = document.getElementById('visitAdulticida').value || 'Nenhum';
    app.state.visit.adulticidaQty = Math.max(0, Number(document.getElementById('visitAdulticidaQty').value || 0));
    app.state.visit.cardCode = app.normalizeCardCode(document.getElementById('visitCardCode').value || '');
    app.state.visit.obs = String(document.getElementById('visitObs').value || '').trim();
    if (typeof app.captureSignatureData === 'function') {
      app.captureSignatureData(false);
    }
    if (app.state.visit.focusFound === 'Não') {
      app.state.visit.focusQty = 0;
      app.state.visit.depositFocusCounts = app.emptyDepositMap();
    } else if (app.state.visit.focusQty === 0 && app.totalFromMap(app.state.visit.depositFocusCounts) > 0) {
      app.state.visit.focusQty = app.totalFromMap(app.state.visit.depositFocusCounts);
    }
  };

  app.resetVisitForm = function () {
    var area = app.readLastArea();
    app.state.visit = app.createEmptyVisit();
    app.state.territoryHint = null;
    app.state.visit.microarea = area.microarea;
    app.state.visit.quarteirao = area.quarteirao;
    app.updateVisitFormFromState();
  };

  app.showScreen = function (screenName) {
    app.state.selectedScreen = screenName;
    Array.from(document.querySelectorAll('.screen')).forEach(function (node) {
      node.classList.toggle('active', node.id === 'screen-' + screenName);
    });
    Array.from(document.querySelectorAll('.tab-btn')).forEach(function (node) {
      node.classList.toggle('active', node.getAttribute('data-screen') === screenName);
    });
    if (screenName === 'mapa') {
      app.renderMap();
    }
    if (screenName === 'imoveis') {
      app.renderProperties();
    }
    if (screenName === 'painel') {
      app.renderLocalPanel();
    }
    window.scrollTo(0, 0);
  };

  app.captureGps = function (withFeedback) {
    if (!navigator.geolocation) {
      app.showMessage('GPS não disponível neste aparelho.', 'danger');
      return;
    }
    navigator.geolocation.getCurrentPosition(function (position) {
      app.state.visit.gps = {
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
        accuracy: Math.round(position.coords.accuracy || 0)
      };
      var territory = app.applyGpsTerritoryContext();
      app.renderGpsStatus();
      app.renderProperties();
      app.fillPropertyQuickSelect();
      app.createVisitSummary();
      app.renderHero();
      if (withFeedback !== false) {
        app.showMessage(territory ? ('Localização capturada em ' + territory.territoryName + ' • Q ' + territory.quarteirao + '.') : 'Localização capturada com sucesso.', 'ok');
      }
    }, function () {
      app.showMessage('Não foi possível capturar a localização.', 'danger');
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  };

  app.addQuickNote = function (note) {
    var pieces = app.state.visit.obs ? app.state.visit.obs.split(' | ').map(function (item) { return item.trim(); }).filter(Boolean) : [];
    if (pieces.indexOf(note) === -1) {
      pieces.push(note);
    }
    app.state.visit.obs = pieces.join(' | ');
    document.getElementById('visitObs').value = app.state.visit.obs;
    app.createVisitSummary();
  };

  app.changeStepper = function (targetId, delta) {
    var input = document.getElementById(targetId);
    if (!input) {
      return;
    }
    if ((input.getAttribute('type') || '').toLowerCase() !== 'number') {
      return;
    }
    var current = Math.max(0, Number(input.value || 0));
    input.value = Math.max(0, current + Number(delta || 0));
    app.syncVisitWithInputs();
    app.createVisitSummary();
    app.renderHero();
  };

  app.changeDeposit = function (code, mode, delta) {
    var total = Math.max(0, Number(app.state.visit.depositCounts[code] || 0));
    var focusTotal = Math.max(0, Number(app.state.visit.depositFocusCounts[code] || 0));

    if (mode === 'count') {
      total = Math.max(0, total + Number(delta || 0));
      if (focusTotal > total) {
        focusTotal = total;
      }
    } else {
      focusTotal = Math.max(0, focusTotal + Number(delta || 0));
      if (focusTotal > total) {
        total = focusTotal;
      }
    }

    app.state.visit.depositCounts[code] = total;
    app.state.visit.depositFocusCounts[code] = focusTotal;
    if (app.totalFromMap(app.state.visit.depositFocusCounts) > 0) {
      app.state.visit.focusFound = 'Sim';
      if (app.state.visit.focusQty === 0) {
        app.state.visit.focusQty = app.totalFromMap(app.state.visit.depositFocusCounts);
      }
    }
    app.updateVisitFormFromState();
    app.renderHero();
  };

  app.toggleDepositFocus = function (code, checked) {
    if (checked) {
      app.state.visit.depositCounts[code] = Math.max(1, Number(app.state.visit.depositCounts[code] || 0));
      app.state.visit.depositFocusCounts[code] = Math.max(1, Number(app.state.visit.depositFocusCounts[code] || 0));
      app.state.visit.focusFound = 'Sim';
      if (app.state.visit.focusQty === 0) {
        app.state.visit.focusQty = app.totalFromMap(app.state.visit.depositFocusCounts);
      }
    } else {
      app.state.visit.depositFocusCounts[code] = 0;
      if (app.totalFromMap(app.state.visit.depositFocusCounts) === 0 && app.state.visit.focusQty === 0) {
        app.state.visit.focusFound = 'Não';
      }
    }
    app.updateVisitFormFromState();
    app.renderHero();
  };

  app.applyPreset = function (name) {
    if (name === 'padrao') {
      app.state.visit.situacao = 'Visitado';
      app.state.visit.focusFound = 'Não';
      app.state.visit.focusQty = 0;
      app.state.visit.tubitosQty = 0;
      app.state.visit.depositFocusCounts = app.emptyDepositMap();
    } else if (name === 'fechado') {
      app.state.visit.situacao = 'Fechado';
      app.state.visit.focusFound = 'Não';
      app.state.visit.focusQty = 0;
    } else if (name === 'recuperado') {
      app.state.visit.situacao = 'Recuperado';
      if (!app.state.visit.obs) {
        app.state.visit.obs = 'Retorno concluído com acesso ao imóvel.';
      }
    } else if (name === 'foco') {
      var firstCode = Object.keys(app.DEPOSITS)[0];
      app.state.visit.situacao = 'Visitado';
      app.state.visit.focusFound = 'Sim';
      app.state.visit.focusQty = Math.max(1, app.state.visit.focusQty);
      app.state.visit.tubitosQty = Math.max(1, app.state.visit.tubitosQty);
      app.state.visit.depositCounts[firstCode] = Math.max(1, Number(app.state.visit.depositCounts[firstCode] || 0));
      app.state.visit.depositFocusCounts[firstCode] = Math.max(1, Number(app.state.visit.depositFocusCounts[firstCode] || 0));
    }
    app.updateVisitFormFromState();
    app.renderHero();
  };

  app.handlePhotoInput = function (file) {
    if (!file) {
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      app.state.visit.photoDataUrl = String(reader.result || '');
      app.state.visit.photoUrl = '';
      app.renderPhotoPreview();
      app.showMessage('Foto adicionada à visita.', 'ok');
    };
    reader.readAsDataURL(file);
  };

  app.openCardPreview = function () {
    app.syncVisitWithInputs();
    if (!app.state.visit.cardCode) {
      app.showMessage('Informe o código do cartão antes de abrir o cartão virtual.', 'danger');
      return;
    }
    window.open(app.buildCardUrl(app.state.visit.cardCode), '_blank');
  };

  app.saveAgentFromForm = function () {
    if (!app.canManageAdmin()) {
      app.showMessage('Somente Supervisor ou Administrador pode alterar o cadastro de agentes.', 'danger');
      return;
    }
    var name = String(document.getElementById('agentName').value || '').trim();
    var code = String(document.getElementById('agentCode').value || '').trim();
    var password = String(document.getElementById('agentPassword').value || '').trim();
    var role = document.getElementById('agentRole') ? String(document.getElementById('agentRole').value || 'ACE').trim() : 'ACE';
    var baseMicroarea = document.getElementById('agentBaseMicroarea') ? String(document.getElementById('agentBaseMicroarea').value || '').trim() : '';
    var baseRegion = document.getElementById('agentBaseRegion') ? String(document.getElementById('agentBaseRegion').value || '').trim() : '';
    var editId = document.getElementById('saveAgentBtn').getAttribute('data-edit-id') || '';

    if (!name || !code) {
      app.showMessage('Preencha nome e matrícula do agente.', 'danger');
      return;
    }
    if (!editId && !password) {
      app.showMessage('Defina uma senha para o novo agente.', 'danger');
      return;
    }

    app.hashText(password).then(function (passwordHash) {
      var agents = app.readAgents();
      var duplicate = agents.find(function (agent) {
        return agent.matricula.toLowerCase() === code.toLowerCase() && agent.uid !== editId;
      });
      if (duplicate) {
        app.showMessage('Já existe um agente com essa matrícula.', 'danger');
        return;
      }
      var current = editId ? agents.find(function (agent) { return agent.uid === editId; }) : null;
      var record = {
        uid: editId || app.createId('AGT'),
        nome: name,
        matricula: code,
        role: role,
        baseMicroarea: baseMicroarea,
        baseRegion: baseRegion,
        senhaHash: password ? passwordHash : (current ? current.senhaHash : ''),
        updatedAt: new Date().toISOString()
      };
      var index = agents.findIndex(function (agent) { return agent.uid === record.uid; });
      if (index > -1) {
        agents[index] = record;
      } else {
        agents.push(record);
      }
      app.saveAgents(agents);
      app.fillAgentSelect();
      app.renderAgents();
      app.clearAgentForm();
      app.addLog('agent', index > -1 ? 'update' : 'create', record.uid, record.nome + ' • ' + record.role);
      app.touchPendingSync('agent');
      app.showMessage(index > -1 ? 'Agente atualizado.' : 'Agente cadastrado.', 'ok');
      app.tryAutoSync('agent');
    });
  };

  app.editAgent = function (agentId) {
    var agent = app.readAgents().find(function (item) { return item.uid === agentId; });
    if (!agent) {
      return;
    }
    document.getElementById('agentName').value = agent.nome;
    document.getElementById('agentCode').value = agent.matricula;
    document.getElementById('agentPassword').value = '';
    if (document.getElementById('agentRole')) {
      document.getElementById('agentRole').value = agent.role || 'ACE';
    }
    if (document.getElementById('agentBaseMicroarea')) {
      document.getElementById('agentBaseMicroarea').value = agent.baseMicroarea || '';
    }
    if (document.getElementById('agentBaseRegion')) {
      document.getElementById('agentBaseRegion').value = agent.baseRegion || '';
    }
    document.getElementById('saveAgentBtn').setAttribute('data-edit-id', agent.uid);
  };

  app.deleteAgent = function (agentId) {
    if (!app.canManageAdmin()) {
      app.showMessage('Somente Supervisor ou Administrador pode excluir agentes.', 'danger');
      return;
    }
    if (!window.confirm('Excluir este agente?')) {
      return;
    }
    var removed = app.readAgents().find(function (item) { return item.uid === agentId; });
    app.saveAgents(app.readAgents().filter(function (item) { return item.uid !== agentId; }));
    app.fillAgentSelect();
    app.renderAgents();
    app.addLog('agent', 'delete', agentId, removed ? removed.nome : 'Agente removido');
    app.touchPendingSync('agent-delete');
    app.tryAutoSync('agent-delete');
  };

  app.clearPropertyForm = function () {
    app.state.editingPropertyId = '';
    document.getElementById('propMorador').value = '';
    document.getElementById('propTelefone').value = '';
    document.getElementById('propBairro').value = app.CONFIG.BAIRROS[0] || '';
    document.getElementById('propLogradouro').value = '';
    document.getElementById('propNumero').value = '';
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').value = '';
    }
    if (document.getElementById('propQuarteirao')) {
      document.getElementById('propQuarteirao').value = '';
    }
    document.getElementById('propComplemento').value = app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    document.getElementById('propTipo').value = app.CONFIG.PROPERTY_TYPES[0] || 'Residencial';
    document.getElementById('propReferencia').value = '';
    document.getElementById('propObs').value = '';
    if (typeof app.syncAreaSelects === 'function' && document.getElementById('propMicroarea') && document.getElementById('propQuarteirao')) {
      app.syncAreaSelects(document.getElementById('propMicroarea'), document.getElementById('propQuarteirao'), '');
    }
  };

  app.handleVisitBairroChange = function () {
    var select = document.getElementById('visitBairroSelect');
    var bairro = select ? String(select.value || '').trim() : '';
    var property = app.getSelectedProperty();

    if (property && bairro && property.bairro !== bairro) {
      app.state.selectedPropertyId = '';
    }

    app.fillPropertyQuickSelect();
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
  };

  app.handlePropertyBairroChange = function () {
    var input = document.getElementById('propLogradouro');
    var currentValue = input ? String(input.value || '').trim() : '';
    app.fillPropertyFormOptions();
    if (input) {
      input.value = currentValue;
    }
  };

  app.handleVisitMicroareaChange = function () {
    var microareaNode = document.getElementById('visitMicroarea');
    var quarteiraoNode = document.getElementById('visitQuarteirao');
    var microarea = microareaNode ? app.normalizeAreaCode(microareaNode.value || '') : '';
    var selectedQuarteirao = quarteiraoNode ? app.normalizeAreaCode(quarteiraoNode.value || '') : '';

    app.fillPropertyFormOptions();
    if (microareaNode) {
      microareaNode.value = microarea;
    }
    if (typeof app.syncAreaSelects === 'function' && microareaNode && quarteiraoNode) {
      app.syncAreaSelects(microareaNode, quarteiraoNode, selectedQuarteirao);
    }

    app.syncVisitWithInputs();
    app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);
    app.fillPropertyQuickSelect();
    app.createVisitSummary();
    app.renderHero();
  };

  app.handlePropertyMicroareaChange = function () {
    var microareaNode = document.getElementById('propMicroarea');
    var quarteiraoNode = document.getElementById('propQuarteirao');
    var microarea = microareaNode ? app.normalizeAreaCode(microareaNode.value || '') : '';
    var selectedQuarteirao = quarteiraoNode ? app.normalizeAreaCode(quarteiraoNode.value || '') : '';

    app.fillPropertyFormOptions();
    if (microareaNode) {
      microareaNode.value = microarea;
    }
    if (typeof app.syncAreaSelects === 'function' && microareaNode && quarteiraoNode) {
      app.syncAreaSelects(microareaNode, quarteiraoNode, selectedQuarteirao);
    }
  };

  app.savePropertyFromForm = function () {
    var bairro = app.normalizeTitleText(document.getElementById('propBairro').value || '');
    var logradouro = app.normalizeTitleText(document.getElementById('propLogradouro').value || '');
    var numero = app.normalizeFreeText(document.getElementById('propNumero').value || '');
    var microarea = app.normalizeAreaCode((document.getElementById('propMicroarea') && document.getElementById('propMicroarea').value) || '');
    var quarteirao = app.normalizeAreaCode((document.getElementById('propQuarteirao') && document.getElementById('propQuarteirao').value) || '');
    if (!bairro || !logradouro || !numero) {
      app.showMessage('Preencha bairro, logradouro e número do imóvel.', 'danger');
      return;
    }
    if (!microarea || !quarteirao) {
      app.showMessage('Defina microárea e quarteirão para manter a base territorial consistente.', 'danger');
      return;
    }

    var properties = app.readProperties();
    var territory = app.state.visit.gps ? app.resolveTerritoryByGps(app.state.visit.gps) : null;
    var record = {
      uid: app.state.editingPropertyId || app.createId('PROP'),
      morador: app.normalizeTitleText(document.getElementById('propMorador').value || ''),
      telefone: app.normalizeFreeText(document.getElementById('propTelefone').value || ''),
      microarea: microarea,
      quarteirao: quarteirao,
      bairro: bairro,
      logradouro: logradouro,
      numero: numero,
      complemento: String(document.getElementById('propComplemento').value || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal').trim(),
      tipo: String(document.getElementById('propTipo').value || 'Residencial').trim(),
      referencia: app.normalizeTitleText(document.getElementById('propReferencia').value || ''),
      obs: app.normalizeFreeText(document.getElementById('propObs').value || ''),
      address_key: app.addressKey({ bairro: bairro, logradouro: logradouro, numero: numero }),
      lastLat: app.state.visit.gps ? app.state.visit.gps.lat : null,
      lastLng: app.state.visit.gps ? app.state.visit.gps.lng : null,
      gpsTerritory: territory ? territory.territoryName : '',
      gpsQuarteirao: territory ? territory.quarteirao : '',
      lastVisitAt: '',
      updatedAt: new Date().toISOString()
    };

    var quality = app.computePropertyQuality(record, properties);
    record.qualityFlags = quality.flags;
    record.qualityStatus = quality.status;

    var duplicate = quality.duplicates[0] || properties.find(function (property) {
      return property.address_key === record.address_key && property.uid !== record.uid;
    });
    if (duplicate) {
      record.uid = duplicate.uid;
    }

    var index = properties.findIndex(function (property) {
      return property.uid === record.uid || property.address_key === record.address_key;
    });
    if (index > -1) {
      properties[index] = Object.assign({}, properties[index], record);
    } else {
      properties.push(record);
    }
    app.saveProperties(properties);
    app.state.selectedPropertyId = record.uid;
    if (document.getElementById('visitBairroSelect')) {
      document.getElementById('visitBairroSelect').value = record.bairro;
    }
    if (!app.state.visit.microarea && record.microarea) {
      app.state.visit.microarea = record.microarea;
    }
    if (!app.state.visit.quarteirao && record.quarteirao) {
      app.state.visit.quarteirao = record.quarteirao;
    }
    app.clearPropertyForm();
    app.renderAll();
    app.addLog('property', index > -1 ? 'update' : 'create', record.uid, record.logradouro + ', ' + record.numero + (quality.flags.length ? ' • ' + quality.flags.join(', ') : ''));
    app.touchPendingSync('property');
    app.showMessage(index > -1 ? 'Imóvel atualizado.' : 'Imóvel cadastrado.', duplicate ? 'warn' : 'ok');
    app.tryAutoSync('property');
  };

  app.loadPropertyIntoForm = function (propertyId) {
    var property = app.readProperties().find(function (item) { return item.uid === propertyId; });
    if (!property) {
      return;
    }
    app.state.editingPropertyId = property.uid;
    document.getElementById('propMorador').value = property.morador;
    document.getElementById('propTelefone').value = property.telefone;
    document.getElementById('propBairro').value = property.bairro;
    document.getElementById('propLogradouro').value = property.logradouro;
    document.getElementById('propNumero').value = property.numero;
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').value = property.microarea || '';
    }
    if (document.getElementById('propQuarteirao')) {
      document.getElementById('propQuarteirao').value = property.quarteirao || '';
    }
    if (typeof app.syncAreaSelects === 'function' && document.getElementById('propMicroarea') && document.getElementById('propQuarteirao')) {
      app.syncAreaSelects(document.getElementById('propMicroarea'), document.getElementById('propQuarteirao'), property.quarteirao || '');
    }
    document.getElementById('propComplemento').value = property.complemento || app.CONFIG.PROPERTY_COMPLEMENTS[0] || 'Normal';
    document.getElementById('propTipo').value = property.tipo;
    document.getElementById('propReferencia').value = property.referencia;
    document.getElementById('propObs').value = property.obs;
    app.showScreen('imoveis');
    app.showMessage('Imóvel carregado para atualização cadastral.', 'accent');
  };

  app.selectProperty = function (propertyId) {
    app.state.selectedPropertyId = propertyId;
    var property = app.getSelectedProperty();
    if (property) {
      if (property.microarea) {
        app.state.visit.microarea = property.microarea;
      }
      if (property.quarteirao) {
        app.state.visit.quarteirao = property.quarteirao;
      }
      app.state.visit.routeUrl = app.buildRouteUrl(property);
      if (document.getElementById('visitBairroSelect')) {
        document.getElementById('visitBairroSelect').value = property.bairro || '';
      }
      app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);
      app.updateVisitFormFromState();
    }
    app.renderSelectedPropertyCard();
    app.renderSelectedHistory();
    app.createVisitSummary();
    app.showScreen('visita');
  };

  app.loadVisitForEdit = function (visitId) {
    var visit = app.readVisits().find(function (item) { return item.uid === visitId; });
    if (!visit) {
      return;
    }
    app.state.editingVisitId = visit.uid;
    app.state.selectedPropertyId = visit.property_uid || (app.readProperties().find(function (property) {
      return app.addressKey(property) === app.addressKey(visit);
    }) || {}).uid || '';
    app.state.visit = app.createEmptyVisit();
    app.state.visit.data = visit.data;
    app.state.visit.hora = visit.hora;
    app.state.visit.microarea = visit.microarea;
    app.state.visit.quarteirao = visit.quarteirao;
    app.state.visit.situacao = visit.situacao;
    app.state.visit.focusFound = visit.focusFound;
    app.state.visit.focusQty = visit.focusQty;
    app.state.visit.waterAccess = visit.waterAccess;
    app.state.visit.tubitosQty = visit.tubitosQty;
    app.state.visit.larvicida = visit.larvicida;
    app.state.visit.larvicidaQty = visit.larvicidaQty;
    app.state.visit.adulticida = visit.adulticida;
    app.state.visit.adulticidaQty = visit.adulticidaQty;
    app.state.visit.cardCode = visit.cardCode;
    app.state.visit.obs = visit.obs;
    app.state.visit.gps = visit.gps;
    app.state.visit.gpsTerritory = visit.gpsTerritory;
    app.state.visit.gpsQuarteirao = visit.gpsQuarteirao;
    app.state.visit.photoDataUrl = visit.photoDataUrl;
    app.state.visit.photoUrl = visit.photoUrl;
    app.state.visit.signatureDataUrl = visit.signatureDataUrl;
    app.state.visit.signatureSignedAt = visit.signatureSignedAt;
    app.state.visit.pdfUrl = visit.pdfUrl;
    app.state.visit.pdfDriveId = visit.pdfDriveId;
    app.state.visit.routeUrl = visit.routeUrl;
    app.state.visit.qualityFlags = visit.qualityFlags;
    app.state.visit.depositCounts = app.normalizeDepositMap(visit.depositCounts);
    app.state.visit.depositFocusCounts = app.normalizeDepositMap(visit.depositFocusCounts);
    app.state.territoryHint = visit.gps ? app.resolveTerritoryByGps(visit.gps) : null;
    if (document.getElementById('visitBairroSelect')) {
      document.getElementById('visitBairroSelect').value = visit.bairro || '';
    }
    app.updateVisitFormFromState();
    app.renderAll();
    app.showScreen('visita');
    app.showMessage('Visita carregada para edição.', 'accent');
  };

  app.saveVisit = function () {
    app.syncVisitWithInputs();
    if (!app.state.currentAgent) {
      app.showMessage('Entre no sistema antes de salvar.', 'danger');
      return;
    }
    if (!app.state.selectedPropertyId) {
      app.showMessage('Selecione um imóvel antes de registrar a visita.', 'danger');
      return;
    }
    if (!app.state.visit.data || !app.state.visit.hora) {
      app.showMessage('Preencha data e hora da visita.', 'danger');
      return;
    }
    if (!app.state.visit.microarea || !app.state.visit.quarteirao) {
      app.showMessage('Preencha microárea e quarteirão antes de salvar a visita.', 'danger');
      return;
    }
    if ((app.state.visit.situacao === 'Visitado' || app.state.visit.situacao === 'Recuperado') && !app.state.visit.signatureDataUrl) {
      app.showMessage('Coleta de assinatura do morador é obrigatória para visita aberta ou recuperada.', 'danger');
      return;
    }

    var property = app.getSelectedProperty();
    if (!property) {
      app.showMessage('Imóvel selecionado não encontrado.', 'danger');
      return;
    }

    var territory = app.applyGpsTerritoryContext();
    app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);

    var existingRecord = app.state.editingVisitId ? app.readVisits().find(function (visit) { return visit.uid === app.state.editingVisitId; }) : null;
    var record = app.normalizeVisit({
      uid: app.state.editingVisitId || app.createId('VIS'),
      data: app.state.visit.data,
      hora: app.state.visit.hora,
      agente: app.state.currentAgent.nome,
      matricula: app.state.currentAgent.matricula,
      microarea: app.state.visit.microarea,
      quarteirao: app.state.visit.quarteirao,
      bairro: property.bairro,
      logradouro: property.logradouro,
      numero: property.numero,
      tipo: property.tipo,
      situacao: app.state.visit.situacao,
      morador: property.morador,
      telefone: property.telefone,
      property_uid: property.uid,
      depositCounts: app.state.visit.depositCounts,
      depositFocusCounts: app.state.visit.depositFocusCounts,
      focusFound: app.state.visit.focusFound,
      focusQty: app.state.visit.focusQty,
      waterAccess: app.state.visit.waterAccess,
      larvicida: app.state.visit.larvicida,
      larvicidaQty: app.state.visit.larvicidaQty,
      adulticida: app.state.visit.adulticida,
      adulticidaQty: app.state.visit.adulticidaQty,
      tubitosQty: app.state.visit.tubitosQty,
      cardCode: app.state.visit.cardCode,
      obs: app.state.visit.obs,
      gps: app.state.visit.gps,
      gpsTerritory: territory ? territory.territoryName : app.state.visit.gpsTerritory,
      gpsQuarteirao: territory ? territory.quarteirao : app.state.visit.gpsQuarteirao,
      photoDataUrl: app.state.visit.photoDataUrl,
      photoUrl: app.state.visit.photoUrl,
      signatureDataUrl: app.state.visit.signatureDataUrl,
      signatureSignedAt: app.state.visit.signatureSignedAt,
      pdfUrl: app.state.visit.pdfUrl,
      pdfDriveId: app.state.visit.pdfDriveId,
      routeUrl: app.buildRouteUrl(property),
      qualityFlags: app.computeVisitQuality(app.state.visit),
      synced: false,
      createdAt: existingRecord ? existingRecord.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    var visits = app.readVisits();
    var index = visits.findIndex(function (visit) { return visit.uid === record.uid; });
    if (index > -1) {
      visits[index] = record;
    } else {
      visits.push(record);
    }
    app.saveVisits(visits);

    var properties = app.readProperties();
    var propertyIndex = properties.findIndex(function (item) { return item.uid === property.uid; });
    if (propertyIndex > -1) {
      properties[propertyIndex].lastLat = record.gps ? record.gps.lat : properties[propertyIndex].lastLat;
      properties[propertyIndex].lastLng = record.gps ? record.gps.lng : properties[propertyIndex].lastLng;
      properties[propertyIndex].gpsTerritory = record.gpsTerritory || properties[propertyIndex].gpsTerritory;
      properties[propertyIndex].gpsQuarteirao = record.gpsQuarteirao || properties[propertyIndex].gpsQuarteirao;
      properties[propertyIndex].lastVisitAt = record.data + ' ' + record.hora;
      properties[propertyIndex].updatedAt = new Date().toISOString();
      var propertyQuality = app.computePropertyQuality(properties[propertyIndex], properties);
      properties[propertyIndex].qualityFlags = propertyQuality.flags;
      properties[propertyIndex].qualityStatus = propertyQuality.status;
      app.saveProperties(properties);
    }

    app.addLog('visit', index > -1 ? 'update' : 'create', record.uid, record.logradouro + ', ' + record.numero + ' • ' + record.situacao);
    app.touchPendingSync('visit');
    app.showMessage(index > -1 ? 'Visita atualizada com sucesso.' : 'Visita salva com sucesso.', 'ok');
    app.state.editingVisitId = '';
    var selectedId = app.state.selectedPropertyId;
    app.resetVisitForm();
    app.state.selectedPropertyId = selectedId;
    app.renderAll();
    app.tryAutoSync('visit');
  };

  app.buildMetricsForSync = function () {
    var snapshot = app.buildLocalSnapshot();
    return {
      reference_date: app.todayISO(),
      total_visitas: snapshot.totals.totalVisits,
      imoveis_visitados: snapshot.totals.visitedProperties,
      abertos: snapshot.totals.opened,
      fechados: snapshot.totals.closed,
      total: snapshot.totals.totalProperties,
      recuperados: snapshot.totals.recovered,
      pendencias: snapshot.totals.pending,
      depositos_encontrados: snapshot.totals.deposits,
      depositos_com_foco: snapshot.totals.depositsWithFocus,
      tubitos_qtd: snapshot.totals.tubitos,
      taxa_infestacao: snapshot.totals.infestationRate,
      cobertura_gps: snapshot.totals.gpsCoverage,
      retornos: snapshot.totals.returns,
      focos: snapshot.totals.focusCount
    };
  };

  app.buildSyncPayload = function () {
    return {
      action: 'sync',
      generated_at: new Date().toISOString(),
      agents: app.readAgents().map(function (agent) {
        return {
          uid: agent.uid,
          nome: agent.nome,
          matricula: agent.matricula,
          role: agent.role,
          base_microarea: agent.baseMicroarea,
          base_region: agent.baseRegion,
          senhaHash: agent.senhaHash,
          updatedAt: agent.updatedAt
        };
      }),
      properties: app.readProperties().map(function (property) {
        return {
          uid: property.uid,
          morador: property.morador,
          telefone: property.telefone,
          microarea: property.microarea,
          quarteirao: property.quarteirao,
          bairro: property.bairro,
          logradouro: property.logradouro,
          numero: property.numero,
          complemento: property.complemento,
          tipo: property.tipo,
          referencia: property.referencia,
          obs: property.obs,
          address_key: property.address_key,
          last_lat: property.lastLat,
          last_lng: property.lastLng,
          gps_territory: property.gpsTerritory,
          gps_quarteirao: property.gpsQuarteirao,
          quality_flags: (property.qualityFlags || []).join('|'),
          quality_status: property.qualityStatus,
          last_visit_at: property.lastVisitAt,
          updatedAt: property.updatedAt
        };
      }),
      visits: app.readVisits().map(function (visit) {
        return {
          uid: visit.uid,
          sheet_name: 'visitas',
          data: visit.data,
          hora: visit.hora,
          agente: visit.agente,
          matricula: visit.matricula,
          microarea: visit.microarea,
          quarteirao: visit.quarteirao,
          bairro: visit.bairro,
          logradouro: visit.logradouro,
          numero: visit.numero,
          tipo: visit.tipo,
          situacao: visit.situacao,
          morador: visit.morador,
          telefone: visit.telefone,
          property_uid: visit.property_uid,
          deposits: visit.deposits.join('|'),
          deposit_count: visit.depositTotal,
          deposit_focus_breakdown: visit.depositFocusBreakdown.join('|'),
          deposit_focus_count: visit.depositFocusTotal,
          deposit_with_focus: visit.depositFocusTotal > 0 ? 'Sim' : 'Não',
          foco: visit.focusFound,
          focus_count: visit.focusQty,
          acessou_caixa_agua: visit.waterAccess,
          larvicida: visit.larvicida,
          larvicida_qtd: visit.larvicidaQty,
          adulticida: visit.adulticida,
          adulticida_qtd: visit.adulticidaQty,
          tubitos_qtd: visit.tubitosQty,
          card_code: visit.cardCode,
          card_virtual_url: app.buildCardUrl(visit.cardCode),
          obs: visit.obs,
          gps_lat: visit.gps ? visit.gps.lat : '',
          gps_lng: visit.gps ? visit.gps.lng : '',
          gps_acc: visit.gps ? visit.gps.accuracy : '',
          gps_territory: visit.gpsTerritory,
          gps_quarteirao: visit.gpsQuarteirao,
          foto_url: visit.photoUrl,
          photo_data_url: visit.photoDataUrl,
          foto_drive_id: visit.photoDriveId,
          assinatura_data_url: visit.signatureDataUrl,
          assinatura_em: visit.signatureSignedAt,
          relatorio_pdf_url: visit.pdfUrl,
          relatorio_pdf_drive_id: visit.pdfDriveId,
          quality_flags: (visit.qualityFlags || []).join('|'),
          route_url: visit.routeUrl,
          updatedAt: visit.updatedAt
        };
      }),
      metrics_daily: app.buildMetricsForSync(),
      logs: app.readLogs(),
      system_state: app.readSystemState()
    };
  };

  app.jsonpRequest = function (url) {
    return new Promise(function (resolve, reject) {
      var callbackName = 'acsJsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
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
  };

  app.mergeRemoteAgents = function (rows) {
    var local = app.readAgents();
    rows.map(app.normalizeAgent).forEach(function (remote) {
      var index = local.findIndex(function (agent) {
        return agent.uid === remote.uid || agent.matricula.toLowerCase() === remote.matricula.toLowerCase();
      });
      if (index > -1) {
        local[index] = remote;
      } else {
        local.push(remote);
      }
    });
    app.saveAgents(local);
    app.fillAgentSelect();
  };

  app.mergeRemoteProperties = function (rows) {
    var local = app.readProperties();
    rows.map(app.normalizeProperty).forEach(function (remote) {
      var index = local.findIndex(function (property) {
        return property.uid === remote.uid || property.address_key === remote.address_key;
      });
      if (index > -1) {
        local[index] = Object.assign({}, local[index], remote);
      } else {
        local.push(remote);
      }
    });
    app.saveProperties(local);
  };

  app.bootstrapFromServer = function () {
    if (!app.isApiConfigured() || !navigator.onLine) {
      return Promise.resolve(false);
    }
    app.setSyncChip('Atualizando base', 'accent');
    var url = app.CONFIG.SHEETS_WEBAPP_URL + '?action=bootstrap&t=' + Date.now();
    return fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha no bootstrap');
      }
      return response.json();
    }).catch(function () {
      return app.jsonpRequest(url);
    }).then(function (payload) {
      if (Array.isArray(payload.agents)) {
        app.mergeRemoteAgents(payload.agents);
      }
      if (Array.isArray(payload.properties)) {
        app.mergeRemoteProperties(payload.properties);
      }
      app.saveSystemState({ lastBootstrapAt: new Date().toISOString(), lastSyncError: '' });
      app.setSyncChip('Base atualizada', 'ok');
      app.renderAll();
      return true;
    }).catch(function () {
      app.setSyncChip('Modo local', 'warn');
      app.saveSystemState({ lastSyncError: 'Falha ao atualizar a base remota.' });
      return false;
    });
  };

  app.tryAutoSync = function () {
    if (!app.CONFIG.AUTO_SYNC || !app.isApiConfigured()) {
      app.setSyncChip('Modo local', 'warn');
      return Promise.resolve(false);
    }
    if (!navigator.onLine) {
      app.setSyncChip('Offline', 'danger');
      return Promise.resolve(false);
    }
    var systemState = app.readSystemState();
    var pending = app.readVisits().filter(function (visit) { return !visit.synced; });
    var hasPendingState = !!systemState.pendingSync;
    app.setSyncChip((pending.length || hasPendingState) ? ('Sincronizando ' + pending.length) : 'Sem pendência', (pending.length || hasPendingState) ? 'accent' : 'ok');
    if (!pending.length && !hasPendingState) {
      return Promise.resolve(true);
    }
    app.state.syncInFlight = true;
    return fetch(app.CONFIG.SHEETS_WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(app.buildSyncPayload())
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao sincronizar');
      }
      return response.json().catch(function () { return { ok: true }; });
    }).catch(function () {
      return fetch(app.CONFIG.SHEETS_WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(app.buildSyncPayload())
      }).then(function () {
        return { ok: true, nocors: true };
      });
    }).then(function (payload) {
      if (payload && payload.ok === false) {
        throw new Error(payload.error || 'Falha ao sincronizar');
      }
      var visits = app.readVisits().map(function (visit) {
        var statusRow = payload && Array.isArray(payload.visit_statuses) ? payload.visit_statuses.find(function (item) {
          return item.uid === visit.uid;
        }) : null;
        if (!statusRow || visit.uid === statusRow.uid) {
          visit.synced = true;
        }
        if (statusRow) {
          visit.photoUrl = statusRow.foto_url || visit.photoUrl;
          visit.photoDriveId = statusRow.foto_drive_id || visit.photoDriveId;
          visit.pdfUrl = statusRow.relatorio_pdf_url || visit.pdfUrl;
          visit.pdfDriveId = statusRow.relatorio_pdf_drive_id || visit.pdfDriveId;
        }
        return visit;
      });
      app.saveVisits(visits);
      app.saveSystemState({ lastSyncAt: new Date().toISOString(), lastSyncError: '', pendingSync: false, pendingReason: '' });
      app.addLog('sync', 'success', '', pending.length + ' visita(s) enviadas.');
      app.setSyncChip('Sincronizado', 'ok');
      app.showMessage('Dados enviados para a base central.', 'ok');
      app.bootstrapFromServer();
      app.renderAll();
      app.state.syncInFlight = false;
      return true;
    }).catch(function (error) {
      app.state.syncInFlight = false;
      app.saveSystemState({ lastSyncError: error && error.message ? error.message : 'Falha no sync' });
      app.setSyncChip('Falha no sync', 'danger');
      app.showMessage('Não foi possível sincronizar agora. Os dados seguem salvos no aparelho.', 'danger');
      app.renderSyncCenter();
      return false;
    });
  };

  app.reportTile = function (label, value) {
    return '<div class="tile"><small>' + app.escapeHtml(label) + '</small><strong>' + app.escapeHtml(String(value)) + '</strong></div>';
  };

  app.generateDailyReport = function () {
    var snapshot = app.buildLocalSnapshot();
    var visits = snapshot.visits.sort(app.compareVisitDesc);
    if (!visits.length) {
      app.showMessage('Não há visitas no dia para gerar relatório.', 'danger');
      return;
    }
    var html = '' +
      '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório diário ACE</title>' +
      '<style>body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1b252e}h1,h2{color:#183c2c}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #d6dfe2;padding:8px;text-align:left;vertical-align:top}th{background:#f4f8f6}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:18px 0}.tile{border:1px solid #d6dfe2;border-radius:14px;padding:12px;background:#f8fbf9}.tile strong{display:block;font-size:26px;color:#183c2c}.note{margin-top:8px;color:#66727c}</style>' +
      '</head><body>' +
      '<h1>Relatório diário ACE Campo</h1>' +
      '<div class="note">Data de referência: ' + app.escapeHtml(app.formatDateBR(app.todayISO())) + ' • Gerado em ' + app.escapeHtml(new Date().toLocaleString('pt-BR')) + '</div>' +
      '<div class="grid">' +
        app.reportTile('Abertos', snapshot.totals.opened) +
        app.reportTile('Fechados', snapshot.totals.closed) +
        app.reportTile('Visitados', snapshot.totals.visitedProperties) +
        app.reportTile('Total', snapshot.totals.totalProperties) +
        app.reportTile('Recuperados', snapshot.totals.recovered) +
        app.reportTile('Pendências', snapshot.totals.pending) +
        app.reportTile('Tubitos', snapshot.totals.tubitos) +
        app.reportTile('Taxa de infestação', snapshot.totals.infestationRate + '%') +
      '</div>' +
      '<h2>Visitas registradas</h2>' +
      '<table><thead><tr><th>Data/Hora</th><th>Agente</th><th>Endereço</th><th>Situação</th><th>Foco</th><th>Depósitos com foco</th><th>Caixa d\'água</th><th>Cartão</th><th>Observação</th></tr></thead><tbody>' +
        visits.map(function (visit) {
          return '<tr>' +
            '<td>' + app.escapeHtml(app.formatDateBR(visit.data) + ' ' + visit.hora) + '</td>' +
            '<td>' + app.escapeHtml(visit.agente) + '</td>' +
            '<td>' + app.escapeHtml(visit.logradouro + ', ' + visit.numero + ' • ' + visit.bairro) + '</td>' +
            '<td>' + app.escapeHtml(visit.situacao) + '</td>' +
            '<td>' + app.escapeHtml(visit.focusFound + ' • ' + visit.focusQty) + '</td>' +
            '<td>' + app.escapeHtml(String(visit.depositFocusTotal)) + '</td>' +
            '<td>' + app.escapeHtml(visit.waterAccess || '-') + '</td>' +
            '<td>' + app.escapeHtml(visit.cardCode || '-') + '</td>' +
            '<td>' + app.escapeHtml(visit.obs || '-') + '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table>' +
      '</body></html>';
    var opened = window.open('', '_blank');
    if (!opened) {
      app.showMessage('Não foi possível abrir a janela do relatório.', 'danger');
      return;
    }
    opened.document.write(html);
    opened.document.close();
    opened.focus();
    setTimeout(function () { opened.print(); }, 600);
  };

  app.tryLogin = function () {
    var agentId = document.getElementById('loginAgent').value;
    var password = String(document.getElementById('loginPassword').value || '').trim();
    var message = document.getElementById('loginMessage');
    message.textContent = '';
    if (!agentId || !password) {
      message.textContent = 'Selecione o agente e digite a senha.';
      return;
    }
    var agent = app.readAgents().find(function (item) { return item.uid === agentId; });
    if (!agent) {
      message.textContent = 'Agente não encontrado.';
      return;
    }
    app.hashText(password).then(function (passwordHash) {
      if (passwordHash !== agent.senhaHash) {
        message.textContent = 'Senha incorreta.';
        return;
      }
      app.state.currentAgent = agent;
      app.saveSession(agent);
      app.enterApp();
    });
  };

  app.enterApp = function () {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    document.getElementById('headerSubtitle').textContent = app.state.currentAgent.nome + ' • ' + app.state.currentAgent.matricula + ' • ' + (app.state.currentAgent.role || 'ACE');
    app.renderAll();
    app.refreshWeather(false);
    app.captureGps(false);
  };

  app.logout = function () {
    app.state.currentAgent = null;
    app.state.selectedPropertyId = '';
    app.state.editingVisitId = '';
    app.state.editingPropertyId = '';
    app.state.visit = app.createEmptyVisit();
    app.saveSession(null);
    document.getElementById('loginPassword').value = '';
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    app.fillAgentSelect();
    app.showMessage('Sessão encerrada.', 'ok');
  };

  app.refreshWeather = function (force) {
    var cached = app.readWeatherCache();
    if (!force && cached && app.isWeatherCacheFresh(cached)) {
      app.renderWeatherHeader();
      return Promise.resolve(cached);
    }
    if (typeof fetch !== 'function') {
      app.renderWeatherHeader();
      return Promise.resolve(cached || null);
    }

    app.state.weatherLoading = true;
    app.renderWeatherHeader();

    return fetch(app.buildWeatherUrl(), {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Falha ao consultar o clima');
      }
      return response.json();
    }).then(function (payload) {
      var snapshot = app.normalizeWeatherSnapshot(payload);
      if (!snapshot) {
        throw new Error('Leitura de clima invalida');
      }
      app.saveSystemState({
        weatherCache: snapshot,
        lastWeatherError: ''
      });
      return snapshot;
    }).catch(function (error) {
      app.saveSystemState({
        lastWeatherError: error && error.message ? error.message : 'Falha ao consultar o clima'
      });
      return cached || null;
    }).then(function (snapshot) {
      app.state.weatherLoading = false;
      app.renderWeatherHeader();
      return snapshot;
    });
  };

  app.startWeatherRefresh = function () {
    if (app.state.weatherTimer) {
      clearInterval(app.state.weatherTimer);
    }
    app.state.weatherTimer = setInterval(function () {
      app.refreshWeather(false);
    }, Number((app.CONFIG.WEATHER && app.CONFIG.WEATHER.refreshMs) || (30 * 60 * 1000)));
  };

  app.registerServiceWorker = function () {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./assets/sw-acs.js?v=20260403e').catch(function () { return null; });
    }
  };

  app.bindEvents = function () {
    document.getElementById('loginBtn').addEventListener('click', app.tryLogin);
    document.getElementById('openAdminBtn').addEventListener('click', app.openAdminModal);
    document.getElementById('headerAdminBtn').addEventListener('click', app.openAdminModal);
    document.getElementById('closeAdminModalBtn').addEventListener('click', app.closeAdminModal);
    document.getElementById('logoutBtn').addEventListener('click', app.logout);
    document.getElementById('saveAgentBtn').addEventListener('click', app.saveAgentFromForm);
    document.getElementById('savePropertyBtn').addEventListener('click', app.savePropertyFromForm);
    document.getElementById('clearPropertyBtn').addEventListener('click', app.clearPropertyForm);
    document.getElementById('captureGpsBtn').addEventListener('click', function () { app.captureGps(true); });
    document.getElementById('captureGpsPropertyBtn').addEventListener('click', function () { app.captureGps(true); });
    document.getElementById('refreshPropertiesBtn').addEventListener('click', function () { app.bootstrapFromServer(); });
    document.getElementById('goToPropertiesBtn').addEventListener('click', function () { app.showScreen('imoveis'); });
    document.getElementById('saveVisitBtn').addEventListener('click', app.saveVisit);
    document.getElementById('cancelEditBtn').addEventListener('click', function () {
      app.state.editingVisitId = '';
      app.resetVisitForm();
      app.renderAll();
    });
    document.getElementById('takePhotoBtn').addEventListener('click', function () { document.getElementById('photoInput').click(); });
    document.getElementById('photoInput').addEventListener('change', function (event) { app.handlePhotoInput(event.target.files && event.target.files[0]); });
    document.getElementById('syncNowBtn').addEventListener('click', function () { app.tryAutoSync('manual'); });
    document.getElementById('dailyReportBtn').addEventListener('click', app.generateDailyReport);
    document.getElementById('openCardPreviewBtn').addEventListener('click', app.openCardPreview);
    if (document.getElementById('previewVisitReportBtn')) {
      document.getElementById('previewVisitReportBtn').addEventListener('click', app.openVisitReportPreview);
    }
    if (document.getElementById('openVisitPdfBtn')) {
      document.getElementById('openVisitPdfBtn').addEventListener('click', app.openVisitPdf);
    }
    if (document.getElementById('nextPropertyBtn')) {
      document.getElementById('nextPropertyBtn').addEventListener('click', function () { app.selectNextProperty(false); });
    }
    if (document.getElementById('pendingPropertiesBtn')) {
      document.getElementById('pendingPropertiesBtn').addEventListener('click', function () { app.selectNextProperty(true); });
    }
    if (document.getElementById('routePropertyBtn')) {
      document.getElementById('routePropertyBtn').addEventListener('click', app.openRouteToSelectedProperty);
    }
    if (document.getElementById('exportBackupBtn')) {
      document.getElementById('exportBackupBtn').addEventListener('click', function () { app.exportLocalBackup(false); });
    }
    if (document.getElementById('downloadQueueBtn')) {
      document.getElementById('downloadQueueBtn').addEventListener('click', function () { app.exportLocalBackup(true); });
    }
    if (document.getElementById('visitBairroSelect')) {
      document.getElementById('visitBairroSelect').addEventListener('change', app.handleVisitBairroChange);
    }
    if (document.getElementById('propertyQuickSelect')) {
      document.getElementById('propertyQuickSelect').addEventListener('change', function () {
        if (this.value) {
          app.selectProperty(this.value);
        }
      });
    }
    if (document.getElementById('clearSignatureBtn')) {
      document.getElementById('clearSignatureBtn').addEventListener('click', app.clearSignature);
    }
    if (document.getElementById('captureSignatureBtn')) {
      document.getElementById('captureSignatureBtn').addEventListener('click', function () {
        app.captureSignatureData(true);
      });
    }
    Array.from(document.querySelectorAll('.tab-btn')).forEach(function (button) {
      button.addEventListener('click', function () { app.showScreen(button.getAttribute('data-screen')); });
    });
    Array.from(document.querySelectorAll('[data-preset]')).forEach(function (button) {
      button.addEventListener('click', function () { app.applyPreset(button.getAttribute('data-preset')); });
    });
    ['visitDate', 'visitTime', 'visitFocusQty', 'visitTubitosQty', 'visitLarvicida', 'visitLarvicidaQty', 'visitAdulticida', 'visitAdulticidaQty', 'visitCardCode', 'visitObs'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        app.syncVisitWithInputs();
        app.createVisitSummary();
        app.renderHero();
      });
      document.getElementById(id).addEventListener('change', function () {
        app.syncVisitWithInputs();
        app.createVisitSummary();
        app.renderHero();
      });
    });
    if (document.getElementById('visitMicroarea')) {
      document.getElementById('visitMicroarea').addEventListener('change', app.handleVisitMicroareaChange);
    }
    if (document.getElementById('visitQuarteirao')) {
      document.getElementById('visitQuarteirao').addEventListener('change', function () {
        app.syncVisitWithInputs();
        app.saveLastArea(app.state.visit.microarea, app.state.visit.quarteirao);
        app.fillPropertyQuickSelect();
        app.createVisitSummary();
        app.renderHero();
      });
    }
    if (document.getElementById('propMicroarea')) {
      document.getElementById('propMicroarea').addEventListener('change', app.handlePropertyMicroareaChange);
    }
    if (document.getElementById('propBairro')) {
      document.getElementById('propBairro').addEventListener('change', app.handlePropertyBairroChange);
    }
    document.getElementById('propertySearch').addEventListener('input', app.renderProperties);
    document.getElementById('propertySort').addEventListener('change', app.renderProperties);

    document.addEventListener('click', function (event) {
      var choiceButton = event.target.closest('[data-choice-type]');
      var noteButton = event.target.closest('[data-note]');
      var stepButton = event.target.closest('[data-step-target]');
      var depositButton = event.target.closest('[data-deposit]');
      var agentEdit = event.target.closest('[data-agent-edit]');
      var agentDelete = event.target.closest('[data-agent-delete]');
      var propertyEdit = event.target.closest('[data-property-edit]');
      var propertySelect = event.target.closest('[data-property-select]');
      var propertyQuickFilter = event.target.closest('[data-property-quick-filter]');
      var visitEdit = event.target.closest('[data-visit-edit]');
      if (choiceButton) {
        var type = choiceButton.getAttribute('data-choice-type');
        var value = choiceButton.getAttribute('data-choice-value');
        if (type === 'situacao') {
          app.state.visit.situacao = value;
        } else if (type === 'focus') {
          app.state.visit.focusFound = value;
          if (value === 'Não') {
            app.state.visit.focusQty = 0;
            app.state.visit.depositFocusCounts = app.emptyDepositMap();
          } else if (app.state.visit.focusQty === 0) {
            app.state.visit.focusQty = Math.max(1, app.totalFromMap(app.state.visit.depositFocusCounts));
          }
        } else if (type === 'water') {
          app.state.visit.waterAccess = value;
        }
        app.updateVisitFormFromState();
        app.renderHero();
      }
      if (noteButton) { app.addQuickNote(noteButton.getAttribute('data-note')); }
      if (stepButton) { app.changeStepper(stepButton.getAttribute('data-step-target'), Number(stepButton.getAttribute('data-step') || 0)); }
      if (depositButton) {
        app.changeDeposit(depositButton.getAttribute('data-deposit'), depositButton.getAttribute('data-mode'), Number(depositButton.getAttribute('data-step') || 0));
      }
      if (agentEdit) { app.editAgent(agentEdit.getAttribute('data-agent-edit')); }
      if (agentDelete) { app.deleteAgent(agentDelete.getAttribute('data-agent-delete')); }
      if (propertyEdit) { app.loadPropertyIntoForm(propertyEdit.getAttribute('data-property-edit')); }
      if (propertySelect) { app.selectProperty(propertySelect.getAttribute('data-property-select')); }
      if (propertyQuickFilter) {
        app.state.propertyQuickFilter = propertyQuickFilter.getAttribute('data-property-quick-filter') || 'all';
        app.renderProperties();
      }
      if (visitEdit) { app.loadVisitForEdit(visitEdit.getAttribute('data-visit-edit')); }
    });

    document.addEventListener('change', function (event) {
      var checkbox = event.target.closest('[data-deposit-check]');
      if (checkbox) {
        app.toggleDepositFocus(checkbox.getAttribute('data-deposit-check'), checkbox.checked);
      }
    });

    window.addEventListener('online', function () {
      app.showMessage('Conexão restabelecida. Tentando sincronizar...', 'accent');
      app.bootstrapFromServer();
      app.tryAutoSync('online');
      app.refreshWeather(true);
    });
    window.addEventListener('beforeunload', function (event) {
      if (app.getUnsyncedVisits().length) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
  };

  app.applySession = function () {
    var session = app.readSession();
    if (session && session.uid) {
      app.state.currentAgent = session;
      app.enterApp();
    } else {
      document.getElementById('loginMessage').textContent = app.readAgents().length ?
        'Selecione o agente e informe a senha.' :
        'Cadastre os ACE no botão "Cadastro de ACE".';
    }
  };

  app.init = function () {
    app.ensureDynamicLayout();
    app.fillPropertyFormOptions();
    app.fillAgentSelect();
    app.renderQuickNotes();
    app.bindEvents();
    app.initSignaturePad();
    app.resetVisitForm();
    app.setSyncChip(app.isApiConfigured() ? 'Sync pronto' : 'Modo local', app.isApiConfigured() ? 'accent' : 'warn');
    app.renderAll();
    app.applySession();
    app.bootstrapFromServer();
    app.refreshWeather(false);
    app.startWeatherRefresh();
    app.registerServiceWorker();
  };

  app.init();
}());
