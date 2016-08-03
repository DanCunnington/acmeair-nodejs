## Acmeair NodeJS on Docker 


Assume you have [installed Docker and started Docker daemon](https://docs.docker.com/installation/)
	
		
#### Run Acmeair in Micro-Service Mode with Docker

	1. Create docker network
		docker network create --driver bridge my-net
	
	2. Build/Start Containers. This will build all the node micro-services, mongo db instances, and an nginx proxy.
		a. docker-compose build
		b. NETWORK=my_net docker-compose up
		
	
	3. Go to http://docker_machine_ip/main/acmeair
