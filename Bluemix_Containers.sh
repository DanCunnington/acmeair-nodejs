cd ..
REGISTRY=registry.ng.bluemix.net
NAME_SPACE=
MONGO_BRIDGE=
SD_URL=https://servicediscovery.ng.bluemix.net
SD_TOKEN=

docker build -f acmeair-nodejs/Dockerfile_BlueMix_main -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_mainservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_as -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_authservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_bs -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_bookingservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_cs -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_customerservice .
docker build -f acmeair-nodejs/Dockerfile_BlueMix_fs -t ${REGISTRY}/${NAME_SPACE}/acmeair_node_flightservice .

docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_mainservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_authservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_bookingservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_customerservice
docker push ${REGISTRY}/${NAME_SPACE}/acmeair_node_flightservice

cf ic run -p 80 -e SERVICE_NAME=main -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name main_1 ${REGISTRY}/${NAME_SPACE}/acmeair_node_mainservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=auth     -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name auth_1     ${REGISTRY}/${NAME_SPACE}/acmeair_node_authservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=booking  -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name booking_1  ${REGISTRY}/${NAME_SPACE}/acmeair_node_bookingservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=customer -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name customer_1 ${REGISTRY}/${NAME_SPACE}/acmeair_node_customerservice
cf ic run -e CCS_BIND_APP=${MONGO_BRIDGE} -e SERVICE_NAME=flight   -e SD_URL=${SD_URL} -e SD_TOKEN=${SD_TOKEN} --name flight_1   ${REGISTRY}/${NAME_SPACE}/acmeair_node_flightservice


