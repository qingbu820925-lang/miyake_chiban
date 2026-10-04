var size = 0;
var placement = 'point';

var style_LINE_2 = function(feature, resolution){
    var display = window.mapDisplaySettings || {};
    var lineColor = display.lineColor || '#3579b1';
    var lineWidth = Number(display.lineWidth);
    if (!isFinite(lineWidth) || lineWidth <= 0) lineWidth = 0.76;

    return [new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: lineColor,
            lineDash: null,
            lineCap: 'square',
            lineJoin: 'bevel',
            width: lineWidth
        })
    })];
};
