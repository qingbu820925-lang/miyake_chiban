/* QGIS2Web custom controls: current location + parcel search */
(function () {
    'use strict';

    var STORAGE_KEY = 'qgis2web_chiban_search_settings_v4';
    var BLINK_INTERVAL = 250;

    function getSearchLayers() {
        return layersList.filter(function (layer) {
            if (!layer || layer.get('type') === 'base') return false;
            return !!(layer.getSource && layer.getSource() instanceof ol.source.Vector);
        });
    }

    function getFields(layer) {
        if (!layer || !layer.getSource) return [];
        var names = [];
        var feats = layer.getSource().getFeatures ? layer.getSource().getFeatures() : [];
        feats.some(function (f) {
            (f.getKeys ? f.getKeys() : []).forEach(function (k) {
                if (k !== 'geometry' && k !== 'layerObject' && k !== 'idO' && names.indexOf(k) === -1) names.push(k);
            });
            return names.length > 0;
        });
        if (!names.length && layer.get('fieldAliases')) {
            names = Object.keys(layer.get('fieldAliases')).filter(function(k) {
                return k !== 'geometry' && k !== 'layerObject' && k !== 'idO';
            });
        }
        return names;
    }

    function fieldLabel(layer, field) {
        var aliases = layer && layer.get('fieldAliases');
        return aliases && aliases[field] ? aliases[field] : field;
    }

    function layerDisplayName(layer) {
        return layer ? String(layer.get('popuplayertitle') || layer.get('title') || '') : '';
    }

    function getLayerByInternalTitle(title) {
        return getSearchLayers().filter(function(l) { return l.get('title') === title; })[0] || null;
    }

    function findTextLayer() {
        return getSearchLayers().filter(function(l) {
            return layerDisplayName(l) === 'TEXT';
        })[0] || null;
    }

    function loadSettings() {
        var defaults = {
            layerTitle: null,
            field: null,
            oazi: [],
            zoomFactor: 2.0,
            blueBlink: true,
            blueBlinkSeconds: 2,
            blueDisplaySeconds: 60,
            redBlink: true,
            redBlinkSeconds: 2,
            redDisplaySeconds: 60
        };
        try {
            var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (saved) {
                Object.keys(defaults).forEach(function(k) {
                    if (saved[k] !== undefined) defaults[k] = saved[k];
                });
                if (!Array.isArray(defaults.oazi)) defaults.oazi = [];
                defaults.zoomFactor = Math.max(0.1, Math.round(Number(defaults.zoomFactor || 2) * 10) / 10);
                defaults.blueBlinkSeconds = Math.max(0.1, Number(defaults.blueBlinkSeconds || 2));
                defaults.redBlinkSeconds = Math.max(0.1, Number(defaults.redBlinkSeconds || 2));
                defaults.blueDisplaySeconds = Math.max(0.1, Number(defaults.blueDisplaySeconds || 60));
                defaults.redDisplaySeconds = Math.max(0.1, Number(defaults.redDisplaySeconds || 60));
            }
        } catch (e) {}

        var ls = getSearchLayers();
        var textLayer = findTextLayer();
        if (!defaults.layerTitle || !ls.some(function(l){ return l.get('title') === defaults.layerTitle; })) {
            defaults.layerTitle = textLayer ? textLayer.get('title') : (ls.length ? ls[0].get('title') : null);
        }
        var layer = getLayerByInternalTitle(defaults.layerTitle);
        var fields = getFields(layer);
        if (!defaults.field || fields.indexOf(defaults.field) === -1) {
            defaults.field = fields.indexOf('大字地番') >= 0 ? '大字地番' : (fields.length ? fields[0] : null);
        }
        return defaults;
    }

    var settings = loadSettings();
    function saveSettings() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    /* ---------- Restore the last map position ----------
       Save the map center/resolution whenever the view changes, and restore it
       on the next startup. This is kept separate from the parcel-search settings. */
    var MAP_VIEW_STORAGE_KEY = 'qgis2web_chiban_map_view_v1';

    function saveMapView() {
        try {
            var view = map.getView();
            var center = view.getCenter();
            var resolution = view.getResolution();
            if (!center || !isFinite(resolution)) return;
            localStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify({
                center: [Number(center[0]), Number(center[1])],
                resolution: Number(resolution),
                rotation: Number(view.getRotation() || 0)
            }));
        } catch (e) {}
    }

    function restoreMapView() {
        try {
            var saved = JSON.parse(localStorage.getItem(MAP_VIEW_STORAGE_KEY) || 'null');
            if (!saved || !Array.isArray(saved.center) || saved.center.length !== 2) return;
            if (!isFinite(Number(saved.center[0])) || !isFinite(Number(saved.center[1])) || !isFinite(Number(saved.resolution)) || Number(saved.resolution) <= 0) return;
            var view = map.getView();
            view.setCenter([Number(saved.center[0]), Number(saved.center[1])]);
            view.setResolution(Number(saved.resolution));
            if (isFinite(Number(saved.rotation))) view.setRotation(Number(saved.rotation));
        } catch (e) {}
    }

    restoreMapView();
    map.getView().on('change:center', saveMapView);
    map.getView().on('change:resolution', saveMapView);
    map.getView().on('change:rotation', saveMapView);

    /* ---------- marker layer ---------- */
    var markerSource = new ol.source.Vector();
    var blueMarkerStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 9,
            fill: new ol.style.Fill({color: '#1976d2'}),
            stroke: new ol.style.Stroke({color: '#ffffff', width: 3})
        })
    });
    var redMarkerStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 18,
            fill: new ol.style.Fill({color: 'rgba(229,57,53,0.5)'}),
            stroke: new ol.style.Stroke({color: '#ffffff', width: 4})
        })
    });
    var markerLayer = new ol.layer.Vector({
        source: markerSource,
        zIndex: 10000,
        style: function(feature) {
            if (feature.get('blinkVisible') === false) return null;
            return feature.get('markerColor') === 'red' ? redMarkerStyle : blueMarkerStyle;
        }
    });
    map.addLayer(markerLayer);

    function showMarker(coordinate, color) {
        var isBlue = color === 'blue';
        var blink = isBlue ? !!settings.blueBlink : !!settings.redBlink;
        var blinkSeconds = isBlue ? Number(settings.blueBlinkSeconds) : Number(settings.redBlinkSeconds);
        var displaySeconds = isBlue ? Number(settings.blueDisplaySeconds) : Number(settings.redDisplaySeconds);
        blinkSeconds = Math.max(0.1, isFinite(blinkSeconds) ? blinkSeconds : 2);
        displaySeconds = Math.max(blinkSeconds, isFinite(displaySeconds) ? displaySeconds : 60);

        var feature = new ol.Feature(new ol.geom.Point(coordinate));
        feature.set('markerColor', color);
        feature.set('blinkVisible', true);
        markerSource.addFeature(feature);

        var blinkTimer = null;
        if (blink) {
            var started = Date.now();
            blinkTimer = window.setInterval(function() {
                if (Date.now() - started >= blinkSeconds * 1000) {
                    window.clearInterval(blinkTimer);
                    blinkTimer = null;
                    feature.set('blinkVisible', true);
                    markerLayer.changed();
                    return;
                }
                feature.set('blinkVisible', !feature.get('blinkVisible'));
                markerLayer.changed();
            }, BLINK_INTERVAL);
        }

        window.setTimeout(function() {
            if (blinkTimer) window.clearInterval(blinkTimer);
            markerSource.removeFeature(feature);
        }, displaySeconds * 1000);
        return feature;
    }

    /* ---------- Current location: blue marker only ---------- */
    var locationButton = document.createElement('button');
    locationButton.type = 'button';
    locationButton.className = 'custom-location-button';
    locationButton.innerHTML = '<span class="location-marker-dot" aria-hidden="true"></span>';
    locationButton.title = '私は今ココ！';
    locationButton.setAttribute('aria-label', '私は今ココ！');

    var locationControl = document.createElement('div');
    locationControl.className = 'ol-unselectable ol-control custom-location-control';
    locationControl.appendChild(locationButton);

    var googleMapButton = document.createElement('button');
    googleMapButton.type = 'button';
    googleMapButton.className = 'google-map-location-button';
    googleMapButton.innerHTML = '<span class="google-pin-icon" aria-hidden="true"></span>';
    googleMapButton.title = 'クリックした地点をGoogleマップで表示';
    googleMapButton.setAttribute('aria-label', 'クリックした地点をGoogleマップで表示');
    locationControl.appendChild(googleMapButton);

    var googleMapClickMode = false;
    function setGoogleMapClickMode(enabled) {
        googleMapClickMode = enabled;
        googleMapButton.classList.toggle('active', enabled);
        googleMapButton.setAttribute('aria-pressed', String(enabled));
        map.getTargetElement().style.cursor = enabled ? 'crosshair' : '';
    }

    googleMapButton.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        setGoogleMapClickMode(!googleMapClickMode);
    });

    map.on('singleclick', function(evt) {
        if (!googleMapClickMode) return;
        var lonLat = ol.proj.toLonLat(evt.coordinate, map.getView().getProjection());
        var latitude = lonLat[1].toFixed(7);
        var longitude = lonLat[0].toFixed(7);
        var zoom = Math.max(1, Math.min(21, Math.round(map.getView().getZoom() || 18)));
        var googleMapUrl = 'https://www.google.com/maps/@?api=1&map_action=map' +
            '&center=' + encodeURIComponent(latitude + ',' + longitude) +
            '&zoom=' + zoom;
        setGoogleMapClickMode(false);
        window.open(googleMapUrl, '_blank', 'noopener,noreferrer');
    });

    locationButton.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        if (!navigator.geolocation) {
            window.alert('この端末またはブラウザでは現在地取得が利用できません。');
            return;
        }
        locationButton.disabled = true;
        navigator.geolocation.getCurrentPosition(function(pos) {
            var coord = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude], map.getView().getProjection());
            var view = map.getView();
            var resolution = view.getResolution();
            view.animate({center: coord, resolution: resolution, duration: 500});
            showMarker(coord, 'blue');
            locationButton.disabled = false;
        }, function(err) {
            var msg = '現在地を取得できませんでした。';
            if (err && err.code === 1) msg += '位置情報の利用を許可してください。';
            else if (err && err.code === 2) msg += '現在地を確認できません。';
            else if (err && err.code === 3) msg += '位置情報の取得がタイムアウトしました。';
            window.alert(msg);
            locationButton.disabled = false;
        }, {enableHighAccuracy: true, timeout: 15000, maximumAge: 0});
    });

    var topRightContainerDiv = document.getElementById('top-right-container');
    if (topRightContainerDiv) topRightContainerDiv.appendChild(locationControl);

    /* ---------- Parcel search panel ---------- */
    var panel = document.createElement('div');
    panel.id = 'chiban-search-panel';
    panel.className = 'chiban-search-panel';
    panel.innerHTML =
        '<div class="chiban-panel-header"><span>地番検索</span><button type="button" id="chiban-panel-toggle" aria-expanded="true">－</button></div>' +
        '<div id="chiban-panel-body" class="chiban-panel-body">' +
          '<button type="button" id="chiban-search-settings" class="chiban-setting-button">設定</button>' +
          '<button type="button" id="map-style-settings" class="chiban-setting-button map-style-button">表示設定</button>' +
          '<div class="chiban-fixed-label"><b>対象レイヤー：</b><span id="chiban-search-layer-display"></span></div>' +
          '<div class="chiban-fixed-label"><b>検索フィールド：</b><span id="chiban-search-field-display"></span></div>' +
          '<label>大字選択<select id="chiban-search-oazi"></select></label>' +
          '<label>地番設定<input id="chiban-search-number" type="text" placeholder="例：1"></label>' +
          '<button type="button" id="chiban-search-run" class="primary chiban-full-button">検索</button>' +
          '<div id="chiban-search-count" class="chiban-search-count">検索結果：0件</div>' +
          '<label>地番選択<select id="chiban-search-results" size="8"></select></label>' +
          '<button type="button" id="chiban-zoom-parcel" class="primary chiban-full-button">地番へズーム</button>' +
        '</div>';

    var topLeftContainerDiv = document.getElementById('top-left-container');
    if (topLeftContainerDiv) topLeftContainerDiv.insertBefore(panel, topLeftContainerDiv.firstChild);

    var searchLayerDisplay = document.getElementById('chiban-search-layer-display');
    var searchFieldDisplay = document.getElementById('chiban-search-field-display');
    var searchOaziSel = document.getElementById('chiban-search-oazi');
    var searchNumber = document.getElementById('chiban-search-number');
    var searchResults = document.getElementById('chiban-search-results');
    var searchCount = document.getElementById('chiban-search-count');
    var lastResults = [];

    function fillFieldSelect(select, layer, selectedField) {
        select.innerHTML = '';
        getFields(layer).forEach(function(field) {
            var opt = document.createElement('option');
            opt.value = field;
            opt.textContent = fieldLabel(layer, field);
            if (field === selectedField) opt.selected = true;
            select.appendChild(opt);
        });
        if (!select.value && select.options.length) select.selectedIndex = 0;
    }

    function fillOaziSelect(select, selected) {
        select.innerHTML = '';
        var blank = document.createElement('option');
        blank.value = ''; blank.textContent = '（指定なし）'; select.appendChild(blank);
        settings.oazi.forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            if (v === selected) opt.selected = true;
            select.appendChild(opt);
        });
    }

    function refreshSearchSelectors() {
        var layer = getLayerByInternalTitle(settings.layerTitle);
        if (!layer) {
            var ls = getSearchLayers();
            layer = ls[0] || null;
            settings.layerTitle = layer ? layer.get('title') : null;
        }
        searchLayerDisplay.textContent = layer ? layerDisplayName(layer) : '対象レイヤーなし';
        searchFieldDisplay.textContent = fieldLabel(layer, settings.field) || settings.field || '設定なし';
        fillOaziSelect(searchOaziSel, searchOaziSel.value || '');
    }

    /* ---------- Settings dialog ---------- */
    var settingsOverlay = document.createElement('div');
    settingsOverlay.id = 'chiban-settings-modal';
    settingsOverlay.className = 'chiban-modal-overlay';
    settingsOverlay.innerHTML =
        '<div class="chiban-modal chiban-settings-modal-size" role="dialog" aria-modal="true">' +
          '<div class="chiban-modal-header"><span>地番検索設定</span><button type="button" id="chiban-settings-close" class="chiban-modal-close">×</button></div>' +
          '<div class="chiban-modal-body">' +
            '<label>対象レイヤー<select id="chiban-setting-layer"></select></label>' +
            '<label>検索フィールド<select id="chiban-setting-field"></select></label>' +
            '<div class="chiban-setting-title">大字設定</div>' +
            '<div class="chiban-oazi-row"><select id="chiban-oazi-list" multiple size="8"></select>' +
              '<div class="chiban-oazi-buttons"><input id="chiban-oazi-add" type="text" placeholder="例：樫立,三根,大賀郷">' +
              '<button type="button" id="chiban-oazi-add-btn">追加</button><button type="button" id="chiban-oazi-del-btn">選択削除</button>' +
              '<button type="button" id="chiban-oazi-csv-btn">CSV読み込み</button><input id="chiban-oazi-csv" type="file" accept=".csv,text/csv" style="display:none"></div></div>' +
            '<label>ズーム倍率<input id="chiban-setting-zoom" type="number" min="0.1" step="0.1"></label>' +
            '<div class="chiban-marker-setting-title">「私は今ココ！」青色マーカー</div>' +
            '<label class="chiban-inline-check"><input id="chiban-blue-blink" type="checkbox"> ブリンクする</label>' +
            '<label>ブリンク秒数<input id="chiban-blue-blink-seconds" type="number" min="0.1" step="0.1"></label>' +
            '<label>表示秒数<input id="chiban-blue-display-seconds" type="number" min="0.1" step="1"></label>' +
            '<div class="chiban-marker-setting-title">「地番へズーム」赤色マーカー</div>' +
            '<label class="chiban-inline-check"><input id="chiban-red-blink" type="checkbox"> ブリンクする</label>' +
            '<label>ブリンク秒数<input id="chiban-red-blink-seconds" type="number" min="0.1" step="0.1"></label>' +
            '<label>表示秒数<input id="chiban-red-display-seconds" type="number" min="0.1" step="1"></label>' +
            '<div class="chiban-zoom-note">ズーム倍率：1.0＝地番ポリゴンが入る範囲、1.1＝1割広く、2.0＝2倍に広く表示</div>' +
            '<div class="chiban-actions"><button type="button" id="chiban-setting-cancel">キャンセル</button><button type="button" id="chiban-setting-save" class="primary">設定を保存</button></div>' +
          '</div></div>';
    document.body.appendChild(settingsOverlay);

    var settingLayerSel = document.getElementById('chiban-setting-layer');
    var settingFieldSel = document.getElementById('chiban-setting-field');
    var oaziList = document.getElementById('chiban-oazi-list');
    var oaziAdd = document.getElementById('chiban-oazi-add');
    var oaziZoom = document.getElementById('chiban-setting-zoom');
    var oaziCsv = document.getElementById('chiban-oazi-csv');
    var blueBlink = document.getElementById('chiban-blue-blink');
    var blueBlinkSeconds = document.getElementById('chiban-blue-blink-seconds');
    var blueDisplaySeconds = document.getElementById('chiban-blue-display-seconds');
    var redBlink = document.getElementById('chiban-red-blink');
    var redBlinkSeconds = document.getElementById('chiban-red-blink-seconds');
    var redDisplaySeconds = document.getElementById('chiban-red-display-seconds');

    function fillSettingLayerSelect() {
        settingLayerSel.innerHTML = '';
        getSearchLayers().forEach(function(layer) {
            var opt = document.createElement('option');
            opt.value = layer.get('title');
            opt.textContent = layerDisplayName(layer); // popuplayertitle
            if (opt.value === settings.layerTitle) opt.selected = true;
            settingLayerSel.appendChild(opt);
        });
        if (!settingLayerSel.value && settingLayerSel.options.length) settingLayerSel.selectedIndex = 0;
    }

    function refreshSettingsUI() {
        fillSettingLayerSelect();
        var layer = getLayerByInternalTitle(settingLayerSel.value || settings.layerTitle);
        fillFieldSelect(settingFieldSel, layer, settings.field);
        oaziList.innerHTML = '';
        settings.oazi.forEach(function(v) {
            var opt = document.createElement('option'); opt.value = v; opt.textContent = v; oaziList.appendChild(opt);
        });
        oaziZoom.value = Number(settings.zoomFactor).toFixed(1);
        blueBlink.checked = !!settings.blueBlink;
        blueBlinkSeconds.value = Number(settings.blueBlinkSeconds).toFixed(1);
        blueDisplaySeconds.value = Number(settings.blueDisplaySeconds).toFixed(0);
        redBlink.checked = !!settings.redBlink;
        redBlinkSeconds.value = Number(settings.redBlinkSeconds).toFixed(1);
        redDisplaySeconds.value = Number(settings.redDisplaySeconds).toFixed(0);
    }

    settingLayerSel.addEventListener('change', function() {
        var layer = getLayerByInternalTitle(settingLayerSel.value);
        fillFieldSelect(settingFieldSel, layer, null);
    });

    document.getElementById('chiban-oazi-add-btn').addEventListener('click', function() {
        oaziAdd.value.split(',').forEach(function(v) {
            v = v.trim(); if (v && settings.oazi.indexOf(v) === -1) settings.oazi.push(v);
        });
        oaziAdd.value = ''; refreshSettingsUI();
    });
    oaziAdd.addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('chiban-oazi-add-btn').click(); });
    document.getElementById('chiban-oazi-del-btn').addEventListener('click', function() {
        var remove = Array.prototype.slice.call(oaziList.selectedOptions).map(function(o){ return o.value; });
        settings.oazi = settings.oazi.filter(function(v){ return remove.indexOf(v) === -1; });
        refreshSettingsUI();
    });
    document.getElementById('chiban-oazi-csv-btn').addEventListener('click', function(){ oaziCsv.click(); });

    function decodeCsvBuffer(buffer) {
        var bytes = new Uint8Array(buffer);
        if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes);
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
        if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes);
        var utf8 = new TextDecoder('utf-8', {fatal:false}).decode(bytes);
        var reencoded = new TextEncoder().encode(utf8);
        var same = reencoded.length === bytes.length && reencoded.every(function(v,i){ return v === bytes[i]; });
        if (same && utf8.indexOf('\uFFFD') === -1) return utf8;
        try { return new TextDecoder('shift_jis').decode(bytes); } catch(e) { return utf8; }
    }

    oaziCsv.addEventListener('change', function() {
        var file = oaziCsv.files && oaziCsv.files[0]; if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
            var text = decodeCsvBuffer(reader.result).replace(/^\uFEFF/, '');
            text.split(/\r?\n/).forEach(function(line) {
                line.split(',').forEach(function(v) {
                    v = v.trim().replace(/^"(.*)"$/, '$1').trim();
                    if (v && settings.oazi.indexOf(v) === -1) settings.oazi.push(v);
                });
            });
            refreshSettingsUI(); oaziCsv.value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    function closeSettings(){ settingsOverlay.style.display = 'none'; }
    function openSettings(){ refreshSettingsUI(); settingsOverlay.style.display = 'flex'; }
    document.getElementById('chiban-settings-close').addEventListener('click', closeSettings);
    document.getElementById('chiban-setting-cancel').addEventListener('click', closeSettings);
    settingsOverlay.addEventListener('click', function(e){ if (e.target === settingsOverlay) closeSettings(); });

    document.getElementById('chiban-setting-save').addEventListener('click', function() {
        var zf = parseFloat(oaziZoom.value);
        var bbs = parseFloat(blueBlinkSeconds.value), bds = parseFloat(blueDisplaySeconds.value);
        var rbs = parseFloat(redBlinkSeconds.value), rds = parseFloat(redDisplaySeconds.value);
        if (!isFinite(zf) || zf < 0.1 || !isFinite(bbs) || bbs < 0.1 || !isFinite(bds) || bds < 0.1 || !isFinite(rbs) || rbs < 0.1 || !isFinite(rds) || rds < 0.1) {
            window.alert('倍率・秒数は0.1以上で設定してください。'); return;
        }
        zf = Math.round(zf * 10) / 10;
        settings.layerTitle = settingLayerSel.value;
        settings.field = settingFieldSel.value;
        settings.zoomFactor = zf;
        settings.oazi = Array.prototype.slice.call(oaziList.options).map(function(o){ return o.value; });
        settings.blueBlink = blueBlink.checked;
        settings.blueBlinkSeconds = Math.round(bbs * 10) / 10;
        settings.blueDisplaySeconds = Math.max(settings.blueBlinkSeconds, Math.round(bds));
        settings.redBlink = redBlink.checked;
        settings.redBlinkSeconds = Math.round(rbs * 10) / 10;
        settings.redDisplaySeconds = Math.max(settings.redBlinkSeconds, Math.round(rds));
        saveSettings(); refreshSearchSelectors(); closeSettings();
    });
    document.getElementById('chiban-search-settings').addEventListener('click', openSettings);


    /* ---------- LINE / TEXT display settings ---------- */
    var DISPLAY_STORAGE_KEY = 'qgis2web_map_display_settings_v1';
    var displayDefaults = {
        lineColor: '#3579b1', lineWidth: 0.76,
        textSize: 10.4, textFont: "'Open Sans', sans-serif",
        textColor: '#323232', bufferColor: '#fafa0d', bufferWidth: 3.0
    };
    try {
        window.mapDisplaySettings = Object.assign({}, displayDefaults,
            JSON.parse(localStorage.getItem(DISPLAY_STORAGE_KEY) || '{}'));
    } catch (e) { window.mapDisplaySettings = Object.assign({}, displayDefaults); }

    function refreshDisplayLayers() {
        if (typeof lyr_LINE_2 !== 'undefined') { lyr_LINE_2.setStyle(style_LINE_2); lyr_LINE_2.changed(); }
        if (typeof lyr_TEXT_3 !== 'undefined') { lyr_TEXT_3.setStyle(style_TEXT_3); lyr_TEXT_3.changed(); }
        map.render();
    }

    var styleOverlay = document.createElement('div');
    styleOverlay.id = 'map-style-modal';
    styleOverlay.className = 'chiban-modal-overlay';
    styleOverlay.innerHTML =
      '<div class="chiban-modal map-style-modal-size" role="dialog" aria-modal="true" aria-labelledby="map-style-title">' +
        '<div class="chiban-modal-header"><span id="map-style-title">レイヤー表示設定</span><button type="button" id="map-style-close" class="chiban-modal-close">×</button></div>' +
        '<div class="chiban-modal-body map-style-body">' +
          '<fieldset><legend>LINE レイヤー</legend>' +
            '<label>線の色<input id="map-line-color" type="color"></label>' +
            '<label>線の太さ<input id="map-line-width" type="number" min="0.1" max="20" step="0.1"></label>' +
          '</fieldset>' +
          '<fieldset><legend>TEXT レイヤー</legend>' +
            '<label>文字サイズ<input id="map-text-size" type="number" min="1" max="100" step="0.1"></label>' +
            '<label>フォント<select id="map-text-font"><option value="\'Open Sans\', sans-serif">Open Sans</option><option value="sans-serif">ゴシック体（sans-serif）</option><option value="serif">明朝体（serif）</option><option value="monospace">等幅（monospace）</option><option value="\'Yu Gothic\', sans-serif">游ゴシック</option><option value="\'Yu Mincho\', serif">游明朝</option><option value="Meiryo, sans-serif">メイリオ</option></select></label>' +
            '<label>文字の色<input id="map-text-color" type="color"></label>' +
            '<label>テキストバッファの色<input id="map-buffer-color" type="color"></label>' +
            '<label>テキストバッファの太さ<input id="map-buffer-width" type="number" min="0" max="20" step="0.1"></label>' +
          '</fieldset>' +
          '<div class="chiban-modal-actions"><button type="button" id="map-style-reset">初期値に戻す</button><button type="button" id="map-style-cancel">キャンセル</button><button type="button" id="map-style-save" class="primary">保存</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(styleOverlay);

    var lineColorEl = document.getElementById('map-line-color');
    var lineWidthEl = document.getElementById('map-line-width');
    var textSizeEl = document.getElementById('map-text-size');
    var textFontEl = document.getElementById('map-text-font');
    var textColorEl = document.getElementById('map-text-color');
    var bufferColorEl = document.getElementById('map-buffer-color');
    var bufferWidthEl = document.getElementById('map-buffer-width');
    function fillStyleForm(v) {
        lineColorEl.value=v.lineColor; lineWidthEl.value=v.lineWidth;
        textSizeEl.value=v.textSize; textFontEl.value=v.textFont;
        textColorEl.value=v.textColor; bufferColorEl.value=v.bufferColor;
        bufferWidthEl.value=v.bufferWidth;
    }
    function closeStyleSettings(){ styleOverlay.style.display='none'; }
    function openStyleSettings(){ fillStyleForm(window.mapDisplaySettings); styleOverlay.style.display='flex'; }
    document.getElementById('map-style-settings').addEventListener('click', openStyleSettings);
    document.getElementById('map-style-close').addEventListener('click', closeStyleSettings);
    document.getElementById('map-style-cancel').addEventListener('click', closeStyleSettings);
    styleOverlay.addEventListener('click', function(e){ if(e.target===styleOverlay) closeStyleSettings(); });
    document.getElementById('map-style-reset').addEventListener('click', function(){ fillStyleForm(displayDefaults); });
    document.getElementById('map-style-save').addEventListener('click', function(){
        var lw=parseFloat(lineWidthEl.value), ts=parseFloat(textSizeEl.value), bw=parseFloat(bufferWidthEl.value);
        if(!isFinite(lw)||lw<=0||!isFinite(ts)||ts<=0||!isFinite(bw)||bw<0){
            window.alert('線の太さと文字サイズは0より大きい値、バッファの太さは0以上で設定してください。'); return;
        }
        window.mapDisplaySettings={lineColor:lineColorEl.value,lineWidth:lw,textSize:ts,textFont:textFontEl.value,
            textColor:textColorEl.value,bufferColor:bufferColorEl.value,bufferWidth:bw};
        localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(window.mapDisplaySettings));
        refreshDisplayLayers(); closeStyleSettings();
    });
    refreshDisplayLayers();

    /* ---------- Search: concatenate selected 大字 + 地番, then test substring ---------- */
    function normalizeDigits(s) {
        return String(s == null ? '' : s).replace(/[０-９]/g, function(c){ return String.fromCharCode(c.charCodeAt(0)-0xFEE0); });
    }
    function matchesSearch(value, oazi, number) {
        value = String(value == null ? '' : value).trim();
        if (!value) return false;
        var key = normalizeDigits(oazi + number);
        return key === '' || normalizeDigits(value).indexOf(key) !== -1;
    }
    function parcelSort(a,b) { return String(a).localeCompare(String(b), 'ja', {numeric:true}); }

    document.getElementById('chiban-search-run').addEventListener('click', function() {
        var layer = getLayerByInternalTitle(settings.layerTitle), field = settings.field;
        var oazi = searchOaziSel.value.trim(), number = normalizeDigits(searchNumber.value.trim());
        lastResults = [];
        searchResults.innerHTML = '';
        if (!layer || !field) { searchCount.textContent = '検索結果：0件'; return; }
        var mapByValue = {};
        layer.getSource().getFeatures().forEach(function(feature) {
            var value = feature.get(field);
            if (matchesSearch(value, oazi, number)) {
                var key = String(value);
                if (!mapByValue[key]) mapByValue[key] = [];
                mapByValue[key].push(feature);
            }
        });
        lastResults = Object.keys(mapByValue).sort(parcelSort).map(function(value){ return {value:value, features:mapByValue[value]}; });
        lastResults.forEach(function(item, i) {
            var opt = document.createElement('option'); opt.value = String(i); opt.textContent = item.value; searchResults.appendChild(opt);
        });
        searchCount.textContent = '検索結果：' + lastResults.length + '件';
        if (lastResults.length) searchResults.selectedIndex = 0;
    });

    function zoomSelectedParcel() {
        var idx = searchResults.selectedIndex;
        if (idx < 0 || !lastResults[idx]) { window.alert('地番を選択してください。'); return; }
        var extent = ol.extent.createEmpty();
        lastResults[idx].features.forEach(function(feature) { var geom = feature.getGeometry(); if (geom) ol.extent.extend(extent, geom.getExtent()); });
        if (ol.extent.isEmpty(extent)) return;
        var view = map.getView(), size = map.getSize(); if (!size) return;
        var factor = Number(settings.zoomFactor) || 2.0;
        var resolution = view.getResolutionForExtent(extent, size) * factor;
        view.animate({center: ol.extent.getCenter(extent), resolution: resolution, duration: 600});
        showMarker(ol.extent.getCenter(extent), 'red');
    }
    document.getElementById('chiban-zoom-parcel').addEventListener('click', zoomSelectedParcel);
    searchResults.addEventListener('dblclick', zoomSelectedParcel);

    var panelBody = document.getElementById('chiban-panel-body');
    document.getElementById('chiban-panel-toggle').addEventListener('click', function() {
        var open = panelBody.style.display !== 'none';
        panelBody.style.display = open ? 'none' : 'block';
        this.textContent = open ? '＋' : '－';
        this.setAttribute('aria-expanded', String(!open));
        ensureMapControlsVisible();
    });

    /* Keep Zoom IN/OUT and Measure visible regardless of search panel state. */
    function ensureMapControlsVisible() {
        if (!topLeftContainerDiv) return;
        var zoom = document.getElementsByClassName('ol-zoom')[0];
        var measure = document.querySelector('.measure-control');
        if (zoom && zoom.parentElement !== topLeftContainerDiv) topLeftContainerDiv.appendChild(zoom);
        if (measure && measure.parentElement !== topLeftContainerDiv) topLeftContainerDiv.appendChild(measure);
        if (zoom) zoom.style.display = '';
        if (measure) measure.style.display = '';
    }

    /* Reorder custom panel first, then standard controls. */
    if (topLeftContainerDiv) {
        topLeftContainerDiv.insertBefore(panel, topLeftContainerDiv.firstChild);
        setTimeout(ensureMapControlsVisible, 0);
        setTimeout(ensureMapControlsVisible, 300);
    }

    /* Tokyo Metropolitan Bureau of Industrial and Labor Affairs */
    var tokyoLink = document.createElement('a');
    tokyoLink.href = 'https://www.sangyo-rodo.metro.tokyo.lg.jp/';
    tokyoLink.target = '_blank'; tokyoLink.rel = 'noopener noreferrer';
    tokyoLink.textContent = '東京都産業労働局'; tokyoLink.className = 'tokyo-sangyo-link';
    document.body.appendChild(tokyoLink);

    refreshSearchSelectors();
    saveSettings();
})();
