openssl req -newkey rsa:2048 -x509 -new -nodes -keyout server.key -out server.crt -subj /CN=test1 -sha256 -days 3650 -addext "subjectAltName = DNS:foo.co.ca,IP:127.0.0.1,IP:192.168.100.2" -addext "extendedKeyUsage = serverAuth"

#openssl genrsa > privkey.pem
#openssl req -new -x509 -key privkey.pem > certificate.pem

