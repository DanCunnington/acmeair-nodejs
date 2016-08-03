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

module.exports = function (isMonolithic, monoDataaccess, proxyUrl, dbtype, settings) {
    var module = {};
	var uuid = require('node-uuid');
	var log4js = require('log4js');

	log4js.configure('log4js.json', {});
	var logger = log4js.getLogger('bookingservice');
	logger.setLevel(settings.loggerLevel);

	var daModuleName = "../../dataaccess/"+dbtype+"/index.js";
	logger.info("Use dataaccess:"+daModuleName);
	
	var databaseName = ((isMonolithic == true) ? "acmeair" : process.env.DATABASE_NAME || "acmeair_bookingdb");
	//var databaseName = process.env.DATABASE_NAME || "acmeair_bookingdb";
	
	var dataaccess = ((isMonolithic == true) ? monoDataaccess : new require(daModuleName)(settings, databaseName));
	//var dataaccess = new require(daModuleName)(settings, databaseName);
	
	module.removeAll = function (collectionname, callback /* (error, insertedDocument) */) {
		dataaccess.removeAll(collectionname, callback)
	};
	
	// auth service setup code ****
	var http = require('http')
    
    // Place holder for service registry/discovery code
	var location = process.env.AUTH_SERVICE || "localhost/acmeair";
	var host;
	var post;
	var authContextRoot;
    
	if (proxyUrl != null){
		var split1 = proxyUrl.split(":");
		host=split1[0];
		port = split1[1];
		//Expecting authentication service name to be auth
		authContextRoot = '/auth' + settings.authContextRoot;
		
	}else if (location.indexOf(":") > -1) {
		var split1 = location.split(":");
		host=split1[0];
		
		var split2 = split1.split("/");
		port = split2[0];
		authContextRoot = '/' + split2[1] + '/rest/api';
	} else {
		var split1 = location.split("/");
		host=split1[0];
		authContextRoot = '/' + split1[1] + '/rest/api';
		port=80;
	}
	// *****
	
	module.dbNames = dataaccess.dbNames
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	module.insertOne = function (collectionname, doc, callback /* (error, insertedDocument) */) {
		dataaccess.insertOne(collectionname, doc, callback)
	};
			
	module.bookflights = function(req, res) {
		logger.debug('booking flights');
		
		var userid = req.body.userid;
		var toFlight = req.body.toFlightId;
		var retFlight = req.body.retFlightId;
		var oneWay = (req.body.oneWayFlight == 'true');
		
		logger.debug("toFlight:"+toFlight+",retFlight:"+retFlight);
		
		bookFlight(toFlight, userid, function (error, toBookingId) {
			if (!oneWay) {
				bookFlight(retFlight, userid, function (error, retBookingId) {
					var bookingInfo = {"oneWay":false,"returnBookingId":retBookingId,"departBookingId":toBookingId};
					res.header('Cache-Control', 'no-cache');
					res.send(bookingInfo);
				});
			}
			else {
				var bookingInfo = {"oneWay":true,"departBookingId":toBookingId};
				res.header('Cache-Control', 'no-cache');
				res.send(bookingInfo);
			}
		});
	};

	module.cancelBooking = function(req, res) {
				
		var number = req.body.number;
		var userid = req.body.userid;
		
		cancelBooking(number, userid, function (error) {
			if (error) {
				res.send({'status':'error'});
			}
			else {
				res.send({'status':'success'});
			}
		});
	};

	module.bookingsByUser = function(req, res) {
		logger.debug('listing booked flights by user ' + req.params.user);
	
		getBookingsByUser(req.params.user, function(err, bookings) {
			if (err) {
				res.sendStatus(500);
			}
			
			res.send(bookings);
		});
	};
	
	module.initializeDatabaseConnections = function(callback/*(error)*/) {
		dataaccess.initializeDatabaseConnections(callback);
	}
	
	module.checkForValidSessionCookie = function(req, res, next) {
		logger.debug('checkForValidCookie');
		var sessionid = req.cookies.sessionid;
		if (sessionid) {
			sessiondid = sessionid.trim();
		}
		if (!sessionid || sessionid == '') {
			logger.debug('checkForValidCookie - no sessionid cookie so returning 403');
			res.sendStatus(403);
			return;
		}
	
		validateSession(sessionid, function(err, customerid) {
			if (err) {
				logger.debug('checkForValidCookie - system error validating session so returning 500');
				res.sendStatus(500);
				return;
			}
			
			if (customerid) {
				logger.debug('checkForValidCookie - good session so allowing next route handler to be called');
				req.acmeair_login_user = customerid;
				next();
				return;
			}
			else {
				logger.debug('checkForValidCookie - bad session so returning 403');
				res.sendStatus(403);
				return;
			}
		});
	}
	
	module.countBookings = function(req,res) {
		countItems(module.dbNames.bookingName, function (error,count){
			if (error){
				res.send("-1");
			} else {
				res.send(count.toString());
			}
		});
	};
	
	countItems = function(dbName, callback /*(error, count)*/) {
		console.log("Calling count on " + dbName);
		dataaccess.count(dbName, {}, function(error, count) {
			console.log("Output for "+dbName+" is "+count);
			if (error) callback(error, null);
			else {
				callback(null,count);
			}
		});
	};
	
	function validateSession(sessionId, callback /* (error, userid) */) {
		
		if(isMonolithic == true){
			var now = new Date();
			
		    dataaccess.findOne(module.dbNames.customerSessionName, sessionId, function(err, session) {
				if (err) callback (err, null);
				else{
					if (now > session.timeoutTime) {
						daraaccess.remove(module.dbNames.customerSessionName,{'_id':sessionId}, function(error) {
							if (error) callback (error, null);
							else callback(null, null);
						});
					}
					else
						callback(null, session.customerid);
				}
			});
		}else {
			http.globalAgent.keepAlive = true;
			var path = authContextRoot + "/login/authcheck/" + sessionId;
	     	var options = {
			hostname: host,
		 	port: port,
		    	path: path,
		    	method: "GET",
		    	headers: {
		    	      'Content-Type': 'application/json'
		    	}
	     	}

	    	logger.debug('validateSession request:'+JSON.stringify(options));

	     	var request = http.request(options, function(response){
	      		var data='';
	      		response.setEncoding('utf8');
	      		response.on('data', function (chunk) {
		   			data +=chunk;
	      		});
	       		response.on('end', function(){
	       			if (response.statusCode>=400)
	       				callback("StatusCode:"+ response.statusCode+",Body:"+data,null);
	       			else
	       				callback(null, JSON.parse(data).customerid);
	        	})
	     	});
	     	request.on('error', function(e) {
	   			callback('problem with request: ' + e.message, null);
	     	});
	     	request.end();
		}
	}
	
	function getBookingsByUser(username, callback /* (error, Bookings) */) {
		dataaccess.findBy(module.dbNames.bookingName, {'customerId':username},callback)
	}
	
	function bookFlight(flightId, userid, callback /* (error, bookingId) */) {
			
		var now = new Date();
		var docId = uuid.v4();
	
		var document = { "_id" : docId, "customerId" : userid, "flightId" : flightId, "dateOfBooking" : now,  "bookingId" : docId };
		
		dataaccess.insertOne(module.dbNames.bookingName,document,function(err){
			callback(err, docId);
		});
	}

	function cancelBooking(bookingid, userid, callback /*(error)*/) {
		dataaccess.remove(module.dbNames.bookingName,{'_id':bookingid, 'customerId':userid}, callback)
	}



	return module;
}