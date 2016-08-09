/*******************************************************************************
* Copyright (c) 2015 IBM Corp.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*******************************************************************************/
var appmetrics = require('appmetrics-web')
appmetrics();
var express = require('express')
  , http = require('http')
  , fs = require('fs')
  , log4js = require('log4js')
  , cfenv = require('cfenv');
var settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));
var debug = require('debug')('acmeair');

var logger = log4js.getLogger('monolithic');
logger.setLevel(settings.loggerLevel);
log4js.configure('log4js.json', {});

// disable process.env.PORT for now as it cause problem on mesos slave
var port = (process.env.VMC_APP_PORT || process.env.VCAP_APP_PORT || settings.monolithic_port);
var host = (process.env.VCAP_APP_HOST || 'localhost');

logger.info("host:port=="+host+":"+port);


var dbtype = process.env.dbtype || "mongo";

// Calculate the backend datastore type if run inside BLuemix or cloud foundry
if(process.env.VCAP_SERVICES){
	var env = JSON.parse(process.env.VCAP_SERVICES);
      	logger.info("env: %j",env);
	var serviceKey = Object.keys(env)[0];
	if (serviceKey && serviceKey.indexOf('cloudant')>-1)
		dbtype="cloudant";
	else if (serviceKey && serviceKey.indexOf('redis')>-1)
		dbtype="redis";
}
logger.info("db type=="+dbtype);

var daModuleName = "./dataaccess/"+dbtype+"/index.js";
logger.info("Use dataaccess:"+daModuleName);
debug("Use dataaccess:", daModuleName);
var dataaccess = new require(daModuleName)(settings, "acmeair");

dbNames = dataaccess.dbNames

var app = express();
var server = require('http').Server(app);

appmetrics.start({app: app, express: express, server: server });

var morgan         = require('morgan');
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');

var router = express.Router(); 		
var routes = null;
var loader = null;

var initialized = false;
var serverStarted = false;

initDB();

function initDB(){
    if (initialized ) return;
	var SLEEP_TIME= 5000;
	var registrationId = setInterval(function() {
      dataaccess.initializeDatabaseConnections(function(error) {
    	if (error) {
    		logger.info('Error connecting to database - exiting process: '+ error);
    		// Do not stop the process for debug in container service
    		//process.exit(1); 
    	}else{
    		initialized = true;
    		clearInterval(registrationId);
        	logger.info("Initialized database connections");

        	var authRoutes = new require('./authservice/routes/index.js')(true,dataaccess,null,dbtype,settings); 
        	var bookingRoutes = new require('./bookingservice/routes/index.js')(true,dataaccess,null,dbtype,settings); 
        	var customerRoutes = new require('./customerservice/routes/index.js')(true,dataaccess,null,dbtype,settings); 
        	var flightRoutes = new require('./flightservice/routes/index.js')(true,dataaccess,dbtype,settings); 
        	var supportRoutes = new require('./supportservice/routes/index.js')(flightRoutes,dbtype,settings); 
        	routes = new require('./monolithic/routes/index.js')(dataaccess,dbtype, settings);
        	loader = new require('./loader/loader.js')(routes, settings);


        	app.use(express.static(__dirname + '/public/monolithic'));     	// set the static files location /public/img will be /img for users
        	if (settings.useDevLogger)
        		app.use(morgan('dev'));                     		// log every request to the console

        	//create application/json parser
        	var jsonParser = bodyParser.json();
        	// create application/x-www-form-urlencoded parser
        	var urlencodedParser = bodyParser.urlencoded({ extended: false });

        	app.use(jsonParser);
        	app.use(urlencodedParser);
        	//parse an HTML body into a string
        	app.use(bodyParser.text({ type: 'text/html' }));

        	app.use(methodOverride());                  			// simulate DELETE and PUT
        	app.use(cookieParser());                  				// parse cookie


        	// main app
        	app.post('/rest/api/login', login);
        	app.get('/rest/api/login/logout', logout);

        	// flight service
        	app.post('/rest/api/flights/queryflights', authRoutes.checkForValidSessionCookie, flightRoutes.queryflights);
        	app.post('/rest/api/bookings/bookflights', authRoutes.checkForValidSessionCookie, bookingRoutes.bookflights);
        	app.post('/rest/api/bookings/cancelbooking', authRoutes.checkForValidSessionCookie, bookingRoutes.cancelBooking);
        	app.get('/rest/api/bookings/byuser/:user', authRoutes.checkForValidSessionCookie, bookingRoutes.bookingsByUser);

        	app.get('/rest/api/customer/byid/:user', authRoutes.checkForValidSessionCookie, customerRoutes.getCustomerById);
        	app.post('/rest/api/customer/byid/:user', authRoutes.checkForValidSessionCookie, customerRoutes.putCustomerById);

        	// probably main app?
        	app.get('/rest/api/config/runtime', routes.getRuntimeInfo);
        	app.get('/rest/api/config/dataServices', routes.getDataServiceInfo);
        	app.get('/rest/api/config/activeDataService', routes.getActiveDataServiceInfo);
        	app.get('/rest/api/config/countBookings', routes.countBookings);
        	app.get('/rest/api/config/countCustomers', routes.countCustomer);
        	app.get('/rest/api/config/countSessions', routes.countCustomerSessions);
        	app.get('/rest/api/config/countFlights', routes.countFlights);
        	app.get('/rest/api/config/countFlightSegments', routes.countFlightSegments);
        	app.get('/rest/api/config/countAirports' , routes.countAirports);
        	//app.get('/loaddb', startLoadDatabase);
        	app.get('/rest/api/loader/load', startLoadDatabase);
        	app.get('/rest/api/loader/query', loader.getNumConfiguredCustomers);

        	// ?
        	app.get('/rest/api/checkstatus', checkStatus);

        	//Set SUPPORT_SERVICE environment variable = true to use this service
        	if (process.env.SUPPORT_SERVICE){

        		//for REST API watson dialog service
        		app.get('/rest/api/WatsonSupportInit', supportRoutes.getSupportInitInfo);
        		app.post('/rest/api/WatsonSupportService', supportRoutes.getSupportService);
        	}


        	//Set WEBSOCKET_SERVICE environment variable = true to use this service
        	if (process.env.WEBSOCKET_SERVICE){
        		var ws = require('ws').Server;
        		//for websocket watson dialog service
        		app.get('/rest/api/support', supportRoutes.getSupportWSPort);

        		var websocket = new require('./websocketservice/index.js')(flightRoutes, settings);
        		debug("websocketPort", settings.websocketPort );
        		/*NOTE: Websocket must have its own port number. It cannot run in Cloud Foundry because 
        		*Current code conflicts the port number with HTTP & chat will not function.
        		*/
        		var wss = new ws({port:(process.env.VCAP_APP_PORT || settings.websocketPort)});
        		wss.on('connection', websocket.chat);
        	}

        	//REGISTER OUR ROUTES so that all of routes will have prefix 
        	//app.use(settings.monolithicContextRoot, router);

    	}
   	  });
	}, SLEEP_TIME);
	startServer();
}

function checkStatus(req, res){
	res.sendStatus(200);
}

function login(req, res){
		routes.login(req, res);
}


function logout(req, res){
		routes.logout(req, res);
}


function startLoadDatabase(req, res){
		loader.startLoadDatabase(req, res);
}

function startServer() {
	var appEnv = cfenv.getAppEnv();

    // start server on the specified port and binding host
    server.listen(appEnv.port, '0.0.0.0', function() {
      // print a message when the server starts listening
      console.log("server starting on " + appEnv.url);
    });  
	logger.info("Express server listening on port " + port);
}