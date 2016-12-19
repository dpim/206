
# 206 

## About
This repo contains the client and service components of a web app for researching neighborhoods in Seattle, WA. The service contains functionality to convert from different forms of location input  (coordinates, zip code and name), and merges together data from a local csv with REST API responses from [Seattle Open Data](https://data.seattle.gov/). 

### Data
* Description
* Schools in the neighborhoods
* Public facilities
* Rate of property crime
* Recent violent crime

## To Run
* Obtain [Socrata Token](https://dev.socrata.com/), update constant in server.js 
* Clone repo 
* Install Node/NPM
* Run server.js

## Live Preview
http://206neigh.azurewebsites.net/

![alt text](/screenshot.png "Screenshot")