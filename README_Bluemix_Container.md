## Acmeair NodeJS on Bluemix Container

Prereq:

[Install Docker and stared Docker daemon on your local machine](https://docs.docker.com/installation/)

[Install Cloud Foundry](http://docs.cloudfoundry.org/cf-cli/) & [IBM Containers Plugin](https://console.ng.bluemix.net/docs/containers/container_cli_cfic.html)

[Setup Compose Mongo DB & create acmeair database](https://www.compose.io/mongodb/)

* Retrieve & save these information from Compose Mongo DB

	hostname,"port", "db", "username", "password”

	Create a string:
	
	"url": "mongodb://username:password@hostname:port/db"
	e.g. mongodb://acmeuser:password@myServer.dblayer.com:27017/acmeair

* On cf cli, run following commands to create Compose Mongo DB service on Bluemix:

	Use CF command to create DB:
	cf cups mongoCompose -p "url"
	
	At the URL prompt, enter above URL that was created:
	url>mongodb://acmeuser:password@myServer.dblayer.com:27017/acmeair

* Mongo DB CF Bridge App:

	On Bluemix UI, go to dashboard
	
	Under “Cloud Foundry App”, click CREATE APP > WEB > SDK for Node.js > Continue > Enter “MongoBridge” as an app name > FINISH
	
	Click “Overview” from left navigator for “MongoBridge” app > Click “Bind a Service” > Select “mongoCompose” that you have created > ADD
	
Note: memory quota can be 64 MB

[Setup Service Discovery](https://console.ng.bluemix.net/docs/services/ServiceDiscovery/index.html)

[Setup Service Proxy](https://console.ng.bluemix.net/docs/services/ServiceProxy/index.html) 

* From Service Discovery Bluemix UI, get the following information:

	Go to Service Discovery > From the left navigation, go to Service Credentials > Get auth_token and url 

* For the ServiceProxyTenant, on the cf cli, assign public IP address with the following:

	cf ic ip request

	cf ic ip bind <public IP address> ServiceProxyTenant

From the Bluemix UI, go to ServiceProxyTenant container, then record public IP address and port number

	e.g. Public IP : 134.168.16.136, port number :6379

### Create each services in IBM Container service

	On local docker server, Go to the root directory of acmeair-nodejs

* Create the images for each service with the following commands:

	docker build -f acmeair-nodejs/Dockerfile_Bluemix_main -t main .
	docker build -f acmeair-nodejs/Dockerfile_Bluemix_as -t auth .
	docker build -f acmeair-nodejs/Dockerfile_Bluemix_bs -t booking .
	docker build -f acmeair-nodejs/Dockerfile_Bluemix_cs -t customer .
	docker build -f acmeair-nodejs/Dockerfile_Bluemix_fs -t flight .


* Tag the image with Bluemix Registry name with the following command:
	
	docker tag <service>.registry.<bluemi region>.bluemix.net/<namespace>/<image name>:latest

	Examples: My namespace is wasperf.
	docker tag main:latest registry.ng.bluemix.net/wasperf/main:latest
	docker tag auth:latest registry.ng.bluemix.net/wasperf/auth:latest
	docker tag booking:latest registry.ng.bluemix.net/wasperf/booking:latest
	docker tag customer:latest registry.ng.bluemix.net/wasperf/customer:latest
	docker tag flight:latest registry.ng.bluemix.net/wasperf/flight:latest

* Push the image to Bluemix with the following command:

	docker push registry.<bluemi region>.bluemix.net/<namespace>/<image name>:latest

	Examples: My namespace is wasperf.
	docker push registry.ng.bluemix.net/wasperf/main:latest
	docker push registry.ng.bluemix.net/wasperf/auth:latest
	docker push registry.ng.bluemix.net/wasperf/booking:latest
	docker push registry.ng.bluemix.net/wasperf/customer:latest
	docker push registry.ng.bluemix.net/wasperf/flight:latest

* Deploy the Container Image with following command (use Service Discovery - SD - auth_token and URL retrieved from prerequisite):

	cf ic run -e CCS_BIND_APP=<Mongo Bridge App Name> -e SERVICE_NAME=<service name> -e SD_URL=<SD URL> -e SD_TOKEN=<auth_token> --name <container name> <image name>

	Examples:
	cf ic run -e SERVICE_NAME=main -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/main
	cf ic run -e CCS_BIND_APP=MongoBridge -e SERVICE_NAME=auth -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/auth
	cf ic run -e CCS_BIND_APP=MongoBridge -e SERVICE_NAME=auth -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/booking
	cf ic run -e CCS_BIND_APP=MongoBridge -e SERVICE_NAME=auth -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/customer
	cf ic run -e CCS_BIND_APP=MongoBridge -e SERVICE_NAME=auth -e SD_URL=https://servicediscovery.ng.bluemix.net -e SD_TOKEN=1m3rliolucbampleoq36am82bdfv0othuruoefe6enop27ab7cnp --name auth_1 registry.ng.bluemix.net/strong/flight

NOTE: These service name MUST be used (hardcoded in the app to recognize each unique services):

	Authentication Service : auth
	Customer Service : customer
	Flight Service : flight
	Booking Service : booking

* Useful command for debugging : The following command can be used to logon container shell:

	cf ic exec -it <container name> bash

	e.g. cf ic exec -it auth_2 bash

Wait for couple minutes AFTER all services are running (There is 1 minute sleep time in the app to wait for all initialization including networking)


	URL : http://134.168.16.136:6379/main/acmeair/config.html


#### Check if Services are registered

* Go to Service Discovery to see all services are discovered

* Go to Service Proxy to see all services are registered

Debugging:

	Go to each container services log to see if there is heartbeat recorded and StatusCode is 200:

	e.g. {"log":"HEARTBEAT RESPONSE : {\"statusCode\":200,\.....}