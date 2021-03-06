dojo.require("esri.arcgis.utils");
dojo.require("esri.config");

var COLOR_SCHEMES = [
					{name:"blue",iconDir:"blue",iconPrefix:"NumberIconb",color:"#177ff1"},
					{name:"red",iconDir:"red",iconPrefix:"NumberIcon",color:"#fd2d29"},
					{name:"green",iconDir:"green",iconPrefix:"NumberIcong",color:"#22880d"},
					{name:"purple",iconDir:"purple",iconPrefix:"IconPurple",color:"#9c46fd"}
					];
					
var COLOR_DIM = "#E7E7E7";
var COLOR_FULL = "#FFFFFF";

var LEFT_PANE_WIDTH_TWO_COLUMN = 327;
var LEFT_PANE_WIDTH_THREE_COLUMN = 485;

var TWO_COLUMN_THRESHOLD = 960;

var FIELDNAME_NUMBER = "Number";
var FIELDNAME_TITLE = "Title";
var FIELDNAME_SHORTDESC = "Short_desc";
var FIELDNAME_IMAGEURL = "Image_URL";
var FIELDNAME_ADDRESS = "Address";
var FIELDNAME_HOURS = "Hours";
var FIELDNAME_WEBSITE = "Website";
var FIELDNAME_DESC1 = "Desc1";
var FIELDNAME_DESC2 = "Desc2";
var FIELDNAME_DESC3 = "Desc3";
var FIELDNAME_DESC4 = "Desc4";
var FIELDNAME_DESC5 = "Desc5";
var FIELDNAME_ID = "Shortlist-ID";
var FIELDNAME_LAYER = "Layer";
//var FIELDNAME_FULLSIZEURL = "FullSize_URL";
var FIELDNAME_FULLSIZEURL = "Large_URL";  //1024x768
var FIELDNAME_CREDITS = "Credits";

var _lutIconSpecs = {
	tiny:new IconSpecs(22,28,3,8),
	medium:new IconSpecs(24,30,3,8),
	large:new IconSpecs(32,40,3,11)
}
	
var _contentLayers = [];

var _isMobile = isMobile();  //based on device type (see lib/common/helper_functions.js)
                             //used for behavior in mouse over/out events
var _isIE = (navigator.appVersion.indexOf("MSIE") > -1);

var _map;

var _layout = null; //one of 'normal' : 'responsive' - based on the size of the browser window

var _bookmarks;

var _layerCurrent;

var _selected;  //map graphic

var _selectedTile;

var _selectedLayer; //esri/layers/Layer

var _initExtent;

var _locateLayer;
var _locateSymobol;

var _mobileThemeSwiper;
var _mobileFeatureSwiper;
var _firstLoad = true;

var _dojoReady = false;
var _jqueryReady = false;

/******************************************************
************************* init ************************
*******************************************************/

dojo.addOnLoad(function() {_dojoReady = true;init()});
jQuery(document).ready(function() {_jqueryReady = true;init()});

/* init comes in three parts because of async calls getApp and createMap. */

function init() {
    if (!_jqueryReady) return;
    if (!_dojoReady) return;

    // This function is responsible for setting up the configuration object, then calling the initApp()
    
    // Three configuration options control where we get other configuration options
    // We need the query parameters in case the defaults were overwritten
    var queryParameters = GetQueryParameters();

    config.default_sharing_url = queryParameters["default_sharing_url"] || config.default_sharing_url;
    config.default_proxy_url = queryParameters["default_proxy_url"] || config.default_proxy_url;
    config.appid = queryParameters["appid"] || config.appid;

    //TODO: sanity check these three options, and be prepared to fail gracefully

    // These configuration options are required for getting the app and map items
    esri.arcgis.utils.arcgisUrl = config.default_sharing_url;
    esri.config.defaults.io.proxyurl = config.default_proxy_url;

    // Get the app configuration from AGOL/Portal
    if (config.appid) {
        getAppConfig(config, queryParameters);
        // getAppConfig() will eventually call initApp()
    } else {
        initApp(config, queryParameters)
    }
}

function initApp(config, queryParameters) {
    // Add the query parameters to the config object
    $.extend(config, queryParameters);
    sanitizeConfig();

    //TODO: remove this after testing
    console.log(config);

    //Retrieve the map
    if (!config.webmap) {
        var errorTitle = "No map provided";
        var subtitle = config.appid ? "The appid is invalid or inaccessible" : "and no appid either";
        initError(errorTitle, subtitle);
        return false;
    }
    esri.arcgis.utils.createMap(config.webmap, "map", {
        mapOptions: {
            slider: false,
            wrapAround180:false
        },
        ignorePopups: true
    }).then(
        function(response) {
            initMap(config, response);
        },
        function(error) {
            //TODO: Check for permission problem and then try logging in first
            var errorTitle = "Map creation failed";
            initError(errorTitle, error.message);
            return false;
        }
    );

    // Configure Header and other items not dependent on map
    if (config.unit) fixheader(config.unit);
    setupSocialMediaIcons();

	handleWindowResize();
	$(this).resize(handleWindowResize);	
	
	$("#zoomIn").click(function(e) {
        _map.setLevel(_map.getLevel()+1);
		hideBookmarks();
    });
	$("#zoomOut").click(function(e) {
        _map.setLevel(_map.getLevel()-1);
		hideBookmarks();
    });
	$("#zoomExtent").click(function(e) {
        _map.setExtent(_initExtent);
		hideBookmarks();
    });	
	
	$(document).bind('cbox_complete', function(){
		$(".details .rightDiv").height($(".details").height() - $(".details .title").height() - 40);
	});

    $("#bookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
    $("#bookmarksToggle").click(function(){
		if ($("#bookmarksDiv").css('display')=='none'){
		  $("#bookmarksTogText").html(config.bookmarks_alias+' &#x25B2;');
		}
		else{
		  $("#bookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
		}
		$("#bookmarksDiv").slideToggle();
	});
	$("#mobileBookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
	$("#mobileBookmarksToggle").click(function(){
		if ($("#mobileBookmarksDiv").css('display')=='none'){
		  $("#mobileBookmarksTogText").html(config.bookmarks_alias+' &#x25B2;');
		}
		else{
		  $("#mobileBookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
		}
		$("#mobileBookmarksDiv").slideToggle();
	});
    

	dojo.connect(dojo.byId('returnIcon'), 'onclick', showMobileList);
	
	dojo.connect(dojo.byId('returnHiddenBar'), 'onclick', showMobileList);
	
	dojo.connect(dojo.byId('centerMapIconContainer'), 'onclick', centerMapOnFeature);
	
	dojo.connect(dojo.byId('locateButton'), 'onclick', getDeviceLocation);

	$('#navThemeRight').on('click', function(){
		_mobileThemeSwiper.swipeNext()
	})
	$('#navThemeLeft').on('click', function(){
		_mobileThemeSwiper.swipePrev()
	})
	$('#mobileThemeBar').on('click', function(){
		hideBookmarks();
	})
	
	_mobileThemeSwiper = new Swiper('#mobileThemeBar .swiper-container',{
		mode:'horizontal',
		onSlideChangeEnd : function(){
			activateLayer(_contentLayers[_mobileThemeSwiper.activeLoopIndex]);
		}
	});
	
	_mobileFeatureSwiper = new Swiper('#mobileFeature .swiper-container',{
		mode:'horizontal',
		//keyboardControl: true,
		onSlideNext: function(){
			swipeFeature();
		},
		onSlidePrev: function(){
			swipeFeature();
		},
		onSlideReset: function(evt){
			if ((_mobileFeatureSwiper.previousIndex == 0 || _mobileFeatureSwiper.previousIndex == -0) && evt.touches.diff > 0) {
				loopFeatureSlides('left')
			}
			if ((_mobileFeatureSwiper.previousIndex == (_mobileFeatureSwiper.slides.length - 1)) && (evt.touches.diff < 0)) {
				loopFeatureSlides('right')
			}
		}
	});   
	if(config.geolocator)
		$('#locateButton').css('display', 'block');
}

function initMap(config, mapItem) {
    if (!config.caption) {
        config.caption = config.title;  //Automatic property of appid (defaults to map snippet)
    }
    if (!config.caption) {
        config.caption = mapItem.itemInfo.item.snippet
    }
    if (!config.caption) {
        config.caption = mapItem.itemInfo.item.title
    }

    document.title = config.caption;
    $("#title").html(config.caption);
    $('#mobileTitle').html(config.caption);

    _map = mapItem.map;

    dojo.connect(_map, 'onExtentChange', refreshList);

    // click action on the map where there's no graphic
    // causes a deselect.

    dojo.connect(_map, 'onClick', function(event){
        if (event.graphic == null && headerIsVisible()) {
            unselect();
        }
        $('#mobileTitlePage').css('display', 'none');
        hideBookmarks();
    });

    dojo.connect(_map, 'onZoomEnd', function(){
        var level = _map.getLevel();
        if (level > -1 && level === _map.getMaxZoom()) {
            $('#zoomIn').addClass('disableControls');
        }
        else
        if (level > -1 && level === _map.getMinZoom()) {
            $('#zoomOut').addClass('disableControls');
        }
        else {
            $('#zoomIn').removeClass('disableControls');
            $('#zoomOut').removeClass('disableControls');
        }
    })

    _bookmarks = mapItem.itemInfo.itemData.bookmarks;
    if (_bookmarks) {
        loadBookmarks();
        $("#bookmarksCon").show();
        $("#mobileBookmarksCon").show();
        handleWindowResize(); // additional call to re-size tab bar
    }

    var layers = mapItem.itemInfo.itemData.operationalLayers;

    if(_map.loaded){
        initAppContent(layers);
    } else {
        dojo.connect(_map,"onLoad",function(){
            initAppContent(layers);
        });
    }

}

function initAppContent(layers) {
	
	var supportLayers = [];
	var pointLayers = [];
	
	var arrExemptions = [];
	$.each(config.point_layers_not_to_be_shown_as_tabs.split("|"), function(index, value) {
		arrExemptions.push($.trim(value).toLowerCase());
	});
	
	var supportingLayersThatAreClickable = [];
	$.each(config.supporting_layers_that_are_clickable.split("|"), function(index, value) {
		supportingLayersThatAreClickable.push($.trim(value).toLowerCase());
	});
		
	$.each(layers, function(index,value){
		if (value.url == null || value.type == "CSV") {
			if (
				getFeatureSet(value).geometryType == "esriGeometryPoint" && 
				$.inArray(value.title.toLowerCase(), arrExemptions) == -1
				) {
				pointLayers.push(value);
			} else {
				supportLayers.push(value);
			}
		} else {
			// if the layer has an url property (meaning that it comes from a service), just
			// keep going...it will remain in the map, but won't be query-able.
		}		
	});

	_initExtent = _map.extent;
	
	_locateSymbol = new esri.symbol.PictureMarkerSymbol('images/mapcommand-location-marker.png', 21, 21);
	_locateLayer = new esri.layers.GraphicsLayer({id: 'locateLayer'});
	_map.addLayer(_locateLayer);
	
	var supportLayer;
	$.each(supportLayers,function(index,value) {
		supportLayer = _map.getLayer($.grep(_map.graphicsLayerIds, function(n,i){return _map.getLayer(n).id == getID(value)})[0]);
		if (supportLayer == null) return;
		$.each(supportLayer.graphics,function(index,value) {
			value.attributes.getValueCI = getValueCI; // assign extra method to handle case sensitivity
		});
		if ($.inArray(value.title.toLowerCase(), supportingLayersThatAreClickable) > -1) {
			dojo.connect(supportLayer, "onMouseOver", baselayer_onMouseOver);
			dojo.connect(supportLayer, "onMouseOut", baselayer_onMouseOut);
			dojo.connect(supportLayer, "onClick", baselayer_onClick);
		} else {
			dojo.connect(supportLayer, "onClick", function(){unselect()});
		}
	});
	
	var contentLayer;
	var colorScheme;
	var colorOrder = config.color_order.split(",");
	var colorIndex;
	$.each(pointLayers,function(index,value) {
		_map.removeLayer(_map.getLayer($.grep(_map.graphicsLayerIds, function(n,i){return _map.getLayer(n).id == getID(value)})[0]));
		$.each(getFeatureSet(value).features, function(index,value) {
			value.attributes.getValueCI = getValueCI; // assign extra method to handle case sensitivity
			value.attributes[FIELDNAME_ID] = index; // assign internal shortlist id
		});
		/* color index assignment is a weird bit of voodoo.  first thing to consider
		   is that layers names actually appear in tabs in reverse order (i.e. last layer in
		   is leftmost tab).  this means that we have to invert the color index for things to match
		   right.  also, using modulus to handle overflow -- when there are more layers
		   than colors.  so, we end up re-using colors but keeping the sequence. */
		colorIndex = (pointLayers.length - index - 1) % colorOrder.length;
		colorScheme = $.grep(COLOR_SCHEMES, function(n,i){
			return n.name.toLowerCase() == $.trim(colorOrder[colorIndex].toLowerCase())
		})[0];
		contentLayer = buildLayer(
					getFeatureSet(value).features.sort(SortByNumber),
					colorScheme.iconDir,
					colorScheme.iconPrefix
					);
		contentLayer.color = colorScheme.color;
		contentLayer.title = value.title;
		dojo.connect(contentLayer, "onMouseOver", layer_onMouseOver);
		dojo.connect(contentLayer, "onMouseOut", layer_onMouseOut);
		dojo.connect(contentLayer, "onClick", layer_onClick);
	
		_map.addLayer(contentLayer);
		_contentLayers.push(contentLayer);
	});

	_contentLayers.reverse();
		
	if (_contentLayers.length > 1) {
	 	$('#mobileTitlePage').append('<ul id="mobileThemeList" style=" height: 80px; line-height: 80px;" class="mobileTileList introList">')
		$.each(_contentLayers, function(index, value){
			$("#tabs").append('<div class="tab" tabindex="0" onclick="activateLayer(_contentLayers[' + index + ']), hideBookmarks()">' + value.title + '</div>', true);
			var newSlide = _mobileThemeSwiper.createSlide('<p>' + value.title + '</p>');
			newSlide.append();
			var introList = $('<li class="mobileTitleThemes" tabindex="0" onclick="selectMobileTheme(' + index + ')">').append('<span style="margin-left: 30px; margin-right: 30px; vertical-align: middle; line-height: 20px; display: inline-block;">' + value.title + '</span>')
			if(index == 0)
				$(introList).css('border-width', '2px 0px 1px 0px')
			if(index == (_contentLayers.length - 1))
				$(introList).css('border-width', '1px 0px 2px 0px')
			$('#mobileThemeList').append(introList)
			
		});
	}
	
	else {
		$(".tab").css("display", "none");
		$('#mobileThemeBar .swiper-container').css('display', 'none');
		$('#mobileTitlePage').append("<br><hr/>")
		$('#mobileTitlePage').append('<ul id="mobileThemeList" class="mobileTileList">')
		var introList = $('<li class="mobileTitleTheme" tabindex="0" onclick="selectMobileTheme(' + 0 + ')">').append('<div class="startButton"> Start </div>')
		$('#mobileThemeList').append(introList)
	}

	//_mobileThemeSwiper.enableKeyboardControl();

	activateLayer(_contentLayers[0], false);
	$("#zoomToggle").css("visibility","visible");
	$("#whiteOut").fadeOut("slow");
	
	$(".share_facebook").click(shareFacebook);
	$(".share_twitter").click(shareTwitter);
	$(".share_bitly").click(requestBitly);
	$("#map").height($("#mainWindow").height() - $('#divStrip').height());
	$("#map").css('top',$('#divStrip').height());

    //Use enter/return key on focused element to trigger click event
    //Use +/- keys to zoom in/out of map
    $('body').keypress(function(e){
        if(e.which == 13){ //enter/return
            $( document.activeElement).click()
        }
        if(e.which == 43) { //'+'
            _map.setLevel(_map.getLevel()+1);
            $("#zoomIn").focus();
            hideBookmarks();
        }
        if(e.which == 45) { //'-'
            _map.setLevel(_map.getLevel()-1);
            $("#zoomOut").focus();
            hideBookmarks();
        }
    });

    $('#myList').keydown(function(e){
        if (e.which == 27) {
			leaveTileGroup();
        }
    });

    $('#tabs .tab').keypress(function(e){
        if (e.which == 13) {
			var tabIndex = $("#tabs .tab").index(this);
			var layer = _contentLayers[tabIndex];
			enterTileGroup(layer);
			e.stopPropagation();
		}
    });

	$('#tabs div.tab').keydown(function(e){
		if (e.which == 37) {
			if ($(this).is( ":first-child" ))  {
				$('#tabs div:last-child').focus();
			}
			else {
				$(this).prev().focus();
			}
		}
		if (e.which == 39) {
			if ($(this).is( ":last-child" )) {
				$('#tabs div:first-child').focus();
			} else {
				$(this).next().focus();
			}
		}
		if (e.which == 40) {
			var tabIndex = $("#tabs .tab").index(this);
			var layer = _contentLayers[tabIndex];
			enterTileGroup(layer);
		}
	});

    _map.disableKeyboardNavigation();

    $('#map').keydown(function(e){
        oldCenter = _map.extent.getCenter();
        deltaX = _map.extent.getWidth() * config.pan_percent;
        deltaY = _map.extent.getHeight() * config.pan_percent;
        if (e.which == 37) {
            var newCenter = oldCenter.offset(-deltaX,0)
            _map.centerAt(newCenter)
        }
        if (e.which == 38) {
            var newCenter = oldCenter.offset(0,deltaY)
            _map.centerAt(newCenter)
        }
        if (e.which == 39) {
            var newCenter = oldCenter.offset(deltaX,0)
            _map.centerAt(newCenter)
        }
        if (e.which == 40) {
            var newCenter = oldCenter.offset(0,-deltaY)
            _map.centerAt(newCenter)
        }
    });

	$('#bookmarksToggle').keydown(function(e){
		if (e.which == 38) {
			$('#bookmarksDiv a').last().focus();
		}
		if (e.which == 40) {
			$('#bookmarksDiv a').first().focus();
		}
	});

	$('#bookmarksDiv p').keydown(function(e){
		if (e.which == 38) {
			if ($( this ).is( ":first-child" ))  {
				$('#bookmarksToggle').focus();
			}
			else {
				$(this).prev("p").children("a").focus();
			}
		}
		if (e.which == 40) {
			if ($( this ).is( ":last-child" )) {
				$('#bookmarksToggle').focus();
			} else {
				$(this).next("p").children("a").focus();
			}
		}
		if (e.which == 27) {
			hideBookmarks();
			$('#bookmarksToggle').focus();
		}
	});
	modal_InfoWindow_Init();
}

function GetQueryParameters() {
    var queryString = {};
    var temp = esri.urlToObject(document.location.href).query;
    if (temp) {
        $.each(temp, function (index, value) {
            if (value) {
                queryString[index.toLowerCase()] = value;
            } else {
                // A parameter with no value is treated as a boolean toggle being turned on.
                queryString[index.toLowerCase()] = true;
            }
        });
    }
    return cleanQueryParameters(queryString);
}

function cleanQueryParameters(queryParameters) {
    // This function will morph old parameter names to the config names coded in the app.
    var old_new_name_map = {
        // newname : [list of old names],
        webmap: ['webmap_id']
    };
    $.each(old_new_name_map, function(key, value) {
        if (!queryParameters.hasOwnProperty(key)) {
            value.forEach(function (oldname) {
                if (queryParameters.hasOwnProperty(oldname)) {
                    queryParameters[key] = queryParameters[oldname];
                    delete queryParameters[oldname];
                }
            });
        }
    });

    // This function will transmogrify the query parameters object to create bools from strings
    // For booleans: existance of the query parameter with no value or any value except "false" implies true
    toggles = ['embed', 'details_panel', 'geolocator', 'show_facebook', 'show_twitter', 'show_bitly'];
    toggles.forEach(function(param){
        var value = queryParameters[param];
        if (typeof(value) == "string") {
            queryParameters[param] = $.trim((value)).toLowerCase() != "false"
        }
    });
    return queryParameters;
}

function getAppConfig(config, queryParameters) {
    // Async call to portal or AGOL to get the data from the app configuration item
    // The object returned is merged with the existing configuration object, overwriting
    // any hardcoded configuration parameters.  Then initialize the App.
    esri.request({
        url: config.default_sharing_url + "/" + config.appid + "/data",
        content: {f: "json"},
        callbackParamName: "callback"
    }).then(
        function(response) {
            if (response && response.values) {
                $.extend(config, response.values);
                initApp(config, queryParameters)
            }
        },
        function(error) {
            //TODO: Check for permission problem and then try logging in first
            console.log("Error retreiving app config: ", error.message);
            initApp(config, queryParameters)
        }
    );
}

function sanitizeConfig() {
    // checks for and cleans up invalid user input into the global config object
    //Pan Percent
    if (typeof(config.pan_percent) == "string") {
        config.pan_percent = Number(config.pan_percent);
    }
    if (!config.pan_percent || !typeof(config.pan_percent) == "number" || config.pan_percent <= 0) {
        config.pan_percent = 0.15;
    }
    if (config.pan_percent > 1) {
        config.pan_percent = config.pan_percent / 100.0;
    }
    // Bookmark Text
    if (!config.bookmarks_alias) {
        config.bookmarks_alias = "Zoom To";
    }
    // Color Order
    if (!config.color_order) {
        config.color_order = "green,red,blue,purple";
    }
    //TODO: remove any items that are not in ColorSchemes
}

/******************************************************
******************** event handlers *******************
*******************************************************/

function tile_onMouseOver(e) {
	 $(this).stop().animate({'background-color' : COLOR_FULL});
}

function tile_onMouseOut(e) {
	
	if (_selected != null) {
		var id = parseInt($(this).attr("id").substring(4));
		if (_selected.attributes.getValueCI(FIELDNAME_ID) == id) {
			return;
		}
	}
	
	$(this).stop().animate({'background-color' : COLOR_DIM});
}

function tile_onClick(e) {
	var id = parseInt($(this).attr("id").substring(4));	
	preSelection();
	_selected = $.grep(_layerCurrent.graphics,function(n,i){return n.attributes.getValueCI(FIELDNAME_ID) == id})[0];
	postSelection();
	$('#mobileTitlePage').css('display', 'none')
	hideBookmarks();
    _selectedTile = e.target
    $(".esriPopup .titleButton.close").focus();
}

function tile_keydown(e) {
	if (e.which == 37) {
		var tiles = $('ul#myList.tilelist li:visible');
		if (tiles.index(this) == 0)  {
			tiles.get(-1).focus();
		}
		else {
			tiles[tiles.index(this)-1].focus();
		}
	}
	if (e.which == 39) {
		var tiles = $('ul#myList.tilelist li:visible');
		if (tiles.index(this) == (tiles.size() - 1)) {
			tiles.get(0).focus();
		} else {
			tiles[tiles.index(this)+1].focus();
		}
	}
	if (e.which == 38) {
		var w1 = $('ul#myList.tilelist').width();
		var w2 = $('ul#myList.tilelist li:first-child').width();
		var tiles_per_row = Math.floor(w1/w2);
		var tiles = $('ul#myList.tilelist li:visible');
		var myIndex = tiles.index(this);
		var newIndex = myIndex - tiles_per_row;
		if (newIndex < 0) {
			var tilecount = tiles.size();
			var gridcount = tilecount + tiles_per_row - (tilecount % tiles_per_row);
			newIndex = gridcount + newIndex;
			if (tilecount <= newIndex) {
				newIndex = newIndex - tiles_per_row;
			}
		}
		tiles.get(newIndex).focus();
	}
	if (e.which == 40) {
		var w1 = $('ul#myList.tilelist').width();
		var w2 = $('ul#myList.tilelist li:first-child').width();
		var tiles_per_row = Math.floor(w1/w2);
		var tiles = $('ul#myList.tilelist li:visible');
		var myIndex = tiles.index(this);
		var newIndex = myIndex + tiles_per_row;
		var tilecount = tiles.size();
		if (tilecount <= newIndex) {
			newIndex = newIndex % tiles_per_row;
		}
		tiles[newIndex].focus();
	}
}

function baselayer_onMouseOver(event)
{
	if (_isMobile) return;	
	_map.setMapCursor("pointer");
	var graphic = event.graphic;
	$("#hoverInfo").html(graphic.attributes.getValueCI(FIELDNAME_TITLE));
	var pt = event.screenPoint;
	hoverInfoPos(pt.x,pt.y);
}

function baselayer_onMouseOut(event)
{
	if (_isMobile) return;	
	_map.setMapCursor("default");
	$("#hoverInfo").hide();
}

function baselayer_onClick(event) {
	buildPopup(event.graphic, event.mapPoint, "true");
	$("#hoverInfo").hide();	
	$('#mobileTitlePage').css('display', 'none')
}

function layer_onClick(event)
{
	preSelection();		
	_selected = event.graphic;
	postSelection();
	$('#mobileTitlePage').css('display', 'none')
}

function layer_onMouseOver(event)
{
	if (_isMobile) return;
	_map.setMapCursor("pointer");
	var graphic = event.graphic;
	if (graphic == _selected && headerIsVisible())
		return;
	else 
		if (graphic == _selected && headerIsHidden()) {
			$("#hoverInfo").html(graphic.attributes.getValueCI(FIELDNAME_TITLE));
			var pt = _map.toScreen(graphic.geometry);
			hoverInfoPos(pt.x, pt.y);
		}
		else {
			graphic.symbol.setWidth(_lutIconSpecs["medium"].getWidth())
			graphic.symbol.setHeight(_lutIconSpecs["medium"].getHeight())
			graphic.symbol.setOffset(_lutIconSpecs["medium"].getOffsetX(), _lutIconSpecs["medium"].getOffsetY());
			graphic.draw();
			
			if (!_isIE) 
				moveGraphicToFront(graphic);
			$("#hoverInfo").html(graphic.attributes.getValueCI(FIELDNAME_TITLE));
			var pt = _map.toScreen(graphic.geometry);
			hoverInfoPos(pt.x, pt.y);
		}
}

function layer_onMouseOut(event)
{
	if (_isMobile) return;	
	_map.setMapCursor("default");
	var graphic = event.graphic;	
	if (graphic != _selected) {
		graphic.symbol.setWidth(_lutIconSpecs["tiny"].getWidth())
		graphic.symbol.setHeight(_lutIconSpecs["tiny"].getHeight())
		graphic.symbol.setOffset(_lutIconSpecs["tiny"].getOffsetX(), _lutIconSpecs["tiny"].getOffsetY());
		graphic.draw();
	}
	$("#hoverInfo").hide();
}

/******************************************************
 ****************** Modal Info Window *****************
 ******************************************************/

 // based on http://www.smashingmagazine.com/2014/09/15/making-modal-windows-better-for-everyone/

var _lastFocus;
var _infoWindowCloseButton;
var _infowWindowDom;
var _showingDetails;

function infoWindow_onShow(event) {
	_lastFocus = document.activeElement;
	_infoWindowCloseButton.setAttribute('tabindex', '0');
	_infoWindowCloseButton.focus();
}

function infoWindow_onHide(event) {
	_modalOpen = false;
	_lastFocus.focus(); // place focus on the saved element
}

function focusRestrict ( event ) {
	document.addEventListener('focus', function( event ) {
		if (_map.infoWindow.isShowing &&
			!_infowWindowDom.contains( event.target) &&
			!_showingDetails) {
			event.stopPropagation();
			_infoWindowCloseButton.focus();
		}
	}, true);
}

function infoWindow_Close() {
	_map.infoWindow.hide();
}

function modalClose ( e ) {
	if ( !e.keyCode || e.keyCode === 27 ) {
		if (_map.infoWindow.isShowing && !_showingDetails) {
			infoWindow_Close()
		}
	}
}

function modal_InfoWindow_Init() {
	dojo.connect(_map.infoWindow,"onHide",infoWindow_onHide);
	dojo.connect(_map.infoWindow,"onShow",infoWindow_onShow);
	_infoWindowCloseButton = $(".esriPopup .titleButton.close")[0]
	_infowWindowDom = _map.infoWindow.domNode;
	document.addEventListener('keydown', modalClose);
	focusRestrict();
}

/******************************************************
****************** other functions ********************
*******************************************************/

//neutral way of getting featureSet
function getFeatureSet(layer)
{
	return layer.url ? layer.featureCollection.featureSet : layer.featureCollection.layers[0].featureSet;
}

//neutral way of getting layer ID
function getID(layer)
{
	return layer.url ? layer.id : layer.featureCollection.layers[0].id;
}

function unselect() {
	preSelection();		
	_selected = null;
	postSelection();
}

function SortByNumber(a, b){
  var aNumber = a.attributes.getValueCI(FIELDNAME_NUMBER);
  var bNumber = b.attributes.getValueCI(FIELDNAME_NUMBER); 
  return ((aNumber < bNumber) ? -1 : ((aNumber > bNumber) ? 1 : 0));
}

function fixheader(unitcode) {
    if (unitcode.toUpperCase() in units) {
        var url = config.uniturl || "http://www.nps.gov/" + unitcode;
        var html = '<a href="'+ url + '" target=blank>' + units[unitcode].name +'</a>';
        $("#parkShortName").html(html);
        $("#unitType").html(units[unitcode].type);
        $("#parkLocation").html(units[unitcode].state);
    } else {
        var headerparts = unitcode.split("|");
        var html2 = config.uniturl ? '<a href="'+ config.uniturl + '" target=blank>' + headerparts[0] +'</a>' : headerparts[0]
        $("#parkShortName").html(html2);
        if (headerparts.length > 1) {
            $("#unitType").html(headerparts[1]);
        }
        if (headerparts.length > 2) {
            $("#parkLocation").html(headerparts[2]);
        }
    }
}

function setupSocialMediaIcons() {
    if (!config.show_facebook) $('.share_facebook').hide()
    if (!config.show_twitter) $('.share_twitter').hide()
    if (!config.show_bitly) $('.share_bitly').hide()
}

function loadBookmarks() {
	
	$.each(_bookmarks,function(index,value){
			$("#bookmarksDiv").append("<p><a tabindex='0'>"+value.name+"</a></p>");
			$("#mobileBookmarksDiv").append("<p><a tabindex='0'>"+value.name+"</a></p>");
	});
	
	$("#bookmarksDiv a").click(function(e) {
		var name = $(this).html();
		var extent = new esri.geometry.Extent($.grep(_bookmarks,function(n,i){return n.name == name})[0].extent);
		_map.setExtent(extent);	
		$("#bookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
		$("#bookmarksDiv").slideToggle();
        $("#bookmarksToggle").focus();
    });
	
	$("#mobileBookmarksDiv a").click(function(e) {
		var name = $(this).html();
		var extent = new esri.geometry.Extent($.grep(_bookmarks,function(n,i){return n.name == name})[0].extent);
		_map.setExtent(extent);	
		$("#mobileBookmarksTogText").html(config.bookmarks_alias+' &#x25BC;');
		$("#mobileBookmarksDiv").slideToggle();
    });

}

function hideBookmarks(){
	if ($("#mobileBookmarksDiv").css('display') === 'block') {
		$("#mobileBookmarksDiv").slideToggle()
		$("#mobileBookmarksTogText").html(config.bookmarks_alias + ' &#x25BC;')
	}
	if ($("#bookmarksDiv").css('display') === 'block') {
		$("#bookmarksDiv").slideToggle()
		$("#bookmarksTogText").html(config.bookmarks_alias + ' &#x25BC;')
	}
	else 
		return
}

function activateLayer(layer) {
	preSelection();	
	_selected = null;
	postSelection();
	_layerCurrent = layer;

	var tab = $.grep($(".tab"), function(n,i){return $(n).text() == _layerCurrent.title})[0];
	$(".tab").removeClass("tab-selected");
	$(tab).addClass("tab-selected");
	var themeIndex = $('.tab-selected').index();
	
	
	if (themeIndex == 0 && _mobileThemeSwiper.slides.length > 1) {
		$('#navThemeLeft').css('display', 'none');
		$('#navThemeRight').css('display', 'block');
	}
	else 
		if (themeIndex == (_mobileThemeSwiper.slides.length - 1)) {
			$('#navThemeRight').css('display', 'none');
			$('#navThemeLeft').css('display', 'block');
		}
	else {
		$('#navThemeLeft').css('display', 'block');
		$('#navThemeRight').css('display', 'block');
	}
	
	if(_mobileThemeSwiper.slides.length == 0){
		$('#navThemeLeft').css('display', 'none');
		$('#navThemeRight').css('display', 'none');
	}

	if (_firstLoad) {
		_mobileThemeSwiper.swipeTo(themeIndex, 300, false);
	}
	else {
		_mobileThemeSwiper.swipeTo(themeIndex);
		$('#mobileTitlePage').css('display', 'none')
		
	}
	_firstLoad = false;
	

	$.each(_contentLayers,function(index,value){
		value.setVisibility(value == _layerCurrent);
	});

	$("#myList").empty();
	$('#mobileList').empty();
	
	var display;
	var tile;
	var img;
	var mobileImg;
	var footer;
	var num;
	var title;
	var mobileTile;
	var visibleFeatures = false;

	$.each(_layerCurrent.graphics,function(index,value){
		if (_map.extent.contains(value.geometry)) {
			display = "visible"
			visibleFeatures = true;
		} else {
			display = "none";
		}
		tile = $('<li tabindex="0" id="item'+value.attributes.getValueCI(FIELDNAME_ID)+'" style="display:'+display+'">');
		img = $('<img src="'+value.attributes.getValueCI(FIELDNAME_IMAGEURL)+'" alt="'+value.attributes.getValueCI(FIELDNAME_TITLE)+'">');
		mobileImg = $('<div style="height: 75px; margin-bottom: 8px;"><img src="'+value.attributes.getValueCI(FIELDNAME_IMAGEURL)+'"></div>');
		footer = $('<div class="footer"></div>');
		num = $('<div class="num" style="background-color:'+_layerCurrent.color+'">'+value.attributes.getValueCI(FIELDNAME_NUMBER)+'</div>');
		title = $('<div class="blurb">'+value.attributes.getValueCI(FIELDNAME_TITLE)+'</div>');
		$(footer).append(num);
		$(footer).append(title);
		$(tile).append(footer);
		mobileTile = $(tile).clone();
		$(tile).append(img);
		$(mobileTile).append(mobileImg);
		$("#myList").append(tile);
		$('#mobileList').append(mobileTile);
	});
	
	// event handlers have to be re-assigned every time you load the list...
	$("ul.tilelist li").mouseover(tile_onMouseOver);
	$("ul.tilelist li").mouseout(tile_onMouseOut);
	$("ul.tilelist li").click(tile_onClick);
	$("ul.tilelist li").keydown(tile_keydown);
    $("#mobilePaneList ul.mobileTileList li").click(tile_onClick);

	$("ul.tilelist").animate({ scrollTop: 0 }, { duration: 200 } ); //Does this work?
	$('#mobilePaneList').scrollTop(0)
	if(!visibleFeatures)
		$('.noFeature').css('display', 'block')
	else
		$('.noFeature').css('display', 'none')
}

function refreshList() {
	var tile;
	var mobileTile;
	var visibleFeatures = false;
	$.each(_layerCurrent.graphics,function(index,value){
		//find the corresponding tile
		tile = findTile(value.attributes.getValueCI(FIELDNAME_ID));
		mobileTile = findMobileTile(value.attributes.getValueCI(FIELDNAME_ID));
		if (_map.extent.contains(value.geometry)) {
			if ($(tile).css("display") == "none") $(tile).stop().fadeIn();
			if ($(mobileTile).css("display") == "none") $(mobileTile).css("display", "block") ;
			visibleFeatures = true;
		} else {
			if ($(tile).css("display") != "none") $(tile).stop().fadeOut(1000);
			if ($(mobileTile).css("display") != "none") $(mobileTile).css("display", "none");
		}		
	});
	
	$('#mobilePaneList').scrollTop(0)

	if(!visibleFeatures)
		$('.noFeature').css('display', 'block')
	else
		$('.noFeature').css('display', 'none')
}

function buildLayer(arr,iconDir,root) {
	var layer = new esri.layers.GraphicsLayer();
	var pt;
	var sym;
	var spec = _lutIconSpecs["tiny"];
	$.each(arr,function(index,value){
		pt = new esri.geometry.Point(value.geometry.x,value.geometry.y,value.geometry.spatialReference);
		sym = createPictureMarkerSymbol("images/icons/"+iconDir+"/"+root+value.attributes.getValueCI(FIELDNAME_NUMBER)+".png", _lutIconSpecs["tiny"]);
		layer.add(new esri.Graphic(pt,sym,value.attributes));
	});
	return layer;
}

function enterTileGroup(layer) {
    //move keyboard focus into a group of tiles
	activateLayer(layer);
	hideBookmarks();
	$("ul#myList.tilelist li:visible")[0].focus();
}

function leaveTileGroup() {
    //move the keyboard focus out of a group of tile and back to the tab
    $("#tabs .tab-selected").focus();
 }

function getValueCI(field) {
	
	// this function provides a uniform method for reading an 
	// attribute property.  it performs two duties:
	
	// 1) case insensitive access
	
	var found;
	var value;
	$.each(this,function(index,value){
		if (index.toUpperCase() == field.toUpperCase()) {
			found = index;
			return false;
		}
	});
	value = this[found];
	
	// NOTE:  once we adopt ECMAScript 5, ALL of the above can
	// be accomplished with this one line:
	// var value = this[$.grep(Object.keys(this), function(n, i) {return n.toLowerCase() == field.toLowerCase()})[0]];
	
	// 2) treat any blank entries as null
	
	if ($.trim(value).length == 0) value = null;
	
	return value;
		
}

function handleWindowResize() {
    //Coordinate these magic numbers with responsive.css
    var layout = $("body").width() > 768 ? 'normal' : 'responsive';

	if(!_firstLoad && layout == 'normal')
		$('#mobileTitlePage').css('display', 'none')
	if (layout == 'normal') {
		if(_layout == 'responsive'){
			preSelection();
			infoWindow_Close();
			_selected = null;
		}
        if (config.embed) {
            $("#banner").hide();
        } else {
            $("#banner").show();
        }

        var headerspace = headerIsVisible() ? $("#banner").height() : 0;
        $("#mainWindow").height($("body").height() - headerspace);

		if (_bookmarks) {
			$("#tabs").width($("body").width() - ($("#bookmarksCon").width() + parseInt($("#tabs").css("padding-left"))));
		}
		else {
			$("#tabs").width($("body").width());
		}
		
		$("#paneLeft").height($("#mainWindow").height() - $('#divStrip').height());
		
		if($("body").width() <= TWO_COLUMN_THRESHOLD || ($("body").width() <= 1024 && $("body").height() <= 768))
			$("#paneLeft").width(LEFT_PANE_WIDTH_TWO_COLUMN)
		else
			$("#paneLeft").width(LEFT_PANE_WIDTH_THREE_COLUMN)
		
		$(".tilelist").height($("#paneLeft").height() - 18);
		$(".tilelist").width($("#paneLeft").width() + 7);
		$("#paneLeft .noFeature").width($('#paneLeft').width())
		$("#paneLeft").width() == LEFT_PANE_WIDTH_TWO_COLUMN ? $('#paneLeft .noFeatureText').css('margin-left', '50px') : $('#paneLeft .noFeatureText').css('margin-left', '150px');
		
		$("#map").css("left", $("#paneLeft").outerWidth());
		//$("#map").height($("#mainWindow").height() - 35);
		$("#map").height($("#mainWindow").height() - $('#divStrip').height());
		$("#map").css('top',$('#divStrip').height());
		$("#map").width($("#mainWindow").width() - $("#paneLeft").outerWidth());

		/*
		//Adjust width of header elements
        var widthViewport = $('body').width();
		$('#banner').width(widthViewport);
		var rightAreaWidth = Math.max($("#banner .headerLogoImg").outerWidth() + 50, $(" #banner .rightArea").outerWidth() + 20);
		$("#banner .textArea").width(widthViewport - rightAreaWidth - 15);
		*/
	}
	else{ // layout == 'responsive'
		resizeMobileElements();
		if(_layout == 'normal'){
			preSelection();
			_selected = null;
			showMobileList();
			postSelection();
		}
        $("#banner").hide();
		//$("#mobileList").width($("body").width());
		if(!_firstLoad)
			_mobileThemeSwiper.reInit();
	}

    _layout = layout;  //save the layout for next call of handleWindowResize() and for buildPopup()
	if (_map) _map.resize();
}

function preSelection() 
{
	// return the soon-to-be formerly selected graphic icon to normal
	// size & dim the corresponding tile.
	
	if (_selected) {
		_selected.symbol.setWidth(_lutIconSpecs["tiny"].getWidth())
		_selected.symbol.setHeight(_lutIconSpecs["tiny"].getHeight())
		_selected.symbol.setOffset(_lutIconSpecs["tiny"].getOffsetX(), _lutIconSpecs["tiny"].getOffsetY());
		_selected.draw();
		var tile = findTile(_selected.attributes.getValueCI(FIELDNAME_ID));
		if ($(tile).attr("id") != $(this).attr("id")) $(tile).stop().animate({'background-color' : COLOR_DIM});
        if (_selectedLayer) {
            _selectedLayer.setVisibility(false);
            _selectedLayer = null;
        }
	}
		
}

function postSelection(skipPopup) {
	
	if (_selected == null) {
		infoWindow_Close();
	} else {
		
		// make the selected location's icon LARGE
		_selected.symbol.setWidth(_lutIconSpecs["large"].getWidth())
		_selected.symbol.setHeight(_lutIconSpecs["large"].getHeight())
		_selected.symbol.setOffset(_lutIconSpecs["large"].getOffsetX(), _lutIconSpecs["large"].getOffsetY());
		_selected.draw();
		
		// calling moveToFront directly after messing
		// with the symbol causes problems, so I
		// put it on a delay and put it in a try/catch
		// just to be safe...
		setTimeout(function(){
			try {
				_selected.getDojoShape().moveToFront();
			} catch (err) {
				console.log("problem with 'moveToFront()'...");
			}
		},10);				
		
		if(!skipPopup)
			buildPopup(_selected, _selected.geometry);
		
		// light up the corresponding tile.

		var tile = findTile(_selected.attributes.getValueCI(FIELDNAME_ID));
		$(tile).stop().animate({'background-color' : COLOR_FULL});
        var layer = findLayer(_selected.attributes.getValueCI(FIELDNAME_LAYER));
        if (layer) {
            _selectedLayer = layer;
            layer.setVisibility(true);
        }
	}

	$("#hoverInfo").hide();
	
}

function headerIsVisible() {
	return !headerIsHidden();
}

function headerIsHidden() {
	return $('#banner').css('display') == 'none';
}

function buildPopup(feature, geometry, baseLayerClick)
{
	$('#mobileSupportedLayersView').html('');
	$('#mobileThemeBar .swiper-container').css('display', 'none');
	$('#navThemeLeft').css('visibility', 'hidden');
	$('#navThemeRight').css('visibility', 'hidden');
	var atts = feature.attributes;
	
	var mobile = _layout == 'responsive';
	
	if (!baseLayerClick && mobile) {
		buildMobileSlideView()
		return
	}

	var title =  atts.getValueCI(FIELDNAME_TITLE);	
	var shortDesc = atts.getValueCI(FIELDNAME_SHORTDESC);
	var picture = atts.getValueCI(FIELDNAME_IMAGEURL);
	var credits = atts.getValueCI(FIELDNAME_CREDITS);
    var bigpicture = atts.getValueCI(FIELDNAME_FULLSIZEURL);
	var website = atts.getValueCI(FIELDNAME_WEBSITE);
	var longtitle = title + " (" + credits +")";
	if (website) website = prependURLHTTP($.trim(website));

	var contentDiv = $("<div></div>");
	if (baseLayerClick && mobile)
			$('#mobileSupportedLayersView').append($("<div style='padding-left: 20px;' class='mobileFeatureTitle'></div>").html(title));
	if (shortDesc) {
		$(contentDiv).append($("<div></div>").html(shortDesc));
		if (baseLayerClick && mobile) {
			$('#mobileSupportedLayersView').append($('<hr style="margin-left: 20px; margin-right: 20px;">'));
			$('#mobileSupportedLayersView').append($("<div class='mobileFeatureSubtitle'></div>").html(shortDesc));
		}
	}
	if (picture) {
		var pDiv = $("<div></div>").addClass("infoWindowPictureDiv");
		var mobilePDiv = $("<div></div>").addClass("mobilePictureDiv");
		if (config.details_panel && !mobile) {
			$(pDiv).append($(new Image()).attr("src", picture));
			$(pDiv).css("cursor", "pointer");
		}
		else if (config.details_panel && mobile) {
			if (website) {
				var mobileA = $("<a></a>").attr("href", website).attr("target","_blank").attr("tabindex","-1");
				$(mobileA).append($(new Image()).attr("src", picture));
				$(mobilePDiv).append(mobileA);
			} else {
				$(mobilePDiv).append($(new Image()).attr("src", picture));
			}
		} else { // no details panel
            var a = $("<a></a>");
            if (website) {
                $(a).attr("href", website).attr("target", "_blank");
                var mobileA = $("<a></a>").attr("href", website).attr("target", "_blank");
            }
            if (bigpicture) {
				if (!credits)
                	$(a).attr('href', bigpicture).removeAttr('target').addClass('bigpicture').attr('title',title);
				else
					$(a).attr('href', bigpicture).removeAttr('target').addClass('bigpicture').attr('title',longtitle);
            }
            if (bigpicture || website) {
				$(a).append($(new Image()).attr("src", picture));
				$(mobileA).append($(new Image()).attr("src", picture));
				$(pDiv).append(a);
				$(mobilePDiv).append(mobileA);
			} else {
				$(pDiv).append($(new Image()).attr("src", picture));
				$(mobilePDiv).append($(new Image()).attr("src", picture));
			}
		}
		$(contentDiv).append(pDiv);
		if(baseLayerClick && mobile)
			$('#mobileSupportedLayersView').append(mobilePDiv);
	}
	
	if (!picture) {
		$(contentDiv).append("<br>");
		if(baseLayerClick && mobile)
			$('#mobileSupportedLayersView').append("<br>");
	}

	if (credits) {
		$(contentDiv).append($("<div class='infoWindowCredits'></div>").html("Photo: " + credits));
		if(baseLayerClick)
			$('#mobileSupportedLayersView').append($("<div class='mobileFeatureCredits'></div>").html("Photo: " + credits));				
	}
	
	if (!config.details_panel) {
		if(!shortDesc)
			$('.mobileFeatureTitle').after($('<hr style="margin-left: 20px; margin-right: 20px;">'));

		var desc1 = atts.getValueCI(FIELDNAME_DESC1);
		if (desc1) {
			$(contentDiv).append($("<div class='infoWindowDesc'></div>").html(desc1));
			if(baseLayerClick)
				$('#mobileSupportedLayersView').append($("<div class='mobileFeatureDesc'></div>").html(desc1));
		}
		
		if (website) {
			$(contentDiv).append($('<div class="address"><a href="'+website+'" target="_blank">Website</a></div>').css("padding-top", 10));
			if(baseLayerClick && mobile)
				$('#mobileSupportedLayersView').append($('<div class="mobileFeatureAddress"><a href="'+website+'" target="_blank">Website</a></div>').css("padding-top", 10));
		}
		
	}
	else if (config.details_panel && mobile){
		$(contentDiv).prepend($('<div style="margin-left: -50px" class="mobileFeatureTitle">'+title+'</div>'));
		if(!shortDesc)
			$('.mobileFeatureTitle').after($('<hr style="margin-left: 20px; margin-right: 20px;">'));

		var descFields = [FIELDNAME_DESC1, FIELDNAME_DESC2, FIELDNAME_DESC3, FIELDNAME_DESC4, FIELDNAME_DESC5];
		var value;
		$.each(descFields, function(index, field){
			value = atts.getValueCI(field);
			if (value) {
				$(contentDiv).append('<div class="mobileFeatureDesc">'+value+'</div>');
				if ($(contentDiv).children().length > 0 && index < descFields.length -1){
					$(contentDiv).append('<p>');
				} 
				if(baseLayerClick && mobile){
					$('#mobileSupportedLayersView').append('<div class="mobileFeatureDesc">'+value+'</div>');
				}
				if(descFields.length > 1/* && index*/)
					$('#mobileSupportedLayersView').append('<p>')
			}
		});
		$(contentDiv).append($('<hr style="margin-left: 20px; margin-right: 20px;">'));
		if(baseLayerClick && mobile){
			$('#mobileSupportedLayersView').append($('<hr style="margin-left: 20px; margin-right: 20px;">'));
		}
		var address = atts.getValueCI(FIELDNAME_ADDRESS);
		if (address) {
			$(contentDiv).append($('<div class="mobileFeatureAddress">'+address+'</div>')); 
			if(baseLayerClick && mobile){
				$('#mobileSupportedLayersView').append($('<div class="mobileFeatureAddress">'+address+'</div>')); 
			}
		}
	
		var hours = atts.getValueCI(FIELDNAME_HOURS);
		if (hours) {
			$(contentDiv).append($('<div class="mobileFeatureAddress">'+hours+'</div>')); 
			if(baseLayerClick && mobile){
				$('#mobileSupportedLayersView').append($('<div class="mobileFeatureAddress">'+hours+'</div>')); 
			}
		}
	  
		if (website) {
			$(contentDiv).append('<div class="mobileFeatureAddress"><a href="'+website+'" target="_blank">Website</a></div>');
			if(baseLayerClick && mobile){
				$('#mobileSupportedLayersView').append('<div class="mobileFeatureAddress"><a href="'+website+'" target="_blank">Website</a></div>');
			}
		}
		$(contentDiv).append('<div style="margin-bottom: 20px;"></div>');
		if(baseLayerClick && mobile){
			$('#mobileSupportedLayersView').append('<div style="margin-bottom: 20px;"></div>');
		}
	} else {
		$(contentDiv).append($("<div></div>").addClass("infoWindowLink").attr("tabindex","0").html("Details >>"));
	}

	// note: what we really want is the entire contentDiv html in
	//       this popup.  since contentDiv.html() only gives us the
	//       inner html for the div, i am re-adding the wrapper div.
	//       there's got to be a more elegant way to do this, but it
	//       eludes me at the moment. 
	_map.infoWindow.setContent("<div>"+contentDiv.html()+"</div>");
	_map.infoWindow.setTitle(title);
	_map.infoWindow.show(geometry);
	
	//else{
		$('#mobilePaneList').css('visibility', 'hidden');
		$('#mobileFeature').css('visibility', 'hidden')
		$('#returnIcon').css('display', 'block');
		$('#returnHiddenBar').css('display', 'block');
		$('#centerMapIconContainer').css('display', 'none');
		$('#mobileSupportedLayersView').css('visibility', 'visible');
		preSelection();
	//}
	
	$(".esriPopup .contentPane").scrollTop(0);	
	$(".infoWindowLink").click(function(e) {
        showDetails(feature);
    });
	
	if (config.details_panel && headerIsVisible()) {
		$(".infoWindowPictureDiv").click(function(e) {
			showDetails(feature);
		});	
	}

    //Add colorbox to bigpicture class
    $('a.bigpicture').colorbox({
        maxHeight:'95%',
        maxWidth:'95%'
    });
}

/*
 * Builds swipe-able slides that display feature information
 */
function buildMobileSlideView(featureNumber){
	_mobileFeatureSwiper.removeAllSlides();
	var themeIndex = $('.tab-selected').index();
	if(themeIndex<0)
		themeIndex = 0;
	var currentTheme = _contentLayers[themeIndex];
	var features = currentTheme.graphics;
	
	$.each(features, function(index, feature){
		if(!_map.extent.contains(feature.geometry))
			return
		var atts = feature.attributes;

		var title =  atts.getValueCI(FIELDNAME_TITLE);
		
		var shortDesc = atts.getValueCI(FIELDNAME_SHORTDESC);
		var picture = atts.getValueCI(FIELDNAME_IMAGEURL);
		var credits = atts.getValueCI(FIELDNAME_CREDITS);
		var website = atts.getValueCI(FIELDNAME_WEBSITE);
		if (website) website = prependURLHTTP($.trim(website));		

		var num = $('<div class="mobileFeatureNum" style="background-color:'+_layerCurrent.color+'">'+ atts.getValueCI(FIELDNAME_NUMBER)+'</div>');
	
		var mobileContentDiv = $("<div'></div");
		$(mobileContentDiv).append(num);
		if(title){
			$(mobileContentDiv).append($("<div class='mobileFeatureTitle'></div>").html(title));
		}
		$(mobileContentDiv).append("<hr style='margin-left: 20px; margin-right: 20px;'>")

		if (shortDesc) {
			$(mobileContentDiv).append($("<div class='mobileFeatureSubtitle'></div>").html(shortDesc));
		}
		if (picture) {
			var mobilePDiv = $("<div></div>").addClass("mobilePictureDiv");
			if (website) {
				var mobileA = $("<a></a>").attr("href", website).attr("target","_blank");
				$(mobileA).append($(new Image()).attr("src", picture));
				$(mobilePDiv).append(mobileA);
			} else {
				$(mobilePDiv).append($(new Image()).attr("src", picture));
			}
			
			$(mobileContentDiv).append(mobilePDiv);
		}
		
		if (credits) {
			$(mobileContentDiv).append($("<div class='mobileFeatureCredits'></div>").html("Photo: " + credits));			
		}
		
		if (!config.details_panel) {
			var desc1 = atts.getValueCI(FIELDNAME_DESC1);
			if (desc1) {
				$(mobileContentDiv).append($("<div class='mobileFeatureDesc'></div>").html(desc1));
			}
			
			if (website) {
				$(mobileContentDiv).append($('<div class="mobileFeatureDesc"><a href="'+website+'" target="_blank">Website</a></div>').css("padding-top", 10));
			}
			
		} else {
			var descFields = [FIELDNAME_DESC1, FIELDNAME_DESC2, FIELDNAME_DESC3, FIELDNAME_DESC4, FIELDNAME_DESC5];
			var value;
			$.each(descFields, function(index, field){
				value = atts.getValueCI(field);
				if (value) {
					$(mobileContentDiv).append('<div class="mobileFeatureDesc">'+value+'</div>');
					if ($(mobileContentDiv).children().length > 0){
						$(mobileContentDiv).append('<br>');
					} 
				}
			});
			$(mobileContentDiv).append("<hr style='margin-left: 20px; margin-right: 20px;'>")
			var address = atts.getValueCI(FIELDNAME_ADDRESS);
			if (address) {
				$(mobileContentDiv).append($('<div class="mobileFeatureAddress">'+address+'</div>')); 
			}
		
			var hours = atts.getValueCI(FIELDNAME_HOURS);
			if (hours) {
				$(mobileContentDiv).append($('<div class="mobileFeatureAddress">'+hours+'</div>')); 
			}
		  
			if (website) {
				$(mobileContentDiv).append('<div class="mobileFeatureAddress"><a href="'+website+'" target="_blank">Website</a></div>');
			}
			$(mobileContentDiv).append('<div style="margin-bottom: 20px;"></div>');
		}
	
		var featureSlide = _mobileFeatureSwiper.createSlide(mobileContentDiv.html());
		$(featureSlide).attr('data-number', atts.getValueCI(FIELDNAME_NUMBER));
		$(featureSlide).css('overflowY', 'auto'); 
		featureSlide.append() 
	});
	
	 var selectedSlideIndex = null;

	 $.each(_mobileFeatureSwiper.slides, function(index, slide){
		 if (parseInt($(slide).data('number')) == _selected.attributes.getValueCI(FIELDNAME_NUMBER)) 
		 	selectedSlideIndex = index;
	 })
	 _mobileFeatureSwiper.swipeTo(selectedSlideIndex);
	 $('.swiper-slide-active').scrollTop(0)
	 $('#mobileFeature').css('visibility', 'visible');
	 $('#returnIcon').css('display', 'block');
	 $('#returnHiddenBar').css('display', 'block');
	 $('#centerMapIconContainer').css('display', 'block');
}

function showDetails(graphic) {
	
	var mainDiv = $('<div class="details"></div>');
	var titleDiv = $('<div class="title">'+graphic.attributes.getValueCI(FIELDNAME_TITLE)+'</div>');
	var leftDiv = $('<div class="leftDiv"></div>');
	var rightDiv = $('<div class="rightDiv"></div>');
  
	var imageDiv = $('<img src="'+graphic.attributes.getValueCI(FIELDNAME_IMAGEURL)+'" alt="'+graphic.attributes.getValueCI(FIELDNAME_TITLE)+'">');
	var pictureFrame = $('<div class="pictureFrame"></div>');	
	$(pictureFrame).append(imageDiv);
	$(leftDiv).append(pictureFrame);
  
	var address = graphic.attributes.getValueCI(FIELDNAME_ADDRESS);
	if (address) {
		$(leftDiv).append($('<div class="address">'+address+'</div>')); 
	}

	var hours = graphic.attributes.getValueCI(FIELDNAME_HOURS);
	if (hours) {
		$(leftDiv).append($('<div class="address">'+hours+'</div>')); 
	}
  
	var website = graphic.attributes.getValueCI(FIELDNAME_WEBSITE);
	if (website) {
		website = prependURLHTTP($.trim(website));
		$(leftDiv).append('<div class="address"><a href="'+website+'" target="_blank">Website</a></div>');
	}
	
	var descFields = [FIELDNAME_DESC1, FIELDNAME_DESC2, FIELDNAME_DESC3, FIELDNAME_DESC4, FIELDNAME_DESC5];
	var value;
	$.each(descFields, function(index, field){
		value = graphic.attributes.getValueCI(field);
		if (value) {
			$(rightDiv).append('<div class="desc">'+value+'</div>');
			if ($(rightDiv).children().length > 0 && index < descFields.length -1){
				$(rightDiv).append('<p>');
			} 
		}
	});

	$(mainDiv).append(titleDiv);
	$(mainDiv).append("<hr>"); 
	$(mainDiv).append(leftDiv);
	$(mainDiv).append(rightDiv);
  
	if ($(mainDiv).find(".desc").length > 0) {
		var lastDesc = $(mainDiv).find(".desc")[$(mainDiv).find(".desc").length - 1];
		$(lastDesc).css("margin-bottom","5px");
	}

    var activeElement = $(document.activeElement);
	_showingDetails = true;
	$.colorbox({
		html:mainDiv,
		open:true,
		maxHeight:$(document).height() - 100,
		maxWidth:"575px",
		scrolling:false,
        onClosed:function(){_showingDetails = false; activeElement.focus()}
	});
	
	$('.rightDiv').find('p').last().css('display', 'none');
}

function findTile(id)
{
	return $.grep($("ul.tilelist li"),function(n,i){return n.id == "item"+id})[0];	
}

function findLayer(name)
{
    if (!name)
        return null;
    var layers = _map.getLayersVisibleAtScale(_map.getScale());
    var foundLayer = null
    layers.some(function(layer) {
        if (layer.name == name) {
            foundLayer = layer;
        }
        return layer.name == name
    });
    return foundLayer;
}

function findMobileTile(id)
{
	return $.grep($("ul.mobileTileList li"),function(n,i){return n.id == "item"+id})[0];	
}

function hoverInfoPos(x,y){
	if (x <= ($("#map").width())-230){
		$("#hoverInfo").css("left",x+15);
	}
	else{
		$("#hoverInfo").css("left",x-25-($("#hoverInfo").width()));
	}
	if (y >= ($("#hoverInfo").height())+50){
		$("#hoverInfo").css("top",y-35-($("#hoverInfo").height()));
	}
	else{
		$("#hoverInfo").css("top",y-15+($("#hoverInfo").height()));
	}
	$("#hoverInfo").show();
}

function moveGraphicToFront(graphic)
{
	var dojoShape = graphic.getDojoShape();
	if (dojoShape) dojoShape.moveToFront();
}

function createPictureMarkerSymbol(url, spec)
{
	return new esri.symbol.PictureMarkerSymbol(
			url,
			spec.getWidth(),
			spec.getHeight()
		).setOffset(
			spec.getOffsetX(),
			spec.getOffsetY()
		);
}

function resizePictureMarkerSymbol(sym, spec)
{
	return sym.setHeight(spec.getHeight()).setWidth(spec.getWidth()).setOffset(spec.getOffsetX(),spec.getOffsetY());
}

function swipeFeature(){
	preSelection();		
	var themeIndex = $('.tab-selected').index();
	if(themeIndex<0)
		themeIndex = 0;
	var currentTheme = _contentLayers[themeIndex];
	var features = currentTheme.graphics;
	var nextFeatureId = $(_mobileFeatureSwiper.activeSlide()).data('number')
	var feature = currentTheme.graphics.filter(function(feat){
		return feat.attributes.Number == nextFeatureId;
	});
	_selected = feature[0];
	$('.swiper-slide-active').scrollTop(0)
	postSelection(true);
}

function showMobileList(){
	$('#mobileFeature').css('visibility', 'hidden');
	$('#mobileSupportedLayersView').css('visibility', 'hidden');
	$('.swiper-container').css('display', 'block');
	$('#mobilePaneList').css('visibility', 'visible');
	$('#returnIcon').css('display', 'none');
	$('#returnHiddenBar').css('display', 'none');
	$('#centerMapIconContainer').css('display', 'none');
	$('#navThemeLeft').css('visibility', 'visible');
	$('#navThemeRight').css('visibility', 'visible');
	if (_selected) {
		_selected.symbol.setWidth(_lutIconSpecs["tiny"].getWidth())
		_selected.symbol.setHeight(_lutIconSpecs["tiny"].getHeight())
		_selected.symbol.setOffset(_lutIconSpecs["tiny"].getOffsetX(), _lutIconSpecs["tiny"].getOffsetY());
		_selected.draw();
	}
	if (_mobileThemeSwiper.activeIndex > 0 || _mobileThemeSwiper.activeIndex == -0) {
		_mobileThemeSwiper.reInit()
		_mobileThemeSwiper.swipeTo(_mobileThemeSwiper.activeIndex)
	}
}

function centerMapOnFeature(){
	_map.centerAt(_selected.geometry);
}

/*
 * Workaround for looping slides from iDanergous swipe component because of inconsistent
 * behavior when using 'loop' property of component and getting correct slide index.
 */
function loopFeatureSlides(direction){
	if(direction == 'left'){
		var slidesLength = _mobileFeatureSwiper.slides.length;
		_mobileFeatureSwiper.swipeTo(slidesLength-1, 50)
		swipeFeature()
	}
	if (direction == 'right') {
		_mobileFeatureSwiper.swipeTo(0, 50);
		swipeFeature();
	}
}

function selectMobileTheme(index){
	if(index != 0)
		activateLayer(_contentLayers[index]);
	$('#mobileTitlePage').css('display', 'none');
	$('#map').css('height', '100%').css('height', '48%').css('height', '-=20px');
	_map.resize()
}

function getDeviceLocation(){
	navigator.geolocation.getCurrentPosition(
		function(e){
			var geom = new esri.geometry.Point(e.coords.longitude, e.coords.latitude);
			var locationPoint = esri.geometry.geographicToWebMercator(geom);
			_map.centerAt(locationPoint);
			displayLocationPin(locationPoint);
		}
	);
	$('#mobileTitlePage').css('display', 'none')
}

function getDeviceLocationError(error){
	locationButtonCallback(false, error);
}

function displayLocationPin(point)
{
	_locateLayer.clear();
	_locateLayer.add(new esri.Graphic( point, _locateSymbol ));
	setTimeout(function(){
		$('#locateLayer_layer image').hide();
	}, 10000);
}

function shareFacebook()
{
	var options = '&p[title]=' + encodeURIComponent("National Park Service Short List Story Map")
					+ '&p[summary]=' + encodeURIComponent(config.caption)
					+ '&p[url]=' + encodeURIComponent(document.location.href)
					+ '&p[images][0]=' + encodeURIComponent($("meta[property='og:image']").attr("content"));
	
	window.open(
		'http://www.facebook.com/sharer/sharer.php?s=100' + options,
		'Facebook sharing', 
		'toolbar=0,status=0,width=626,height=436'
	);
}

function shareTwitter()
{
	var options = 'text=' + encodeURIComponent(config.caption)
					+ '&url=' + encodeURIComponent(document.location.href)
					+ '&related=EsriStoryMaps'
					+ '&hashtags=storymap'; 

	window.open(
		'https://twitter.com/intent/tweet?' + options, 
		'Tweet', 
		'toolbar=0,status=0,width=626,height=436'
	);
}

function requestBitly()
{
	var bitlyUrls = [
		"http://api.bitly.com/v3/shorten?callback=?", 
		"https://api-ssl.bitly.com/v3/shorten?callback=?"
	];
	var bitlyUrl = location.protocol == 'http:' ? bitlyUrls[0] : bitlyUrls[1];
	
	var urlParams = esri.urlToObject(document.location.href).query || {};
	var targetUrl = document.location.href;
	
	$.getJSON(
		bitlyUrl, 
		{ 
			"format": "json",
			"apiKey": "R_14fc9f92e48f7c78c21db32bd01f7014",
			"login": "esristorymaps",
			"longUrl": targetUrl
		},
		function(response)
		{
			var uri;
            if( ! response || ! response.data || ! response.data.url )
				uri = "Error";
            else
                uri = response.data.url
			
			$("#bitlyLoad").fadeOut();
			$("#bitlyInput").fadeIn();
			$("#bitlyInput").val(uri);
			$("#bitlyInput").select();
		}
	);
	$(".popover").show();
    $("#bitlyInput").blur(function(){$(".popover").hide()});
}

// Necessary as css calc() method does not work in older android 
function resizeMobileElements(){
	$('#mobilePaneList').css('height', '52%').css('height', '-=20px');
	$('#mobileFeature').css('height', '52%').css('height', '-=20px');
	$('#mobileSupportedLayersView').css('height', '52%').css('height', '-=20px');
	$('#mobileThemeBar').css('top', '48%').css('top', $('#mobileThemeBar').position().top -20 +'px');
	$('#returnHiddenBar').css('width', '100%').css('width', '-=80px');
	$('#mobilePaneList').css('height', '52%').css('height', '-=20px');
	$('.mobileTileList.blurb').css('width', '100%').css('width', '-=125px');
	if(headerIsHidden())
		$('#map').css('height', '48%').css('height', '-=20px');
}

function initError(errorTitle, errorMessage){
    $('#loader').hide();
    $("#fatalError .error-title").html(errorTitle);
    $("#fatalError .error-msg").html(errorMessage);
    $("#fatalError").show();
}

function prependURLHTTP(url)
{
	if ( ! url || url === "" || url.match(/^mailto:/) )
		return url;
	
	if ( ! /^(https?:\/\/)|^(\/\/)/i.test(url) )
		return 'http://' + url;
	
	return url;
}
