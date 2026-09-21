var wms_layers = [];


        var lyr_GoogleMAP_0 = new ol.layer.Tile({
            'title': 'Google MAP',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
            })
        });

        var lyr_GoogleMAP_1 = new ol.layer.Tile({
            'title': 'GoogleMAP 航空写真',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format_LINE_2 = new ol.format.GeoJSON();
var features_LINE_2 = format_LINE_2.readFeatures(json_LINE_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_LINE_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_LINE_2.addFeatures(features_LINE_2);
var lyr_LINE_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_LINE_2, 
                style: style_LINE_2,
                popuplayertitle: 'LINE',
                interactive: false,
                title: '<img src="styles/legend/LINE_2.png" /> LINE'
            });
var format_TEXT_3 = new ol.format.GeoJSON();
var features_TEXT_3 = format_TEXT_3.readFeatures(json_TEXT_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_TEXT_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_TEXT_3.addFeatures(features_TEXT_3);
var lyr_TEXT_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_TEXT_3, 
                style: style_TEXT_3,
                popuplayertitle: 'TEXT',
                interactive: true,
                title: 'TEXT'
            });

lyr_GoogleMAP_0.setVisible(false);lyr_GoogleMAP_1.setVisible(true);lyr_LINE_2.setVisible(true);lyr_TEXT_3.setVisible(true);
var layersList = [lyr_GoogleMAP_0,lyr_GoogleMAP_1,lyr_LINE_2,lyr_TEXT_3];
lyr_LINE_2.set('fieldAliases', {'fid': 'fid', 'ID': 'ID', '市区町村名': '市区町村名', });
lyr_TEXT_3.set('fieldAliases', {'fid': 'fid', '市区町村名': '市区町村名', '大字名': '大字名', '地番': '地番', '大字地番': '大字地番', });
lyr_LINE_2.set('fieldImages', {'fid': 'TextEdit', 'ID': 'TextEdit', '市区町村名': 'TextEdit', });
lyr_TEXT_3.set('fieldImages', {'fid': 'TextEdit', '市区町村名': 'TextEdit', '大字名': 'TextEdit', '地番': 'TextEdit', '大字地番': 'TextEdit', });
lyr_LINE_2.set('fieldLabels', {'fid': 'no label', 'ID': 'no label', '市区町村名': 'no label', });
lyr_TEXT_3.set('fieldLabels', {'fid': 'hidden field', '市区町村名': 'hidden field', '大字名': 'inline label - always visible', '地番': 'inline label - always visible', '大字地番': 'hidden field', });
lyr_TEXT_3.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});