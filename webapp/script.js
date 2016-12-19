const BANNER_OFFSET = .005;
const ZOOM_SCALE_THRESHOLD = 5; //distinguishes small zoom from large zoom
const BASE_URL = "https://206neigh.azurewebsites.net"

var hasData = false;
var minified = true;
var map = null;
var prev_val = "";

$(document).ready(function(){
	map = new ol.Map({
		layers: [
		new ol.layer.Tile({
			source: new ol.source.OSM()
		})
		],
		target: 'map',
		view: new ol.View({
			center: ol.proj.transform([-122.3321, 47.65], 'EPSG:4326', 'EPSG:3857'),
			zoom: 12,
			minZoom: 12,
			maxZoom: 20
		})
	});


	$('#location').on('keypress', function (e) {
         if(e.which === 13){ //enter button pressed
         	var curr_val = $("#location").val();
         	if (curr_val != "" && curr_val != prev_val){
         		lookUpLocation(curr_val);
         	} else {
         		animateClose();
         	}
         	prev_val = curr_val;
         }
     });

	map.getView().on('change:resolution', function(evt){
		var prev = evt.oldValue;
		var ask = evt.target.U.resolution;
		if (ask > prev && ask > 2*ZOOM_SCALE_THRESHOLD){
			animateClose();
		} else if (prev > ZOOM_SCALE_THRESHOLD){
			var coord = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326');
			var lon = coord[0];
			var lat = coord[1];
			zoomInOnLoc(lat, lon);
			lookUpLocation(lat+","+lon);
		}
		
	});
	map.on("click", function(evt) {
		var coord = ol.proj.transform(evt.coordinate, 'EPSG:3857', 'EPSG:4326');
		var lon = coord[0];
		var lat = coord[1];
		zoomInOnLoc(lat, lon);
		lookUpLocation(lat+","+lon);
	});

});

function lookUpLocation(str){
	$.get(BASE_URL+"/basicInfo", {geo:str})
	.done(function( data ) {
		if (data && data != "Not found"){
			$("#info").animate({scrollTop:0}, "slow");
			hasData = true;
			$("#neigh").text(data["Neighborhood name"].toUpperCase());
			$("#basic").html(data["Description"]+" <a href="+data["Wiki"]+">More on Wikipedia.</a>");
			var coord = data["Coordinate approx"];
			var parts = coord.split(",");
			var zips = data["Zipcodes"];
			var zip = "";
			if (typeof zips == "string"){
				zip = zips.split(",")[0];
			} else {
				zip = zips;
			}

			zoomInOnLoc(Number(parts[0]), Number(parts[1]));
			animateOpen();
			$.get(BASE_URL+"/burglary", {"lat":parts[0], "lon":parts[1]})
			.done(function( data ) {
				if (data){
					$("#burglary").html("Burglary level: <strong>"+data+"</strong>");
				}
			});
			$.get(BASE_URL+"/crime", {"lat":parts[0], "lon":parts[1]})
			.done(function( data ) {
				if (data){
					var obj = JSON.parse(data);
					$("#crimeList").html("");
					var trueCount = 0;
					for (var i = 0; i < obj.length; i++){
						var curr = obj[i];
						var nameOfCrime = curr["event_clearance_description"];
						if (nameOfCrime.indexOf("HOMICIDE") != -1 || nameOfCrime.indexOf("ASSAULT") != -1 || nameOfCrime.indexOf("SHOOTING") != -1 
							|| nameOfCrime.indexOf("ROBBERY") != -1  || nameOfCrime.indexOf("FIREARM") != -1){ //non-exhaustive list of violent crimes
							var locOfCrime = curr["hundred_block_location"];
						$("#crimeList").append("<li><strong>"+nameOfCrime+"</strong> on "+locOfCrime+"</li>");
						trueCount++;
					}
				}
				$("#violent").html("Reported violent crimes in past week: <strong>"+trueCount+"</strong>");
			}
		});	
			$.get(BASE_URL+"/neighborhoodData", {"lat":parts[0], "lon":parts[1]})
			.done(function( data ) {
				if (data){
					var obj = JSON.parse(data);
					$("#poiList").html("");
					var cache = [];
					for (var i = 0; i < obj.length; i++){
						var curr = obj[i];
						var nameOfPOI = curr["common_name"].toUpperCase();
						var kindOfPOI = curr["city_feature"];
						var address = curr["address"];
						if (cache.indexOf(nameOfPOI) == -1 && cache.indexOf(address) == -1 && nameOfPOI && kindOfPOI && address){ //not seen before
							cache.push(nameOfPOI);
							cache.push(address);
							$("#poiList").append("<li><strong>"+nameOfPOI+"</strong>, "+kindOfPOI+", "+address+"</li>");
						}
					}
				}
			});	

			$.get(BASE_URL+"/schools", {"zipcode":zip})
			.done(function( data ) {
				if (data){
					$("#schoolList").html("");
					var obj = JSON.parse(data);
					var trueCount = 0;
					for (var i = 0 ; i < obj.length; i++){
						var curr = obj[i];
						var type = curr["type"];
						var name = curr["name"];
						if (type.indexOf("Closed") == -1){
							var listStr = "<li><strong>"+curr["school"].toUpperCase()+"</strong>, kind: "+curr["type"];
							if (curr["website"]){
								listStr = listStr+", more info: <a href=\""+curr["website"]+"\">website</a></li>"
							} else {
								listStr = listStr+"</li>"
							}
							$("#schoolList").append(listStr);
							trueCount++;
						}
					}
					$("#schools").html("Schools in the area: <strong>"+trueCount+"</strong>");
				}
			});	
		} else if (data == "Not found"){
			hasData = false;
		}
	});
}

function zoomInOnLoc(Lat, Lon){
	if (map){
		map.getView().setCenter(ol.proj.transform([Lon, Lat+BANNER_OFFSET], 'EPSG:4326', 'EPSG:3857'));
		map.getView().setZoom(15);
	}
}

function animateOpen(){
	if (minified && hasData){
		$('#data').animate({
			width: "100%",
		}, 400);
	} 
	minified = false;
}

function animateClose(){
	if (!minified){
		$('#data').animate({
			width: 400,
		}, 300);
		$("#location").val("");
		minified = true;
	}
}

