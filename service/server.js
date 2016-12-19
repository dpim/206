var http = require('http');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cors = require('cors')
var request = require('request');
var Converter = require("csvtojson").Converter;
var port = process.env.PORT || 3000;
var path = require('path');
app.use(express.static(path.join(__dirname, 'public')));


const SOCRATA_TOKEN = ""; //YOUR KEY HERE
const BURGLARY_API_ENDPOINT = "https://data.seattle.gov/resource/vdqe-y3ea.json";
const SCHOOLS_API_ENDPOINT = "https://data.seattle.gov/resource/eisw-qzx4.json";
const NEIGH_API_ENDPOINT = "https://data.seattle.gov/resource/3c4b-gdxv.json";
const POLICE_API_ENDPOINT = "https://data.seattle.gov/resource/pu5n-trf4.json";

app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(bodyParser.json());
app.use(cors());


var neighs = null;
var neighMapping = {};
var coordMapping = {};
var converter = new Converter({});
var finished = false;


app.get('/basicInfo', function (req, res) {
	var str = req.param("geo");
	res.send(convertFromStr(str));
});

app.get('/burglary', function(req, res){
	lat = req.param("lat");
	lon = req.param("lon");
	var props = {"$where": "within_circle(incident_location,"+lat+","+lon+",1000)", "$$app_token":SOCRATA_TOKEN};
	request({url:BURGLARY_API_ENDPOINT, qs:props}, function(err, response, body) {
		if(err) { 
			console.log(err); return; 
		} else {
			var obj = JSON.parse(body);
			var count = obj.length+1;
			var resp = "Very high";
			if (count < 10){
				if (count < 5){
					if (count < 2){
						resp = "Low";
					} else {
						resp = "Medium";
					}
				} else {
					resp = "High";
				}
			} 
			res.send(resp);
		}
	});
});

app.get('/crime', function(req, res){
	lat = req.param("lat");
	lon = req.param("lon");
	var d = new Date();
	d.setDate(d.getDate() - 7);
	var n = d.toISOString();
	n = n.replace("Z",""); //api doesnt like Z to denote day light savings
	var header = {"X-App-Token": SOCRATA_TOKEN};
	var str = POLICE_API_ENDPOINT+"?$query=SELECT * WHERE event_clearance_date > \""+n+"\" AND within_circle(incident_location,"+lat+", "+lon+",1000)"
	var options = {
		url: str,
		headers: header
	};
	function callback(err, response, body) {
		if(err) { 
			console.log(err); return; 
		} else {
			console.log(body.count);
			res.send(body);
		}
	}
	request(options, callback);
});

app.get('/schools', function(req, res){
	//this endpoint is not returning results corectly, need to filter on clientside
	zip = req.param("zipcode")
	var props = {"$$app_token":SOCRATA_TOKEN};
	console.log(props)
	request({url:SCHOOLS_API_ENDPOINT, qs:props}, function(err, response, body) {
		if(err) { 
			console.log(err); return; 
		} else {
			var obj = JSON.parse(body);
			var vals = [];
			for (idx = 0 ; idx < obj.length; idx++){
				var curr = obj[idx];
				if (curr["zip"]==zip){
					vals.push(obj[idx]);
				}
			}
			var stringified = JSON.stringify(vals);
			res.send(stringified);
		}
	});
});

app.get('/neighborhoodData', function(req, res){
	lat = req.param("lat");
	lon = req.param("lon");
	var props = {"$where": "within_circle(location,"+lat+", "+lon+",1000)", "$$app_token":SOCRATA_TOKEN};
	request({url:NEIGH_API_ENDPOINT, qs:props}, function(err, response, body) {
		if(err) { 
			console.log(err); return; 
		} else {
			res.send(body);
		}
	});
});

app.listen(port, function () {
	converter.fromFile("neighborhooddata.csv",function(err,result){
		neighs = result;
		for (idx = 0; idx <neighs.length; idx++){
			var curr = neighs[idx];
			var keys = curr["Spellings"].split(",");
			var coordKey = curr["Coordinate approx"];
			var coordKey = coordKey.split(/[^\d,\-\.]|\"/).join("");
			curr["Coordinate approx"] = coordKey;
			curr["Description"] = curr["Description"].replace(/[^\w\d\s\.\,\"\-()]/, "");
			coordMapping[coordKey] = curr;
			for (idx2 = 0; idx2 < keys.length; idx2++){
				var key = keys[idx2].split(/\"/).join("").trim();
				neighMapping[key] = curr;
			}
		}
	});
});

function findClosestToPt(Lat, Lon){
	var minDist = 9999;
	var minVal = null;
	var keys = Object.keys(coordMapping);
	for (idx = 0; idx < keys.length; idx++){
		var parts = keys[idx].split(",");
		var Lat1 = Lat;
		var Lon1 = Lon;
		var Lat2 = parts[0];
		var Lon2 = parts[1];
		var haversineDist = haversine(Number(Lat1), Number(Lon1), Number(Lat2), Number(Lon2));
		if (haversineDist < minDist){
			minDist = haversineDist;
			minVal = keys[idx];
		}
	}
	//if min foudn, return, else nothing
	return minVal ? coordMapping[minVal] : null;
}

function haversine(Lat1, Lon1, Lat2, Lon2){
	var R = 6371; //radius of earth in KM
	var degreeLat = deg2rad(Lat2-Lat1);
	var degreeLon = deg2rad(Lon2-Lon1);
	var a = Math.sin(degreeLat/2)*Math.sin(degreeLat/2) +
	Math.cos(deg2rad(Lat1)) * Math.cos(deg2rad(Lat2)) *
	Math.sin(degreeLon/2)*Math.sin(degreeLon/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	var d = R*c;
	return d;
}

function deg2rad(deg) {
	return deg * (Math.PI/180)
}

function convertFromStr(geo_value){
	var result = "not found";
	var zipre = /\d{5}/;
	var coordre = /(-?\d*\.\d*),(\-?\d*\.\d*)/
	var validZip = zipre.exec(geo_value);
	var validCoord = coordre.exec(geo_value);
	console.log(validCoord);
	if (validZip == null){
		if (validCoord == null){
			if (geo_value){
				var str = geo_value.toLowerCase();
				if (neighMapping[str]){
					return neighMapping[str];
				}
				return "Not found";
			}
		} else {
			var res = findClosestToPt(validCoord[1], validCoord[2]);
			if (res == null){
				return "Not found";
			} else {
				return res;
			}
		}

	} else if (validCoord != null){
		var res = findClosestToPt(validCoord[1], validCoord[2]);
		if (res == null){
			return "Not found";
		} else {
			return res;
		}
	} else {
		zip = ""+validZip[0];
		switch(zip){
			case "98177":
			result="Broadview";
			break;
			case "98133":
			result="Bitter Lake";
			break;
			case "98125":
			result="Lake City";
			break;
			case "98117":
			result="Loyal Heights";
			break;
			case "98107":
			result="Ballard";
			break;
			case "98103":
			result="Fremont";
			break;		
			case "98115":
			result="Wedgwood";
			break;		
			case "98105":
			result="University District";
			break;	
			case "98199":
			result="Magnolia";
			break;	
			case "98119":
			result="Queen Anne";
			break;	
			case "98109":
			result="Westlake";
			break;	
			case "98102":
			result="Capitol Hill";
			break;	
			case "98112":
			result="Madison Park";
			break;	
			case "98121":
			result="Belltown";
			break;	
			case "98101":
			result="Downtown";
			break;	
			case "98104":
			result="Downtown";
			break;	
			case "98122":
			result="Madrona";
			break;	
			case "98144":
			result="Mt. Baker";
			break;	
			case "98134":
			result="Sodo";
			break;	
			case "98116":
			result="West Seattle";
			break;	
			case "98126":
			result="High Point";
			break;	
			case "98106":
			result="Riverview";
			break;	
			case "98108":
			result="Beacon Hill";
			break;	
			case "98118":
			result="Rainier Valley";
			break;	
			case "98136":
			result="Gatewood";
			break;	
		}
		var result = result.toLowerCase();
		if (neighMapping[result])
			return neighMapping[result];
	}
	return "Not found";
}