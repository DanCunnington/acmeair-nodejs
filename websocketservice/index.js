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

module.exports = function(loadUtil,settings) {
	var module = {};
	var debug = require('debug')('websocket');
	var watson = require('watson-developer-cloud');
	var vcapUrl = null;
	var vcapUsername = null;
	var vcapPassword = null;
    if (process.env.VCAP_SERVICES) {
        var services = JSON.parse(process.env.VCAP_SERVICES);
        for (var service_name in services) {
            if (service_name.indexOf('dialog') === 0) {
                var service = services[service_name][0];
                vcapUrl = service.credentials.url;
                vcapUsername = service.credentials.username;
                vcapPassword = service.credentials.password;
            }
        }
    }
	var dialog = watson.dialog({
		        url: vcapUrl || settings.watsontUrl,
				username : vcapUsername || settings.watsonUsername,
				password : vcapPassword || settings.watsonPassword,
				version : settings.watsonVersion
			});
	
	var dialog_id = null;
	dialog.getDialogs({}, function (err, dialogs) {
		  if (err)
		    console.log('error:', err);
		  else
			  debug ('Dialogs : ', dialogs );
		    var doesDialogExist = false;
		    dialogs.dialogs.filter(function(item) {
			    if( item.name == settings.watsonDialogName){
			    	debug ('Item : ', item );
			    	debug ('dialog_id : ', item.dialog_id );
			    	dialog_id = item.dialog_id;
			    	doesDialogExist = true;
			    	//To update the dialog, set watsonUpdateDialog true, and update watsonDialogFile.
			    	if (settings.watsonUpdateDialog){
				    	var fs = require('fs');
				    	var params = {
				    			dialog_id: dialog_id,
				    			file: fs.createReadStream('./websocketservice/' + settings.watsonDialogFile)
						};
					    dialog.updateDialog(params, function(err, update){
					    	debug ('Update Message : ',update);
					    	debug ('Error : ',err);
					    });
					}else {
			    		debug ("NO DIALOG UPDATE");
			    	}
			    }
			});
		    /*If the Dialog does not exist, create the dialog.
		     * Set the Dialog name & file name in settings.json
		     */
		    if (!doesDialogExist){
		    	var fs = require('fs');
		    	var params = {
					  name: settings.watsonDialogName,
					  file: fs.createReadStream('./websocketservice/' + settings.watsonDialogFile)
				};
			    dialog.createDialog(params, function(err, newDialog){
			    	debug ('dialog name : ',settings.watsonDialogName);
			    	debug ('Error : ',err);
			    	debug ('dialog_id : ', newDialog.dialog_id );
			    	dialog_id = newDialog.dialog_id;
			    });
		    }
		});

	module.getSupportWSPort = function(req,res) {
		var port = settings.websocketPort.toString();
		res.send(port);
	};


	module.chat = function(ws) {
		ws.send(JSON.stringify({"agent" : "Server Message", "message":"Please wait for a moment. Agent will be with you shortly."}));
	    var params = { dialog_id: dialog_id};
	    dialog.conversation(params, function(err, results) {
		  	    if (err)
					return JSON.stringify(err, null, 2);
		  	    else
			  	  debug ('Results : ' , results);
		  	      debug ('conversation_id : ' , results.conversation_id);
		  	      debug ('client_id : ' , results.client_id);
		  	      ws.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
		  		  ws.on('message', function message(message){
		  			params = { dialog_id: dialog_id, conversation_id: results.conversation_id, input: message};
		  			//params = { dialog_id: dialog_id, conversation_id: results.conversation_id, client_id: results.client_id, input: message};
					dialog.conversation(params, function message(err, results) {
					  if (err)
					    return next(JSON.stringify(err, null, 2));
					  else
						debug ('Results : ' , results);
					  	debug ('conversation_id : ' , results.conversation_id);
					  	debug ('client_id : ' , results.client_id);
					  	client_id = results.client_id;
					  	conversation_id = results.conversation_id;
					  	ws.send(JSON.stringify({"agent" : "Watson", "message":results.response[0]}));
					  	if (results.response[0].indexOf('Itinerary') > -1 ){
					  	  debug ('End of conversation');
					  	  params = { dialog_id: dialog_id, client_id: results.client_id};
					  	  dialog.getProfile(params, function(err, profile) {
					        if (err)
					          return next(JSON.stringify(err, null, 2));
					        else
					          loadUtil.searchFlights(profile.name_values[0].value, profile.name_values[1].value, profile.name_values[2].value=='true', new Date(), new Date(), function(values){
					        	  values.tripFlights.forEach(function(entries, index) {
					        		  entry = entries.flightsOptions[0];
					        		  debug({"agent" : "Watson", "message": 
					        			  (index == 0 ? "OUTBOUND - " : "INBOUND - " ) +
					        			  "Airplane : " + entry['airplaneTypeId'] + 
					        			  "Flight : " + entry['flightSegmentId'] + 
					        			  "Departure : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
					        			  "Arrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime']});
					        		  ws.send(JSON.stringify({"agent" : "Watson", "message": 
					        			  (index == 0 ? "OUTBOUND - " : "INBOUND - " ) +
					        			  " Airplane : " + entry['airplaneTypeId'] + 
					        			  " Flight : " + entry['flightSegmentId'] + 
					        			  "\nDeparture : " + (index == 0 ? profile.name_values[0].value : profile.name_values[1].value ) + " " + entry['scheduledDepartureTime'] +
					        			  "\nArrival : " + (index == 0 ? profile.name_values[1].value : profile.name_values[0].value ) + " " + entry['scheduledArrivalTime'] + "\n :"}));
					        	  
					        	  });
							  	  ws.send(JSON.stringify({"agent" : "Watson", "message":"Please login and reserve flights for reservation in the flights tab.\nIs there anything else that I can help you with?"}));
					          });
					      });
					  	}
					});
				  });
		  		  ws.on('close', function close() {
		  			ws.close();
		  		    debug('disconnected');
		  		  });
		  	  });
	}
	
	return module;
}