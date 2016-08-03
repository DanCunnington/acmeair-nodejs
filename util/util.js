module.exports = {
	registerService: function (serviceName, port) {
		var request = require('request');
		var NAME = serviceName;
		var PORT = port;
		var BEARER_TOKEN = process.env.SD_TOKEN;
		var SD_URL = process.env.SD_URL;
		var space_id = process.env.space_id;
		var SERVICE_IP = ""; //see below

		var headers = {'content-type': 'application/json', 'authorization': 'Bearer ' + BEARER_TOKEN, 'X-Forwarded-Proto': 'https' };
		var TIME_TO_LIVE = 300;
		var SLEEP_TIME= Math.ceil(TIME_TO_LIVE*0.9*1000);
		var url = SD_URL + "/api/v1/instances";

		//Get the service IP
		var os = require('os');
		var interfaces = os.networkInterfaces();
		var addresses = [];
		for (var k in interfaces) {
		    for (var k2 in interfaces[k]) {
		        var address = interfaces[k][k2];
		        if (address.family === 'IPv4' && !address.internal) {
		            addresses.push(address.address);
		        }
		    }
		}

		SERVICE_IP=addresses[0];

		var options = {
			url: url,
			headers: headers,
			json: {
				tags :[],
				status : "UP",
				service_name: NAME, 
				endpoint: {type: "http", "value": SERVICE_IP +":"+ PORT }, 
				ttl:TIME_TO_LIVE
			}
		};

		
		/*space_id implicitly tell that it is running on IBM Container.
		 * If space_id exists, register the container to the Service Discovery.
		 */
		if (space_id){
			console.log('OPTIONS : ' + JSON.stringify(options));
			var registrationId = setInterval(function() {
			//Register Container
			request.post(options, function (err, res, body) {
				if ( typeof res !== 'undefined' && res ){
					res.setEncoding('utf8');
					var heartURL = body.links.heartbeat;
					console.log('REGISTRATION RESPONSE : ' + JSON.stringify(res));
					var heartOptions = {
						url: heartURL,
						headers: headers
					};
					console.log('HEARTBEAT OPTIONS : ' + heartURL);
					clearInterval(registrationId);
					//Renewing registration periodically 
					setInterval(function() {
						request.put(heartOptions, function (err, res, body) {
							if (( typeof res !== 'undefined' && res ) && (res.statusCode === 200)){
								console.log('HEARTBEAT RESPONSE : ', JSON.stringify(res));
							}else{
								if ( typeof res !== 'undefined' && res ){
									console.log('REGISTRATION RENEWAL FAILED WITH STATUS CODE : ' + res.statusCode + '. TRY REGISTRATION AGAIN.');	
								} else {
									console.log('REGISTRATION RENEWAL FAILED. TRY REGISTRATION AGAIN.');
								}
								//Re-registering after failed heartbeat
								request.post(options, function (err, res, body) {
									if ( typeof res !== 'undefined' && res ){
										res.setEncoding('utf8');
										console.log('RE-REGISTRATION RESPONSE : ', JSON.stringify(res));
										heartURL = body.links.heartbeat;
										heartOptions = {
											url: heartURL,
											headers: headers
										};
										console.log('RE-REGISTRATION HEARTBEAT OPTIONS : ' + heartURL);
									}else{
										console.log('RE-REGISTRATION FAILED! POST RESPONSE DOES NOT EXIST!');
									}
								});
							}
						});
					}, SLEEP_TIME);
				}else{
					console.log('REGISTRATION FAILED! POST RESPONSE DOES NOT EXIST!');
				}
			});
		  }, 10000);
		}
	},

	getServiceProxy: function (callback) {
		var request = require('request');
		var BEARER_TOKEN = process.env.SD_TOKEN;
		var SD_URL = process.env.SD_URL;
		var space_id = process.env.space_id;

		var headers = {'content-type': 'application/json', 'authorization': 'Bearer ' + BEARER_TOKEN, 'X-Forwarded-Proto': 'https' };
		var url = SD_URL + "/api/v1/services/ServiceProxy";

		var options = {
			url: url,
			headers: headers
		};

		
		/*space_id implicitly tell that it is running on IBM Container.
		 * If space_id exists, find Service Proxy.
		 */
		if (space_id){
		  console.log('OPTIONS : ' + JSON.stringify(options));
		  var id = setInterval(function() {
			//Register Container
			//Get ServiceProxy information
			request.get(options, function (err, res, body) {
				if ( typeof res !== 'undefined' && res ){
					JSON.parse(body).instances.forEach(function(instance){
						if(instance.service_name === "ServiceProxy"){
							console.log('SERVICE PROXY IP AND PORT : ' + instance.endpoint.value);
							clearInterval(id);
							callback(instance.endpoint.value);
						}
					});
				}
			});
		  }, 10000);
		}else{
			callback(null);
		};
	}
}