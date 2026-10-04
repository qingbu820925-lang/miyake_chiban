var size = 0;
var placement = 'point';

var style_TEXT_3 = function(feature, resolution){
    var display = window.mapDisplaySettings || {};
    var fontSize = Number(display.textSize);
    if (!isFinite(fontSize) || fontSize <= 0) fontSize = 10.4;
    var fontFamily = display.textFont || "'Open Sans', sans-serif";
    var labelFont = fontSize + 'px ' + fontFamily;
    var labelFill = display.textColor || '#323232';
    var bufferColor = display.bufferColor || '#fafa0d';
    var bufferWidth = Number(display.bufferWidth);
    if (!isFinite(bufferWidth) || bufferWidth < 0) bufferWidth = 3.0;
    var labelText = '';
    if (feature.get('大字地番') !== null) labelText = String(feature.get('大字地番'));

    return [new ol.style.Style({
        text: createTextStyle(feature, resolution, labelText, labelFont,
                              labelFill, 'point', bufferColor, bufferWidth)
    })];
};
